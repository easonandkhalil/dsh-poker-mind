/* 德州心法 · 对手范围建模
 * 不偷看底牌：只用位置、行动线、筹码、牌面与对手画像推断范围。
 * 翻前用位置基准 + 画像宽度；翻后用成牌/听牌强度对组合重新加权。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};
  const Cards = PM.Cards, Ranges = PM.Ranges, Charts = PM.Charts, E = PM.Evaluator;

  const CLASSES = Cards.ALL_CLASSES;
  const CLASS_SCORE = {};
  const REP = {};
  CLASSES.forEach(cls => {
    const cards = Cards.classCards(cls)[0];
    let s = Ranges.chen(cards);
    if (cls[2] === 's') s += 1.7;
    if (cls[0] === cls[1]) s += 2.2;
    const hi = Cards.RANKS.indexOf(cls[0]), lo = Cards.RANKS.indexOf(cls[1]);
    if (hi - lo === 1) s += 1.2;
    if (hi >= 9 && lo >= 8) s += 0.8;
    if (cls[0] === 'A') s += 0.6;
    if (cls[2] === 'o' && lo < 7 && hi - lo > 2) s -= 0.6;
    CLASS_SCORE[cls] = s;
    REP[cls] = cards;
  });
  const SORTED_CLASSES = CLASSES.slice().sort((a, b) => CLASS_SCORE[b] - CLASS_SCORE[a]);
  const TOP_CACHE = {};

  function topClassesPercent(pct) {
    pct = Math.max(0.01, Math.min(0.95, pct));
    const key = Math.round(pct * 1000);
    if (TOP_CACHE[key]) return TOP_CACHE[key];
    const target = pct * 1326;
    let total = 0;
    const out = [];
    for (let i = 0; i < SORTED_CLASSES.length; i++) {
      const cls = SORTED_CLASSES[i];
      const n = Ranges.byClass[cls].length;
      if (total >= target && out.length > 8) break;
      out.push(cls);
      total += n;
    }
    TOP_CACHE[key] = out;
    return out;
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function profileRangeWidth(profile, position, scenario) {
    const st = profile.stats || {};
    const strat = profile.strategy || {};
    const posIdx = Charts.POSITION_ORDER[position] == null ? 3 : Charts.POSITION_ORDER[position];
    const posTight = position === 'UTG' ? 0.78 : position === 'HJ' ? 0.9 : position === 'CO' ? 1.06 : position === 'BTN' ? 1.25 : position === 'SB' ? 1.05 : 1.2;
    if (scenario === 'open') return clamp((st.pfr || 18) / 100 * posTight * (strat.openWidth || 1), 0.05, 0.72);
    if (scenario === 'threeBet') return clamp((st.threeBet || 6) / 100 * 1.4, 0.025, 0.22);
    if (scenario === 'fourBet') return clamp((st.threeBet || 6) / 100 * 0.45, 0.012, 0.08);
    if (scenario === 'callVsOpen') return clamp(((st.vpip || 24) - (st.pfr || 18)) / 100 * 1.7 + 0.05, 0.04, 0.4);
    if (scenario === 'bbDefend') return clamp(0.28 + ((st.vpip || 24) - 24) / 130, 0.18, 0.62);
    if (scenario === 'limp') return clamp((st.vpip || 24) / 100 * 0.55, 0.05, 0.35);
    return 0.2;
  }

  function notationFor(position, scenario) {
    if (scenario === 'open') return Charts.OPEN[position] || Charts.OPEN.BTN;
    if (scenario === 'threeBet') return Charts.THREE_BET[position] || Charts.THREE_BET.BTN;
    if (scenario === 'fourBet') return Charts.FOUR_BET[position] || Charts.FOUR_BET.BTN;
    if (scenario === 'callVsOpen' || scenario === 'bbDefend') return Charts.CALL_VS_OPEN[position] || Charts.CALL_VS_OPEN.BTN;
    return Charts.CALL_VS_OPEN[position] || Charts.CALL_VS_OPEN.BTN;
  }

  const rangeCache = new Map();

  function buildPreflopRange(profile, position, scenario) {
    const key = [profile.id || profile.name || 'generic', position, scenario].join('|');
    if (rangeCache.has(key)) return rangeCache.get(key);
    const baseClasses = Ranges.classesFromNotation(notationFor(position, scenario));
    const target = profileRangeWidth(profile, position, scenario);
    const top = topClassesPercent(target);
    const weight = {};
    baseClasses.forEach(cls => { weight[cls] = 1; });
    top.forEach((cls, i) => {
      if (!weight[cls]) weight[cls] = 0.34 + 0.16 * Math.max(0, 1 - i / Math.max(20, top.length));
    });
    // 极端紧的对手：削弱基线中的边缘牌
    const vpip = (profile.stats && profile.stats.vpip) || 24;
    if (vpip < 17) {
      Object.keys(weight).forEach(cls => { if (CLASS_SCORE[cls] < 5.5) weight[cls] *= 0.35; });
    }
    // 松凶：增加同花连张与阻断牌
    if (vpip > 34) {
      ['A5s', 'A4s', 'A3s', 'A2s', 'K9s', 'Q9s', 'J9s', 'T8s', '97s', '86s', '75s', '65s', '54s'].forEach(cls => {
        if (!weight[cls]) weight[cls] = 0.5;
      });
    }
    // 3bet 范围必须包含价值顶端
    if (scenario === 'threeBet' || scenario === 'fourBet') {
      ['AA', 'KK', 'QQ', 'AKs', 'AKo'].forEach(cls => { weight[cls] = Math.max(weight[cls] || 0, 1); });
    }
    // 把范围收紧到画像目标宽度：优先删除分值最低的组合，保留顶端价值牌
    const premium = new Set(['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo', 'AQs', 'AQo']);
    let total = 0;
    Object.keys(weight).forEach(cls => {
      if (weight[cls] > 0) total += weight[cls] * (Ranges.byClass[cls] || []).length;
    });
    const targetCombos = target * 1326;
    if (total > targetCombos) {
      const removable = Object.keys(weight).filter(cls => weight[cls] > 0 && !premium.has(cls))
        .sort((a, b) => CLASS_SCORE[a] - CLASS_SCORE[b]);
      for (let i = 0; i < removable.length && total > targetCombos; i++) {
        const cls = removable[i];
        const cw = weight[cls] * (Ranges.byClass[cls] || []).length;
        if (total - cw >= targetCombos) {
          total -= cw;
          delete weight[cls];
        } else {
          const keep = (targetCombos - (total - cw)) / Math.max(1, cw);
          weight[cls] *= Math.max(0.02, keep);
          total = targetCombos;
        }
      }
      if (total > targetCombos) {
        const scale = targetCombos / total;
        Object.keys(weight).forEach(cls => { weight[cls] *= scale; });
      }
    }
    const combos = [];
    Object.keys(weight).forEach(cls => {
      if (!weight[cls]) return;
      (Ranges.byClass[cls] || []).forEach(c => combos.push({ c1: c.c1, c2: c.c2, cls, w: weight[cls] }));
    });
    rangeCache.set(key, combos);
    return combos;
  }

  function preflopScenario(state, seat) {
    const acts = state.actions.filter(a => a.seat === seat.index && a.street === 'preflop');
    if (seat.folded) return 'folded';
    const raisesBefore = state.actions.filter(a => a.street === 'preflop' && (a.type === 'raise' || a.type === 'allin') && a.seat !== seat.index);
    const lastRaise = raisesBefore.length ? raisesBefore[raisesBefore.length - 1] : null;
    const myRaise = acts.filter(a => a.type === 'raise' || a.type === 'allin').pop();
    if (myRaise) {
      const raisesBeforeMe = raisesBefore.filter(a => a.seq < myRaise.seq).length;
      if (raisesBeforeMe >= 2) return 'fourBet';
      if (raisesBeforeMe === 1) return 'threeBet';
      return 'open';
    }
    if (acts.some(a => a.type === 'call')) {
      if (raisesBefore.length) return seat.position === 'BB' ? 'bbDefend' : 'callVsOpen';
      return 'limp';
    }
    if (state.street !== 'preflop' || raisesBefore.length >= 1) {
      if (seat.position === 'BB' && raisesBefore.length <= 1) return 'bbDefend';
      return 'callVsOpen';
    }
    // 尚未行动且无人加注：保留开池范围
    if (seat.position === 'BB') return 'bbDefend';
    return 'open';
  }

  function effectiveProfile(state, seat) {
    if (seat.isHero) {
      const hs = state.heroStats || {};
      return {
        id: 'hero-model', name: '你', stats: {
          vpip: hs.vpip == null ? 28 : hs.vpip,
          pfr: hs.pfr == null ? 20 : hs.pfr,
          threeBet: hs.threeBet == null ? 7 : hs.threeBet,
          foldCbet: hs.foldToCbet == null ? 47 : hs.foldToCbet,
          callDown: 50, bluff: hs.bluff == null ? 24 : hs.bluff,
          cbet: hs.cbet == null ? 62 : hs.cbet, af: hs.af == null ? 2.2 : hs.af
        },
        strategy: { openWidth: 1, aggression: 1, sizing: 'balanced' }
      };
    }
    return seat.profile || { id: 'generic', name: '对手', stats: { vpip: 26, pfr: 19, threeBet: 7, foldCbet: 47, callDown: 50, bluff: 24, cbet: 62, af: 2.3 }, strategy: {} };
  }

  function postflopWeight(profile, hole, board, postActs) {
    if (!board.length) return 1;
    const all = hole.concat(board);
    let cat = 0, draw = 0;
    if (all.length >= 5) {
      cat = E.catOf(E.evaluateCards(all)) / 7;
      draw = Math.min(0.55, E.drawInfo(hole, board).outs / 24);
    }
    let w = 0.28 + cat * 1.5 + draw * 1.1;
    const bluff = (profile.stats.bluff || 20) / 100;
    const trap = (profile.stats.trap || 20) / 100;
    for (let i = 0; i < postActs.length; i++) {
      const a = postActs[i];
      if (a.type === 'raise' || a.type === 'allin') {
        w *= 0.18 + cat * 2.1 + draw * 1.55 + bluff * 0.75;
      } else if (a.type === 'call') {
        w *= 0.35 + cat * 1.35 + draw * 0.95 + (profile.stats.callDown || 45) / 240;
      } else if (a.type === 'check') {
        w *= 0.65 + (1 - cat) * 0.75 + trap * 0.28;
      }
      w = Math.max(0.01, Math.min(5, w));
    }
    return w;
  }

  function estimatePreflop(state, seat) {
    const profile = effectiveProfile(state, seat);
    if (seat.folded) return [];
    const scenario = preflopScenario(state, seat);
    if (scenario === 'folded') return [];
    return buildPreflopRange(profile, seat.position, scenario);
  }

  function estimate(state, seat, knownCards) {
    if (!seat || seat.folded) return [];
    const known = (knownCards || []).slice().sort((a, b) => a - b);
    const cacheKey = (seat.index) + '|' + state.actions.length + '|' + state.board.length + '|' + known.join(',') + '|' + (state._rangeEpoch || 0);
    if (!state._rangeCache) state._rangeCache = {};
    if (state._rangeCache[cacheKey]) return state._rangeCache[cacheKey];
    let base = estimatePreflop(state, seat);
    const profile = effectiveProfile(state, seat);
    const dead = new Set(known);
    state.board.forEach(c => dead.add(c));
    base = base.filter(c => !dead.has(c.c1) && !dead.has(c.c2));
    if (state.street !== 'preflop' && state.board.length) {
      const myPost = state.actions.filter(a => a.seat === seat.index && a.street !== 'preflop');
      if (myPost.some(a => a.type === 'fold')) { state._rangeCache[cacheKey] = []; return []; }
      // 用本街之前所有动作更新；不包含当前正在考虑的 hero 行动
      const weighted = [];
      for (let i = 0; i < base.length; i++) {
        const c = base[i];
        const w = c.w * postflopWeight(profile, [c.c1, c.c2], state.board, myPost);
        if (w > 0.002) weighted.push({ c1: c.c1, c2: c.c2, cls: c.cls, w });
      }
      if (weighted.length < 12) base = base.map(c => ({ c1: c.c1, c2: c.c2, cls: c.cls, w: c.w * 0.15 }));
      else base = weighted;
    }
    state._rangeCache[cacheKey] = base;
    return base;
  }

  function rangePercent(range) {
    let w = 0;
    range.forEach(c => w += c.w);
    return w / 1326;
  }

  function summary(range, board, n) {
    n = n || 6;
    const byCls = {};
    let total = 0;
    range.forEach(c => {
      byCls[c.cls] = (byCls[c.cls] || 0) + c.w;
      total += c.w;
    });
    const top = Object.keys(byCls).sort((a, b) => byCls[b] - byCls[a]).slice(0, n)
      .map(cls => ({ cls, pct: byCls[cls] / Math.max(1, total) }));
    return {
      pct: total / 1326,
      top,
      label: top.map(x => x.cls).join(' · ') + (top.length ? ' …' : ''),
      combos: range.length,
      weighted: Math.round(total)
    };
  }

  function foldEquity(profile, sizeRatio, street, numOpponents, isRaise) {
    const st = (profile && profile.stats) || {};
    let base = (st.foldCbet == null ? 47 : st.foldCbet) / 100;
    base += Math.log(1 + Math.max(0, sizeRatio)) * 0.09;
    base -= ((st.callDown || 45) - 45) / 180;
    if (street === 'river') base -= 0.05;
    if (street === 'preflop') base = 0.36 + (st.foldCbet || 47) / 500;
    if (isRaise) base -= 0.12;
    base = clamp(base, 0.06, 0.8);
    const n = Math.max(1, numOpponents);
    return 1 - Math.pow(1 - base, n);
  }

  function heroRangeForAI(state, heroSeat, knownCards) {
    return estimate(state, heroSeat, knownCards);
  }

  // 范围 vs 范围的可视化：当前牌面下最强的若干具体组合
  function nutCombos(range, board, n) {
    if (!board.length) return [];
    const arr = range.map(c => {
      const score = E.evaluateCards([c.c1, c.c2].concat(board));
      return { cards: [c.c1, c.c2], cls: c.cls, score, cat: E.catOf(score), text: E.describe(score).text, w: c.w };
    }).sort((a, b) => b.score - a.score || b.w - a.w);
    return arr.slice(0, n || 5);
  }

  function clearCache() { rangeCache.clear(); }

  PM.RangeModel = {
    CLASS_SCORE, SORTED_CLASSES, topClassesPercent, profileRangeWidth, buildPreflopRange,
    preflopScenario, estimate, rangePercent, summary, foldEquity, heroRangeForAI,
    postflopWeight, nutCombos, clearCache, effectiveProfile
  };
})(typeof window !== 'undefined' ? window : globalThis);
