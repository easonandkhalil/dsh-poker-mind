/* 德州心法 · AI 对手决策
 * 画像固定 + 随机抽取 + 每手混合频率 + 剥削修正 + 范围/赔率/筹码/位置综合判断。
 * AI 永远看不到对手底牌，只使用公开行动与自己的推算范围。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};
  const Cards = PM.Cards, E = PM.Evaluator, Ranges = PM.Ranges, Equity = PM.Equity;
  const RangeModel = PM.RangeModel, Charts = PM.Charts;

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function activeOpponents(game, seat) {
    return game.seats.filter(s => !s.folded && s.index !== seat.index);
  }
  function makeRng(game, seat) {
    const seed = Cards.hashString([game.config.seed, game.handNo, seat.index, game.actions.length, game.street].join(':'));
    return Cards.mulberry32(seed);
  }
  function playerLabel(s, game) {
    return s.isHero ? '你' : s.name;
  }

  function rangesFor(game, seat) {
    const opps = activeOpponents(game, seat);
    const known = seat.cards.concat(game.board);
    return opps.map(o => ({ seat: o, range: RangeModel.estimate(game, o, known) })).filter(x => x.range.length > 0);
  }

  function calcEquity(game, seat, ranges, iterations) {
    if (!ranges.length) return { equity: 1, ci: 0, exact: false, samples: 0, opponents: 0 };
    return Equity.equity({
      hero: seat.cards, board: game.board, ranges: ranges.map(r => r.range),
      iterations: iterations || (game.board.length === 0 ? 2600 : 2400),
      seed: Cards.hashString([game.config.seed, game.handNo, seat.index, game.actions.length, 'eq'].join(':'))
    });
  }

  function handClassOf(seat) { return Cards.handClass(seat.cards[0], seat.cards[1]); }
  function rangeHas(range, cls) {
    for (let i = 0; i < range.length; i++) if (range[i].cls === cls && range[i].w > 0.25) return true;
    return false;
  }
  function rangeWeight(range, cls) {
    let w = 0;
    range.forEach(c => { if (c.cls === cls) w += c.w; });
    return w;
  }

  function preflopSizing(game, seat, legal, profile, rng, premium) {
    const bb = game.bb;
    let target;
    if (game.currentBet <= bb) {
      const limpers = game.seats.filter(s => !s.folded && s.index !== seat.index && s.committed >= bb && s.streetBet >= bb).length;
      target = Math.round(bb * (2.3 + rng() * 0.5 + limpers * 0.55 + (premium ? 0.7 : 0)));
    } else {
      target = Math.round(game.currentBet + Math.max(game.lastRaiseSize, bb) * (2.4 + rng() * 0.8 + (premium ? 0.5 : 0)));
    }
    target = clamp(target, Math.min(legal.minRaiseTo, legal.maxRaiseTo), legal.maxRaiseTo);
    if (legal.maxRaiseTo - target < bb * 2 && legal.maxRaiseTo < bb * 35) target = legal.maxRaiseTo;
    return target;
  }

  function preflopDecision(game, seat, legal, ctx) {
    const profile = seat.profile || { stats: { vpip: 25, pfr: 19, threeBet: 7, foldCbet: 46, callDown: 50, bluff: 24, trap: 22 }, strategy: { aggression: 1 } };
    const cls = handClassOf(seat);
    const chen = Ranges.chen(seat.cards);
    const pos = seat.position;
    const raises = game.actions.filter(a => a.street === 'preflop' && (a.type === 'raise'));
    const currentRaise = raises.length ? raises[raises.length - 1] : null;
    const openRange = RangeModel.buildPreflopRange(profile, pos, 'open');
    const threeBetRange = RangeModel.buildPreflopRange(profile, pos, 'threeBet');
    const fourBetRange = RangeModel.buildPreflopRange(profile, pos, 'fourBet');
    const callRange = RangeModel.buildPreflopRange(profile, pos, 'callVsOpen');
    const bbRange = RangeModel.buildPreflopRange(profile, pos, 'bbDefend');
    const inOpen = rangeHas(openRange, cls);
    const in3b = rangeHas(threeBetRange, cls);
    const in4b = rangeHas(fourBetRange, cls);
    const inCall = rangeHas(callRange, cls) || rangeHas(bbRange, cls);
    const premium = ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'].includes(cls);
    const strong = premium || ['TT', '99', 'AQs', 'AJs', 'KQs', 'AQo', 'AJo'].includes(cls);
    const speculative = ['22', '33', '44', '55', '66', '77', '88', 'T9s', '98s', '87s', '76s', '65s', '54s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'QJs', 'JTs'].includes(cls);
    const facing = legal.toCall > 0;
    const potOdds = facing ? legal.toCall / (game._potTotal() + legal.toCall) : 0;
    const effBB = legal.stack / game.bb;
    const rng = makeRng(game, seat);
    const aggression = (profile.strategy && profile.strategy.aggression) || 1;
    const bluffBase = (profile.stats.bluff || 20) / 100;

    // 翻前全下：用范围胜率 + 赔率
    if (facing && legal.toCall >= legal.stack * 0.75) {
      const eq = ctx.equity.equity;
      const callCost = legal.callAmount;
      const required = callCost / (game._potTotal() + callCost);
      const riskAdj = (profile.stats.callDown || 45) / 100 * 0.03;
      if (eq > required + 0.04 - riskAdj) {
        return { type: 'call', amount: callCost, intent: 'call', confidence: 0.72, label: '全下跟注' };
      }
      return { type: 'fold', intent: 'fold', confidence: 0.85, label: '弃牌' };
    }

    if (!currentRaise) {
      // 无人加注
      if (legal.toCall === 0) { // BB option
        if ((inOpen && chen >= 7) || premium) {
          return { type: 'raise', amount: preflopSizing(game, seat, legal, profile, rng, premium), intent: 'value', confidence: 0.72, label: '加注' };
        }
        if (bluffBase > 0.36 && rng() < 0.12 && legal.canRaise) {
          return { type: 'raise', amount: preflopSizing(game, seat, legal, profile, rng, premium), intent: 'bluff', confidence: 0.52, label: '偷池' };
        }
        return { type: 'check', intent: 'check', confidence: 0.7, label: '过牌' };
      }
      // SB 补盲或跟注
      if ((inOpen && chen >= 6.5) || premium) {
        if (legal.canRaise && (chen >= 9 || rng() < 0.55 * aggression)) {
          return { type: 'raise', amount: preflopSizing(game, seat, legal, profile, rng, premium), intent: premium ? 'value' : 'raise', confidence: 0.7, label: '加注' };
        }
        return { type: 'call', amount: legal.callAmount, intent: 'call', confidence: 0.62, label: '跟注' };
      }
      if (legal.toCall <= game.bb * 0.6 && (inCall || (chen > 5 && rng() < bluffBase))) {
        return { type: 'call', amount: legal.callAmount, intent: 'call', confidence: 0.55, label: '跟注' };
      }
      return { type: 'fold', intent: 'fold', confidence: 0.8, label: '弃牌' };
    }

    // 面对加注
    const raiseCount = raises.length;
    const lastRaiseByMe = currentRaise && currentRaise.seat === seat.index;
    if (lastRaiseByMe) return { type: 'check', intent: 'check', confidence: 0.5, label: '过牌' };
    const stackBB = effBB;
    const canContinue = legal.canRaise && legal.stack > game.bb * 3;

    if (raiseCount >= 2) {
      // 面对 3bet/4bet
      if (in4b && legal.canRaise && rng() < 0.7 + aggression * 0.12) {
        return { type: 'raise', amount: preflopSizing(game, seat, legal, profile, rng, premium), intent: 'value', confidence: 0.8, label: '再加注' };
      }
      if (premium && (rng() < 0.55 || !canContinue)) {
        return { type: 'call', amount: legal.callAmount, intent: 'call', confidence: 0.7, label: '跟注' };
      }
      if (strong && potOdds < 0.42 && stackBB > 18) {
        return { type: 'call', amount: legal.callAmount, intent: 'call', confidence: 0.55, label: '跟注' };
      }
      return { type: 'fold', intent: 'fold', confidence: 0.8, label: '弃牌' };
    }

    // 面对单个 open
    if (in3b && legal.canRaise) {
      const trap = (profile.stats.trap || 20) / 100;
      if (premium && rng() < trap * 0.32) return { type: 'call', amount: legal.callAmount, intent: 'trap', confidence: 0.66, label: '平跟设陷阱' };
      if (rng() < 0.62 + aggression * 0.12) {
        return { type: 'raise', amount: preflopSizing(game, seat, legal, profile, rng, premium), intent: 'value', confidence: 0.78, label: '3bet' };
      }
    }
    if (premium) {
      if (legal.canRaise && rng() < 0.35) return { type: 'raise', amount: preflopSizing(game, seat, legal, profile, rng, true), intent: 'value', confidence: 0.72, label: '3bet' };
      return { type: 'call', amount: legal.callAmount, intent: 'call', confidence: 0.7, label: '跟注' };
    }
    if (strong && potOdds < 0.45) {
      if (legal.canRaise && rng() < 0.18) return { type: 'raise', amount: preflopSizing(game, seat, legal, profile, rng, false), intent: 'semiBluff', confidence: 0.6, label: '3bet' };
      return { type: 'call', amount: legal.callAmount, intent: 'call', confidence: 0.63, label: '跟注' };
    }
    if (inCall && potOdds < 0.38 && stackBB > 14) {
      return { type: 'call', amount: legal.callAmount, intent: 'call', confidence: 0.55, label: '跟注' };
    }
    if (speculative && potOdds < 0.26 && stackBB > 25 && seat.position !== 'SB') {
      return { type: 'call', amount: legal.callAmount, intent: 'speculative', confidence: 0.5, label: '跟注' };
    }
    // 3bet 诈唬：有阻断牌，位置好，频率随画像
    if (canContinue && seat.position !== 'SB' && bluffBase > 0.25 && rng() < bluffBase * 0.32 && (cls[0] === 'A' || cls[2] === 's')) {
      return { type: 'raise', amount: preflopSizing(game, seat, legal, profile, rng, false), intent: 'bluff', confidence: 0.48, label: '3bet诈唬' };
    }
    return { type: 'fold', intent: 'fold', confidence: 0.82, label: '弃牌' };
  }

  function boardInfo(board) {
    if (!board.length) return { texture: 'preflop', wet: 0, paired: false, monotone: false, flushPossible: false, straightPossible: false };
    const suits = [0, 0, 0, 0], ranks = [];
    board.forEach(c => { suits[c & 3]++; ranks.push(c >> 2); });
    const paired = new Set(ranks).size < ranks.length;
    const maxSuit = Math.max.apply(null, suits);
    const sorted = ranks.slice().sort((a, b) => a - b);
    let run = 1, maxRun = 1;
    for (let i = 1; i < sorted.length; i++) { if (sorted[i] === sorted[i - 1] + 1) { run++; maxRun = Math.max(maxRun, run); } else run = 1; }
    const wet = clamp((maxSuit >= 3 ? 0.3 : 0) + (maxRun >= 3 ? 0.28 : 0) + (paired ? 0.12 : 0) + (sorted[sorted.length - 1] - sorted[0] <= 4 ? 0.12 : 0), 0, 1);
    return {
      texture: maxSuit >= 3 ? (maxSuit === 4 ? 'monotone' : 'two-tone') : (paired ? 'paired' : 'rainbow'),
      wet, paired, monotone: maxSuit >= 4, flushPossible: maxSuit >= 3,
      straightPossible: maxRun >= 3, high: sorted[sorted.length - 1]
    };
  }

  function candidatePostflop(game, seat, legal, profile, eq, board, rng) {
    const pot = game._potTotal();
    const toCall = legal.toCall;
    const stack = seat.stack;
    const opps = activeOpponents(game, seat);
    const oppProfiles = opps.map(o => o.isHero ? { stats: { foldCbet: 45, callDown: 50 } } : o.profile);
    const baseCall = { kind: 'call', type: 'call', target: null, extra: Math.min(toCall, stack), amount: Math.min(toCall, stack) };
    const check = { kind: 'check', type: 'check', target: null, extra: 0 };
    const fold = { kind: 'fold', type: 'fold', target: null, extra: 0 };
    const candidates = [];
    const made = E.madeHand(seat.cards, board);
    const draw = E.drawInfo(seat.cards, board);
    const strongMade = made.category >= 3 || eq > 0.67;
    const monster = made.category >= 6 || eq > 0.82;
    const aggression = (profile.strategy && profile.strategy.aggression) || 1;
    const trap = (profile.stats.trap || 20) / 100;
    const bluff = (profile.stats.bluff || 20) / 100;
    const callDown = (profile.stats.callDown || 45) / 100;

    if (toCall > 0) {
      const callEV = eq * (pot + baseCall.extra) - baseCall.extra;
      candidates.push(Object.assign({}, baseCall, { ev: callEV, label: '跟注', eqWhenCalled: eq }));
      candidates.push(Object.assign({}, fold, { ev: 0, label: '弃牌' }));
    } else {
      candidates.push(Object.assign({}, check, { ev: eq * pot, label: '过牌' }));
    }

    if (legal.canRaise) {
      const ratios = game.street === 'river' ? [0.5, 0.75, 1.0, 1.5] : [0.33, 0.5, 0.75, 1.0];
      const seen = new Set();
      ratios.forEach((ratio, i) => {
        let target;
        if (toCall === 0) {
          const raw = Math.max(game.bb, Math.round(pot * ratio));
          target = seat.streetBet + raw;
        } else {
          const raiseBy = Math.max(game.lastRaiseSize, Math.round((pot + toCall) * ratio * 0.8));
          target = game.currentBet + raiseBy;
        }
        target = clamp(target, Math.min(legal.minRaiseTo, legal.maxRaiseTo), legal.maxRaiseTo);
        target = Math.round(target);
        if (target <= game.currentBet || seen.has(target)) return;
        seen.add(target);
        const extra = target - seat.streetBet;
        if (extra <= 0) return;
        const sizeRatio = extra / Math.max(1, pot);
        let fe = 1;
        const actionableOpps = opps.filter(o => !o.allIn);
        actionableOpps.forEach(o => {
          const p = o.isHero ? { stats: { foldCbet: 46, callDown: 50 } } : o.profile;
          fe *= (1 - RangeModel.foldEquity(p, sizeRatio, game.street, 1, toCall > 0));
        });
        if (!actionableOpps.length) fe = 0;
        // 多路底池中，被任意一家跟注后的胜率略降
        const eqCalled = clamp(eq - 0.035 - 0.02 * Math.max(0, opps.length - 1) - (toCall > 0 ? 0.02 : 0), 0.01, 0.99);
        const ev = fe * pot + (1 - fe) * (eqCalled * (pot + 2 * extra) - extra);
        const styleBonus = (aggression - 1) * pot * 0.055 + (monster ? 0.02 : 0) + (draw.outs >= 8 ? 0.02 : 0);
        candidates.push({
          kind: 'raise', type: 'raise', target, extra, ev: ev + styleBonus,
          foldEq: fe, eqWhenCalled: eqCalled, label: toCall === 0 ? '下注' : '加注',
          ratio, intent: eq > 0.62 ? 'value' : (draw.outs >= 8 ? 'semiBluff' : (fe > 0.38 ? 'bluff' : 'bluff'))
        });
      });
      // 全下候选
      const allinTarget = legal.maxRaiseTo;
      if (allinTarget > game.currentBet + game.bb && allinTarget - seat.streetBet > 0) {
        const extra = allinTarget - seat.streetBet;
        const fe = opps.filter(o => !o.allIn).reduce((acc, o) => acc * (1 - RangeModel.foldEquity(o.isHero ? { stats: { foldCbet: 46 } } : o.profile, extra / Math.max(1, pot), game.street, 1, toCall > 0)), 1);
        const eqCalled = clamp(eq - 0.04, 0.01, 0.99);
        const ev = fe * pot + (1 - fe) * (eqCalled * (pot + 2 * extra) - extra);
        candidates.push({ kind: 'allin', type: 'allin', target: allinTarget, extra, ev: ev + (aggression - 1) * pot * 0.04, foldEq: fe, label: '全下', intent: 'pressure' });
      }
    }

    // 陷阱：强牌偶尔过牌/平跟，尤其是高 trap 画像
    if (monster && trap > 0.3 && rng() < trap * 0.25) {
      const idx = candidates.findIndex(c => c.kind === (toCall > 0 ? 'call' : 'check'));
      if (idx >= 0) { candidates[idx].ev += pot * 0.16; candidates[idx].intent = 'trap'; candidates[idx].label = toCall > 0 ? '平跟设陷阱' : '过牌设陷阱'; }
    }
    // 半诈唬：听牌 + 高弃牌率
    if (!strongMade && draw.outs >= 7 && aggression > 0.8) {
      candidates.forEach(c => { if (c.kind === 'raise') c.ev += pot * 0.05; });
    }
    // 跟注站：减少诈唬，增加抓诈
    if (!strongMade && toCall > 0) {
      candidates.forEach(c => { if (c.kind === 'call' && eq > 0.28) c.ev += pot * (callDown - 0.45) * 0.15; });
    }
    return { candidates, made, draw, boardInfo: boardInfo(board), oppProfiles };
  }

  function chooseCandidate(candidates, profile, eq, rng, pot, game, street) {
    if (!candidates.length) return null;
    const aggression = (profile.strategy && profile.strategy.aggression) || 1;
    const bluff = (profile.stats.bluff || 20) / 100;
    candidates.forEach(c => {
      if (c.kind === 'raise' || c.kind === 'allin') {
        c.adjusted = c.ev + (aggression - 1) * pot * 0.04 + (c.intent === 'bluff' ? bluff * pot * 0.05 : 0) + (rng() - 0.5) * pot * 0.05;
      } else if (c.kind === 'fold') {
        c.adjusted = c.ev + (1 - aggression) * pot * 0.01;
      } else if (c.kind === 'call') {
        c.adjusted = c.ev + (rng() - 0.5) * pot * 0.04;
      } else {
        c.adjusted = c.ev + (rng() - 0.5) * pot * 0.025;
      }
    });
    candidates.sort((a, b) => b.adjusted - a.adjusted);
    const best = candidates[0];
    // 混合频率：接近的选项有 15%-30% 概率被选中
    const near = candidates.slice(1).filter(c => c.adjusted > best.adjusted - pot * 0.07);
    if (near.length && rng() < 0.16 + bluff * 0.12) {
      return near[Math.floor(rng() * near.length)];
    }
    return best;
  }

  function decide(game, seatIndex) {
    const seat = game.seats[seatIndex];
    const legal = game.legalActions(seatIndex);
    if (!legal) return null;
    const profile = seat.profile || { stats: { vpip: 25, pfr: 19, threeBet: 7, foldCbet: 46, callDown: 50, bluff: 24, trap: 22 }, strategy: { aggression: 1 } };
    const rng = makeRng(game, seat);
    const ranges = rangesFor(game, seat);
    const iterations = game.board.length === 0 ? 2400 : 2200;
    const eq = calcEquity(game, seat, ranges, iterations);
    const ctx = { equity: eq, ranges };
    const made = game.board.length >= 3 ? E.madeHand(seat.cards, game.board) : null;
    const draw = game.board.length >= 3 ? E.drawInfo(seat.cards, game.board) : null;
    const bi = boardInfo(game.board);
    let decision;
    if (game.street === 'preflop') {
      decision = preflopDecision(game, seat, legal, ctx);
    } else {
      const c = candidatePostflop(game, seat, legal, profile, eq.equity, game.board, rng);
      const pick = chooseCandidate(c.candidates, profile, eq.equity, rng, game._potTotal(), game, game.street);
      decision = {
        type: pick.type, amount: pick.target || pick.amount, target: pick.target || null,
        intent: pick.intent || (pick.kind === 'call' ? 'call' : pick.kind === 'fold' ? 'fold' : 'value'),
        confidence: pick.foldEq == null ? 0.62 : clamp(0.45 + pick.foldEq * 0.3 + eq.equity * 0.2, 0.3, 0.9),
        label: pick.label || pick.kind, ev: pick.ev, foldEq: pick.foldEq || 0,
        made: made, draw: draw, boardInfo: bi
      };
      // 极小概率的“创意线路”：强牌过牌，弱牌小额试探
      if (made && made.category >= 5 && game.street === 'river' && rng() < 0.06 && legal.toCall === 0 && legal.canCheck) {
        decision = { type: 'check', intent: 'trap', confidence: 0.58, label: '过牌设陷阱', made, draw, boardInfo: bi };
      }
      if ((profile.strategy.preferred || []).includes('过牌加注') && legal.toCall === 0 && draw.outs >= 8 && rng() < 0.1) {
        decision = { type: 'check', intent: 'trap', confidence: 0.5, label: '过牌埋伏', made, draw, boardInfo: bi };
      }
    }
    // 合法性兜底
    if (decision.type === 'check' && !legal.canCheck) decision = { type: 'fold', intent: 'fold', label: '弃牌', confidence: 0.7 };
    if (decision.type === 'call' && !legal.canCall) decision = { type: 'check', intent: 'check', label: '过牌', confidence: 0.6 };
    if (decision.type === 'raise' && !legal.canRaise) decision = legal.canCall ? { type: 'call', amount: legal.callAmount, intent: 'call', label: '跟注', confidence: 0.6 } : { type: 'fold', intent: 'fold', label: '弃牌', confidence: 0.7 };
    if (decision.type === 'raise') {
      decision.amount = clamp(decision.amount || decision.target, Math.min(legal.minRaiseTo, legal.maxRaiseTo), legal.maxRaiseTo);
    }
    // 思考时间与台词
    const patience = profile.stats.patience || 55;
    decision.thinkingMs = Math.round(650 + rng() * 700 + (equityComplexity(game, decision) ? 450 : 0) + (patience - 50) * 6);
    decision.thinkingMs = clamp(decision.thinkingMs, 450, 3200);
    decision.reasoning = buildReasoning(game, seat, legal, decision, eq, ranges, bi, made, draw);
    decision.thought = buildThought(game, seat, decision, rng);
    decision.equity = eq.equity;
    decision.rangeCount = ranges.length;
    decision.ranges = ranges.map(r => ({ name: r.seat.name, pct: RangeModel.rangePercent(r.range), top: RangeModel.summary(r.range, game.board, 3).label }));
    return decision;
  }

  function equityComplexity(game, d) {
    return game.street === 'river' || d.type === 'raise' || d.type === 'allin';
  }

  function buildThought(game, seat, d, rng) {
    const p = seat.profile;
    const lines = [
      '他盯着牌面，手指轻轻敲着桌面。',
      '他看了看自己的筹码，又看了看你。',
      '他往后靠了靠，像是在重新计算。',
      '他停顿了两秒，拿起筹码又放下。',
      '他低声说了一句什么，然后把筹码推了出来。',
      '他很快地敲了敲桌子。'
    ];
    if (d.type === 'fold') lines.push('他把牌轻轻推向荷官。', '他摇了摇头，选择了放弃。');
    if (d.type === 'raise' || d.type === 'allin') lines.push('他把筹码往前一推，动作很干脆。', '他数出一摞筹码，慢慢推入底池。');
    if (p && p.stats.patience > 75) lines.push('他等了很久，似乎在等一个确切的信号。');
    if (p && p.stats.bluff > 38) lines.push('他嘴角微微上扬，像是很享受这个时刻。');
    return lines[Math.floor(rng() * lines.length)];
  }

  function buildReasoning(game, seat, legal, d, eq, ranges, bi, made, draw) {
    const pot = game._potTotal();
    const potOdds = legal.toCall > 0 ? legal.toCall / (pot + legal.toCall) : 0;
    const rangeText = ranges.length ? ranges.map(r => r.seat.name + ' ' + (RangeModel.rangePercent(r.range) * 100).toFixed(0) + '%').join('，') : '无对手';
    const parts = [];
    parts.push('位置' + (seat.position || '') + '，有效筹码' + (seat.stack / game.bb).toFixed(0) + 'BB');
    parts.push('估计对手范围：' + rangeText);
    parts.push('当前胜率约' + (eq.equity * 100).toFixed(1) + '%');
    if (legal.toCall > 0) parts.push('底池赔率需要' + (potOdds * 100).toFixed(1) + '%');
    if (made) parts.push('成牌：' + made.text);
    if (draw && draw.outs > 0) parts.push('听牌：约' + draw.outs + '张补牌');
    if (d.type === 'raise' || d.type === 'allin') parts.push('选择施压，利用弃牌率与范围优势');
    else if (d.type === 'call') parts.push('赔率合适，选择继续');
    else if (d.type === 'fold') parts.push('赔率与范围不支持继续，弃牌止损');
    return parts.join('；') + '。';
  }

  PM.AI = {
    decide, activeOpponents, rangesFor, calcEquity, boardInfo,
    candidatePostflop, preflopDecision, foldEquity: RangeModel.foldEquity
  };
})(typeof window !== 'undefined' ? window : globalThis);

