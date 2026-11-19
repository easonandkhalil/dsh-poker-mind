/* 德州心法 · 实时教练
 * 每一步给出：胜率、范围、赔率、补牌、筹码/位置/画像，以及 EV 最优解与替代线路。
 * 新手模式：实时展开；专家模式：牌局中隐藏，牌局后复盘。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};
  const Cards = PM.Cards, E = PM.Evaluator, Ranges = PM.Ranges, Equity = PM.Equity;
  const RangeModel = PM.RangeModel, Charts = PM.Charts, AI = PM.AI;

  const POSITION_TEXT = {
    UTG: '枪口位，全场最早行动，后面还有很多人没有表态，应该最紧。',
    HJ: '劫位，位置偏早，适合用强牌和高质量同花连张入池。',
    CO: '关煞位，位置不错，可以在按钮位之前扩大攻击范围。',
    BTN: '按钮位，翻后最后行动，信息优势最大，可以打得更宽、更主动。',
    SB: '小盲位，翻后永远先行动，位置最差；应该减少平跟，多用加注或弃牌。',
    BB: '大盲位，已经投入盲注，防守赔率好，但翻后位置差，要避免打太大的底池。'
  };
  const GRADE_COLORS = { '最佳': '#5ee0a0', '合理': '#a6e36f', '略亏': '#ffd166', '失误': '#ff9f43', '严重失误': '#ff5c75' };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function fmtPct(x) { return (x * 100).toFixed(1) + '%'; }
  function fmtBB(chips, bb) { return (chips / bb).toFixed(1); }
  function cardCN(c) { return Cards.cardSymbol(c); }
  function holeText(cards) { return cards.map(cardCN).join(' '); }

  function activeOpponents(game, hero) {
    return game.seats.filter(s => !s.folded && s.index !== hero.index);
  }

  function heroModelProfile(hero, game) {
    const hs = game.heroStats || {};
    return {
      id: 'hero', name: '你',
      stats: {
        vpip: hs.vpip == null ? 28 : hs.vpip, pfr: hs.pfr == null ? 20 : hs.pfr,
        threeBet: hs.threeBet == null ? 7 : hs.threeBet,
        foldCbet: hs.foldToCbet == null ? 47 : hs.foldToCbet,
        callDown: 50, bluff: 24, cbet: 62, af: 2.2,
        trap: 24, adapt: 60, patience: 60, tilt: 10
      },
      strategy: { aggression: 1, openWidth: 1, sizing: 'balanced' }
    };
  }

  function estimateHeroEquity(game, hero, opps, iterations) {
    if (!opps.length) return { equity: 1, win: 1, tie: 0, lose: 0, samples: 0, ci: 0, exact: false, opponents: 0, confidence: '确定' };
    const known = hero.cards.concat(game.board);
    const ranges = opps.map(o => RangeModel.estimate(game, o, known)).filter(r => r.length > 0);
    if (!ranges.length) return { equity: 1, win: 1, tie: 0, lose: 0, samples: 0, ci: 0, exact: false, opponents: opps.length, confidence: '确定' };
    return Equity.equity({
      hero: hero.cards, board: game.board, ranges,
      iterations: iterations || (game.board.length === 0 ? 3200 : 3000),
      seed: Cards.hashString([game.config.seed, game.handNo, game.actions.length, 'coach'].join(':'))
    });
  }

  function foldEquityAgainst(game, hero, target, isRaise) {
    const pot = game._potTotal();
    const extra = target - hero.streetBet;
    const sizeRatio = extra / Math.max(1, pot);
    const opps = activeOpponents(game, hero).filter(o => !o.allIn);
    if (!opps.length) return 0;
    let fe = 1;
    opps.forEach(o => {
      const profile = o.isHero ? { stats: { foldCbet: 46, callDown: 50 } } : o.profile;
      fe *= (1 - RangeModel.foldEquity(profile, sizeRatio, game.street, 1, isRaise));
    });
    return clamp(fe, 0, 0.95);
  }

  // 全下不是“胜率高就最大”的按钮。翻后深筹码只有这些情况才把全下放进候选：
  // 低 SPR、坚果级成牌、或有效筹码相对底池已经很短。这样避免把 60% 的胜率
  // 直接翻译成“全下最优”，忽略对手跟注范围会收紧、后续街还有决策空间。
  function allInEligible(game, hero, eq, made, spr, legal, pot, bb) {
    if (!legal || !legal.canRaise) return false;
    const jam = legal.maxRaiseTo;
    const extra = jam - hero.streetBet;
    if (extra <= 0) return false;
    if (game.street === 'preflop') {
      // 翻前只有短码才考虑全下；100BB 深筹码不因为“胜率过半”自动推。
      return spr <= 6 && eq.equity >= 0.62;
    }
    const cat = made ? made.category : -1;
    if (spr <= 2.6) return eq.equity >= 0.52 || cat >= 2;
    if (spr <= 4.0 && eq.equity >= 0.74 && cat >= 3) return true;
    if (spr <= 5.5 && eq.equity >= 0.84 && cat >= 5) return true;
    // 短码：全下相对底池不算超池太多，才允许。
    if (extra <= Math.max(pot * 1.35, bb * 14) && eq.equity >= 0.62) return true;
    return false;
  }

  function calledEquity(eq, game, hero, extra, made, isAllIn) {
    const pot = game._potTotal();
    const pressure = clamp(Math.log(1 + extra / Math.max(1, pot)) / Math.log(8), 0, 1);
    let penalty = 0.016 + pressure * 0.085;
    if (game.street !== 'river') penalty += 0.008;
    if (isAllIn) penalty += 0.045;
    const n = activeOpponents(game, hero).length;
    penalty += Math.max(0, n - 1) * 0.022;
    if (made && made.category >= 6) penalty *= 0.45;
    else if (made && made.category >= 4) penalty *= 0.65;
    else if (made && made.category >= 2) penalty *= 0.82;
    return clamp(eq.equity - penalty, 0.02, 0.98);
  }

  function realizationFactor(game, hero, made, draw) {
    if (game.street === 'river') return 1;
    let f = 0.96;
    if (['BTN', 'CO'].includes(hero.position)) f += 0.025;
    else if (['SB', 'BB'].includes(hero.position)) f -= 0.02;
    if (made && made.category >= 3) f += 0.015;
    if (draw && draw.outs >= 8) f += 0.02;
    if (game.street === 'turn') f -= 0.01;
    return clamp(f, 0.86, 1.02);
  }

  function evOfOption(game, hero, eq, type, target, made, draw) {
    const pot = game._potTotal();
    const toCall = Math.max(0, game.currentBet - hero.streetBet);
    const legal = game.legalActions(hero.index);
    if (!legal) return 0;
    if (type === 'fold') return 0;
    const real = realizationFactor(game, hero, made, draw);
    if (type === 'check') return clamp(eq.equity * real, 0, 0.985) * pot;
    if (type === 'call') {
      const call = Math.min(toCall, hero.stack);
      return clamp(eq.equity * real, 0, 0.985) * (pot + call) - call;
    }
    if (type === 'raise' || type === 'allin') {
      let t = type === 'allin' ? legal.maxRaiseTo : target;
      t = clamp(t, Math.min(legal.minRaiseTo, legal.maxRaiseTo), legal.maxRaiseTo);
      const extra = t - hero.streetBet;
      if (extra <= 0) return evOfOption(game, hero, eq, 'call', null, made, draw);
      let fe = foldEquityAgainst(game, hero, t, game.currentBet > 0);
      if (type === 'allin') fe = Math.min(fe, 0.78);
      const eqCalled = calledEquity(eq, game, hero, extra, made, type === 'allin');
      const n = activeOpponents(game, hero).length;
      // 不假设“所有对手都会跟”。按一个跟注者为主，多人时加一点期望，
      // 但不把多人底池当成白送的 double-up。
      const callers = 1 + Math.max(0, n - 1) * 0.35;
      return fe * pot + (1 - fe) * (eqCalled * (pot + extra * (1 + callers)) - extra);
    }
    return 0;
  }

  function buildOptions(game, hero, eq, made, draw) {
    const legal = game.legalActions(hero.index);
    const pot = game._potTotal();
    const bb = game.bb;
    const spr = pot > 0 ? hero.stack / pot : 0;
    const options = [];
    if (legal.toCall > 0) options.push({ type: 'fold', label: '弃牌', amount: 0, ev: 0, kind: 'fold', risk: 0 });
    if (legal.canCheck) options.push({ type: 'check', label: '过牌', amount: 0, ev: evOfOption(game, hero, eq, 'check', null, made, draw), kind: 'check', risk: 0 });
    if (legal.canCall) {
      const call = Math.min(legal.toCall, hero.stack);
      options.push({ type: 'call', label: '跟注 ' + call, amount: call, ev: evOfOption(game, hero, eq, 'call', null, made, draw), kind: 'call', risk: 0 });
    }
    if (legal.canRaise) {
      const sizes = [];
      if (game.street === 'preflop') {
        if (game.currentBet <= bb) {
          sizes.push(Math.round(bb * 2.5), Math.round(bb * 3), Math.round(bb * 4));
        } else {
          sizes.push(Math.round(game.currentBet + Math.max(game.lastRaiseSize, bb) * 2.6));
          sizes.push(Math.round(game.currentBet + Math.max(game.lastRaiseSize, bb) * 3.6));
        }
      } else {
        // 翻后默认只用 1/3、1/2、3/4、1 池；深筹码不再把 1.5 池当常规尺度。
        [0.33, 0.5, 0.75, 1.0].forEach(r => {
          const raw = game.currentBet === 0 ? Math.max(bb, Math.round(pot * r)) : Math.round(game.currentBet + Math.max(game.lastRaiseSize, (pot + game.currentBet) * r * 0.65));
          sizes.push(Math.max(raw, Math.min(legal.minRaiseTo, legal.maxRaiseTo)));
        });
        if (spr < 3.2) sizes.push(Math.round(pot * 1.25));
      }
      const seen = new Set();
      sizes.forEach(t => {
        t = clamp(t, Math.min(legal.minRaiseTo, legal.maxRaiseTo), legal.maxRaiseTo);
        t = Math.round(t);
        if (t <= game.currentBet || seen.has(t)) return;
        seen.add(t);
        const extra = t - hero.streetBet;
        const fe = foldEquityAgainst(game, hero, t, game.currentBet > 0);
        const ev = evOfOption(game, hero, eq, 'raise', t, made, draw);
        options.push({
          type: 'raise', label: (game.currentBet === 0 ? '下注 ' : '加注到 ') + t,
          amount: t, target: t, extra, ev,
          kind: 'raise', foldEq: fe,
          risk: Math.min(bb * 0.02, pot * 0.01)
        });
      });
      const allin = legal.maxRaiseTo;
      if (allInEligible(game, hero, eq, made, spr, legal, pot, bb) && allin > game.currentBet && allin - hero.streetBet > bb * 2 && allin > Math.min(legal.minRaiseTo, legal.maxRaiseTo) + bb) {
        const extra = allin - hero.streetBet;
        options.push({
          type: 'allin', label: '全下 ' + allin, amount: allin, target: allin,
          extra, ev: evOfOption(game, hero, eq, 'allin', null, made, draw),
          kind: 'allin', foldEq: Math.min(foldEquityAgainst(game, hero, allin, game.currentBet > 0), 0.78),
          risk: Math.min(bb * 0.18, pot * 0.06)
        });
      }
    }
    options.forEach(o => { o.evBB = +(o.ev / bb).toFixed(2); });
    return options;
  }

  function bestOption(options) {
    const valid = options.filter(o => o.type !== 'fold' || options.some(x => x.type !== 'fold'));
    let best = valid[0];
    // 用“EV - 风险惩罚”选最优；全下只有在明显更好时才压过可控尺度。
    valid.forEach(o => {
      const score = o.ev - (o.risk || 0);
      const bestScore = best.ev - (best.risk || 0);
      if (score > bestScore + 1e-9) best = o;
    });
    // 若最优是弃牌，但过牌也是 0 EV，优先过牌
    if (best && best.type === 'fold') {
      const check = valid.find(o => o.type === 'check' && o.ev >= best.ev - 0.5);
      if (check) best = check;
    }
    return best;
  }

  function gradeFromLoss(lossBB) {
    if (lossBB <= 0.08) return { label: '最佳', score: 100, color: GRADE_COLORS['最佳'] };
    if (lossBB <= 0.45) return { label: '合理', score: Math.round(96 - lossBB * 8), color: GRADE_COLORS['合理'] };
    if (lossBB <= 1.4) return { label: '略亏', score: Math.round(88 - lossBB * 10), color: GRADE_COLORS['略亏'] };
    if (lossBB <= 3.2) return { label: '失误', score: Math.round(68 - lossBB * 6), color: GRADE_COLORS['失误'] };
    return { label: '严重失误', score: Math.round(Math.max(8, 42 - lossBB * 3)), color: GRADE_COLORS['严重失误'] };
  }

  function buildPlan(game, hero, best, eq, opps, drawInfo) {
    const streetIdx = { preflop: 0, flop: 1, turn: 2, river: 3 }[game.street] || 0;
    if (streetIdx === 3) {
      if (best.type === 'raise' || best.type === 'allin') return '河牌是最后一条街：下注拿薄价值，或者用阻断牌诈唬。被加注时，先问自己：他有没有足够的诈唬组合？没有，就放掉。';
      return '河牌没有后续街：以摊牌价值和阻断牌为核心。中等牌力别为大注买单，除非对手的诈唬故事讲不通。';
    }
    if (best && (best.type === 'raise' || best.type === 'allin') && eq.equity < 0.5 && (best.foldEq || 0) >= 0.3) return '诈唬线：这不是价值下注，而是利用对手弃牌率偷池。只在有位置、对手容易弃牌、且你有阻断牌时使用；被跟注就停手，别把诈唬变成送钱。';
    if (eq.equity > 0.7) return '强价值线：下注 50% 到 75% 底池，让更差的牌跟上来。被加注再评估，不要因为“领先”就自动把全部筹码推出去。';
    if (drawInfo && drawInfo.outs >= 8) return '半诈唬线：下注 1/3 到 1/2 池施压；转牌没到就减速。跟注时算隐含赔率，别把听牌当成已经成牌。';
    if (eq.equity > 0.45) return '中等牌力：过牌或跟注，控制底池。别用一对打光，后面的街还长。';
    return '弱牌：减少投入。没有弃牌率就放弃，别为了“看看”而支付大注。';
  }

  function sizeWord(extra, pot) {
    if (!extra) return '';
    const r = extra / Math.max(1, pot);
    if (r < 0.22) return '小注';
    if (r < 0.42) return '三分之一个底池';
    if (r < 0.62) return '半个底池';
    if (r < 0.85) return '三分之二个底池';
    if (r < 1.15) return '一个底池';
    return '大注';
  }

  function advise(game, seatIndex) {
    const hero = game.seats[seatIndex];
    if (!hero || game.phase !== 'betting' || game.actingIndex !== seatIndex) return null;
    const legal = game.legalActions(seatIndex);
    if (!legal) return null;
    const opps = activeOpponents(game, hero);
    const eq = estimateHeroEquity(game, hero, opps);
    const pot = game._potTotal();
    const bb = game.bb;
    const toCall = Math.max(0, game.currentBet - hero.streetBet);
    const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    const mdf = toCall > 0 ? Math.max(0, (pot - toCall) / pot) : null;
    const made = game.board.length >= 3 ? E.madeHand(hero.cards, game.board) : null;
    const draw = game.board.length >= 3 ? E.drawInfo(hero.cards, game.board) : { outs: 0, labels: [], flushDraw: false, openEnded: false, gutshot: false, overcards: 0 };
    const bi = AI.boardInfo(game.board);
    const effStack = hero.stack;
    const spr = pot > 0 ? effStack / pot : 0;
    const options = buildOptions(game, hero, eq, made, draw);
    const best = bestOption(options);
    const isBluffRaise = !!best && (best.type === 'raise' || best.type === 'allin') && eq.equity < 0.5 && (best.foldEq || 0) > 0.3;
    const alt = options.slice().sort((a, b) => (b.ev - (b.risk || 0)) - (a.ev - (a.risk || 0))).filter(o => o !== best).slice(0, 2);
    const cls = Cards.handClass(hero.cards[0], hero.cards[1]);
    const chen = Ranges.chen(hero.cards);
    const position = hero.position;
    const posNote = POSITION_TEXT[position] || '';
    const inPosition = ['BTN', 'CO'].includes(position) || (game.n <= 3 && position === 'BTN');
    const oppSummaries = opps.map(o => {
      const range = RangeModel.estimate(game, o, hero.cards.concat(game.board));
      const sum = RangeModel.summary(range, game.board, 5);
      return {
        index: o.index, name: o.name, avatar: o.avatar, position: o.position,
        stackBB: +(o.stack / bb).toFixed(1), profile: o.profile,
        rangePct: sum.pct, rangeTop: sum.top, rangeLabel: sum.label,
        isHero: !!o.isHero, style: o.profile ? o.profile.styleCN : '你',
        exploit: o.profile ? o.profile.exploit : []
      };
    });
    const tags = [];
    if (made && made.category >= 4) tags.push('强成牌');
    if (draw.outs >= 8) tags.push('强听牌');
    if (toCall > 0 && eq.equity < potOdds) tags.push('赔率不足');
    if (toCall > 0 && eq.equity > potOdds + 0.15) tags.push('赔率有利');
    if (inPosition) tags.push('位置有利');
    else tags.push('位置不利');
    if (spr < 2.5) tags.push('低SPR');
    if (spr > 8) tags.push('深筹码');
    if (opps.some(o => o.profile && o.profile.stats.foldCbet > 58)) tags.push('对手易弃牌');
    if (opps.some(o => o.profile && o.profile.stats.callDown > 70)) tags.push('对手爱跟注');
    if (best.type === 'raise' || best.type === 'allin') {
      if (eq.equity < 0.5 && eq.equity < potOdds && (best.foldEq || 0) > 0.3) tags.push('诈唬线');
      else tags.push(best.foldEq > 0.35 ? '弃牌率支持' : '价值施压');
    }
    if (best.type === 'fold') tags.push('及时止损');
    if (best.type === 'check' || best.type === 'call') tags.push('控制底池');

    const bestSize = best.extra ? (game.street === 'preflop' ? (best.amount / bb).toFixed(1) + 'BB' : sizeWord(best.extra, pot)) : '';
    const betterText = best.type === 'fold' ? '弃牌。现在的价格不划算，把筹码留给更好的机会。' :
      best.type === 'check' ? '过牌。先免费看一张，把底池控制住，转牌再决定。' :
      best.type === 'call' ? ('跟注 ' + best.amount + '。' + (draw.outs >= 8 ? '用听牌继续，但没到牌时不会再加注。' : '只跟注，先把底池控制住。')) :
      best.type === 'raise' ? (best.label + '（' + bestSize + '）。' + (isBluffRaise ? '这是诈唬，不是跟注；靠对手弃牌，被跟注就停手。' : eq.equity > 0.62 ? '拿价值，同时给自己留被加注后弃牌的空间。' : '代表强牌施压，被加注就放弃。')) :
      '全下。只有在筹码浅、范围支持时，这才是合理选择。';
    const optionLines = options.slice().sort((a, b) => b.ev - a.ev).slice(0, 4).map(o => ({
      label: o.label, evBB: o.evBB, type: o.type,
      note: o.type === 'raise' || o.type === 'allin' ? ('弃牌率约 ' + Math.round((o.foldEq || 0) * 100) + '%') :
        o.type === 'call' ? ('需要 ' + fmtPct(potOdds) + ' 胜率') :
        o.type === 'check' ? '免费摊牌/看牌' : '亏损最小化'
    }));

    const requiredEq = toCall > 0 ? potOdds : 0;
    const equityEdge = toCall > 0 ? eq.equity - requiredEq : eq.equity;
    const rangeAdvantage = eq.equity > 0.56 ? '你在这块牌面上的整体胜率高于对手范围，拥有范围优势。' : eq.equity < 0.42 ? '对手范围整体强于你，应该更谨慎地控制底池。' : '双方范围比较接近，位置和尺度是主要优势。';

    const beginner = [
      { title: '位置', text: posNote + ' 你现在在 ' + position + '。' + (inPosition ? '后面还有人没行动，你可以先看他们的反应再决定，这是位置带来的优势。' : '前面已经有人行动，你拿不到信息优势，牌力要求要更严。') },
      { title: '对手范围', text: oppSummaries.length ? ('对手不会亮着牌打。根据他们翻前的动作，我大致把范围收在这些组合：' + oppSummaries.map(o => o.name + '（' + o.style + '）约 ' + fmtPct(o.rangePct) + '，强牌有 ' + (o.rangeLabel || '—')).join('；') + '。范围是估计，不是精确答案；他们下注尺度一变，范围也要跟着变。') : '没有仍在牌局中的对手。' },
      { title: '赔率', text: toCall > 0 ? ('跟注 ' + toCall + '，底池 ' + pot + '。你需要的盈亏平衡胜率是 ' + fmtPct(requiredEq) + '。你估计自己有 ' + fmtPct(eq.equity) + '，' + (equityEdge > 0 ? '数学上够，但还要扣掉后面街被反超、被诈唬的成本。' : isBluffRaise ? '跟注本身不划算；教练建议的是诈唬加注，靠对手弃牌，不是靠摊牌。' : '低于这个价格，别硬跟。')) : '现在没人下注，你可以免费过牌。但免费不等于没有成本：过牌会让对手实现他们的权益。' },
      { title: '补牌', text: draw.outs > 0 ? ('你约有 ' + draw.outs + ' 张补牌（' + (draw.labels.join('、') || '组合听牌') + '）。翻牌圈粗略按每张 4% 算，转牌圈按 2% 算；实际还要扣掉对手手里的牌和公对风险。') : '目前没有明显的强听牌，主要看成牌强度和弃牌率。' },
      { title: '筹码与SPR', text: '有效筹码 ' + fmtBB(effStack, bb) + 'BB，底池 ' + fmtBB(pot, bb) + 'BB，SPR 约 ' + spr.toFixed(1) + '。' + (spr < 3 ? 'SPR 低，强牌可以考虑打光；中等牌力仍然要小心。' : spr > 8 ? 'SPR 高，别用一对把 100BB 送进去；这手更适合 2–3 条街的小底池。' : 'SPR 中等，下注尺度要给转牌和河牌留空间。') },
      { title: '对手画像', text: oppSummaries.map(o => o.name + '：' + (o.profile ? ('技术 ' + '★'.repeat(o.profile.skill) + '，' + o.profile.styleCN + '。' + ((o.exploit || [])[0] || '保持平衡。')) : '')).join(' ') || '—' },
      { title: '教练计划', text: buildPlan(game, hero, best, eq, opps, draw) }
    ];

    const allInInOptions = options.some(o => o.type === 'allin');
    const expert = [
      { title: '范围优势 vs 坚果优势', text: rangeAdvantage + ' 当前组合胜率 ' + fmtPct(eq.equity) + '（±' + fmtPct(eq.ci || 0) + '，' + eq.samples + ' 次模拟' + (eq.exact ? '，河牌精确枚举' : '') + '）。' },
      { title: 'EV 分解', text: '以下 EV 已按可实现权益和对手跟注范围收紧做过调整；排序还会再扣风险惩罚：' + optionLines.map(l => l.label + '：' + l.evBB + 'BB（' + l.note + '）').join('；') + '。' },
      { title: '全下门槛', text: allInInOptions ? ('这次全下进入候选：SPR 约 ' + spr.toFixed(1) + '，有效筹码 ' + fmtBB(effStack, bb) + 'BB，底池 ' + fmtBB(pot, bb) + 'BB。但“能全下”不等于“应该全下”，最终仍按风险调整后的分数比较。') : ('这次全下没有进入候选：SPR 约 ' + spr.toFixed(1) + '，牌力等级 ' + (made ? made.name : '未成牌') + '。教练不会因为胜率过半就建议推光；深筹码更常用 1/3 到 3/4 池的尺度，把决策留到下一街。') },
      { title: '底池数学', text: '跟注需要 ' + fmtPct(requiredEq) + ' 权益，MDF 约 ' + (mdf == null ? '—' : fmtPct(mdf)) + '。对手下注尺度对应的诈唬盈亏平衡点约为 ' + (toCall > 0 ? fmtPct(toCall / (pot + toCall)) : '—') + '。' },
      { title: '阻断牌与组合', text: '你的底牌 ' + holeText(hero.cards) + ' 会阻挡对手范围中的部分强组合；这会影响诈唬频率和抓诈选择。' + (bi.wet > 0.55 ? '牌面湿润，听牌组合多，极化下注更有意义。' : '牌面较干，范围优势更容易转化为小尺度持续下注。') },
      { title: '剥削点', text: oppSummaries.map(o => o.name + '：' + ((o.exploit && o.exploit[0]) || '保持平衡')).join(' ') || '—' }
    ];

    const priceLine = toCall > 0 ? ('底池赔率 ' + fmtPct(potOdds) + '，估算胜率 ' + fmtPct(eq.equity) + '，' + (equityEdge > 0 ? '有正期望，但要扣掉后续街的风险。' : '低于盈亏平衡点。')) : ('免费过牌，估算胜率 ' + fmtPct(eq.equity) + '。');
    const headline = best.type === 'fold' ? '这手我弃牌。现在的价格不划算，把筹码留给更好的机会。' :
      best.type === 'check' ? '这手先过牌。现在没理由把一个小底池，变成后面的大麻烦。' :
      best.type === 'call' ? ('这手我跟注。' + (draw.outs >= 8 ? '用听牌继续，但没到牌时不会再加注。' : '只跟注，先把底池控制住。')) :
      best.type === 'allin' ? '这里可以全下。筹码浅、范围也支持，才值得把牌打光。' :
      isBluffRaise ? ('这手我会' + best.label + '，做一个诈唬。不是跟注；被跟注就停手。') :
      ('这手我会' + best.label + '。' + (eq.equity > 0.62 ? '拿价值，同时给自己留退路。' : '代表强牌施压，被加注就放弃。'));

    // 语音按“线路”而不是整手只播一次。语气文件本身是短句，文案由 headline 承担。
    let voiceKey = 'line_check';
    if (best.type === 'fold') voiceKey = 'line_fold';
    else if (best.type === 'call') voiceKey = draw.outs >= 8 ? 'line_call_draw' : 'line_call';
    else if (best.type === 'raise') voiceKey = eq.equity >= 0.62 ? 'line_raise_value' : 'line_raise';
    else if (best.type === 'allin') voiceKey = 'line_allin';

    const advice = {
      heroCards: hero.cards.slice(), handClass: cls, chen, position, street: game.street,
      pot, potBB: +(pot / bb).toFixed(1), toCall, potOdds, requiredEquity: requiredEq,
      equity: eq.equity, equityCI: eq.ci, equityExact: eq.exact, samples: eq.samples,
      win: eq.win, tie: eq.tie, lose: eq.lose, mdf, spr, effectiveStackBB: +(effStack / bb).toFixed(1),
      made, draw, boardInfo: bi, outs: draw.outs, outLabels: draw.labels,
      options, best, alternatives: alt, optionLines, oppSummaries,
      headline, betterLine: betterText, beginner, expert, tags, rangeAdvantage, plan: buildPlan(game, hero, best, eq, opps, draw),
      priceLine, confidence: eq.samples >= 5000 ? '高' : eq.samples >= 2500 ? '中' : '低',
      chartClass: cls, inPosition, voiceKey, voiceText: headline,
      _ctx: {
        equity: eq.equity, pot, toCall, currentBet: game.currentBet, lastRaiseSize: game.lastRaiseSize,
        streetBet: hero.streetBet, stack: hero.stack, bb, street: game.street,
        opponents: opps.map(o => ({ isHero: o.isHero, allIn: o.allIn, profile: o.isHero ? null : { stats: o.profile.stats } })),
        legal: { minRaiseTo: legal.minRaiseTo, maxRaiseTo: legal.maxRaiseTo },
        options: options.map(o => ({ type: o.type, amount: o.amount, target: o.target, ev: o.ev, risk: o.risk || 0 }))
      },
      createdAt: Date.now()
    };
    // 不把私有上下文暴露给 JSON 序列化以外的 UI 逻辑，但保留给评分
    return advice;
  }

  function gradeChosen(advice, chosenType, chosenAmount) {
    if (!advice) return { label: '—', score: 0, lossBB: 0, note: '' };
    const ctx = advice._ctx;
    const best = advice.best;
    let chosen = null;
    if (chosenType === 'raise' || chosenType === 'allin') {
      const target = chosenType === 'allin' ? ctx.legal.maxRaiseTo : chosenAmount;
      chosen = advice.options.find(o => (o.type === 'raise' || o.type === 'allin') && Math.abs((o.target || o.amount) - target) <= 1);
      if (!chosen) {
        // 用线性近似：取最接近的下注尺度 EV
        const rs = advice.options.filter(o => o.type === 'raise' || o.type === 'allin');
        if (rs.length) {
          const close = rs.reduce((a, b) => Math.abs((b.target || b.amount) - target) < Math.abs((a.target || a.amount) - target) ? b : a);
          chosen = Object.assign({}, close, { target: target, label: (ctx.currentBet === 0 ? '下注 ' : '加注到 ') + target });
        }
      }
    } else {
      chosen = advice.options.find(o => o.type === chosenType);
    }
    if (!chosen) return { label: '—', score: 0, lossBB: 0, note: '' };
    // 评分也用“EV - 风险惩罚”，否则全下的原始 EV 高一点就会被判成最佳。
    const bestScore = best ? best.ev - (best.risk || 0) : 0;
    const chosenScore = chosen.ev - (chosen.risk || 0);
    const loss = Math.max(0, bestScore - chosenScore);
    const lossBB = loss / ctx.bb;
    const grade = gradeFromLoss(lossBB);
    const better = best && best.type !== chosen.type ? ('更优解：' + best.label + '（风险调整后高 ' + (lossBB).toFixed(2) + 'BB）。') :
      (lossBB > 0.08 ? ('尺度可以更优：' + (best ? best.label : '') + '。') : '这条线路与教练建议一致。');
    return {
      label: grade.label, score: grade.score, color: grade.color, lossBB: +lossBB.toFixed(2),
      chosenLabel: chosen.label, bestLabel: best ? best.label : '', bestEvBB: best ? best.evBB : 0,
      chosenEvBB: chosen.evBB, note: better, betterLine: better,
      headline: grade.label === '最佳' ? '好选择，这就是当前的最优线路。' :
        grade.label === '合理' ? '可以接受，但还有一点可优化的空间。' :
        grade.label === '略亏' ? '方向不算错，但尺度和频率可以更好。' :
        grade.label === '失误' ? '这手牌损失了明显的 EV，来看看更优解。' : '这是一次代价很大的决策，重点复盘。'
    };
  }

  function preflopSummary(game, hero) {
    const cls = Cards.handClass(hero.cards[0], hero.cards[1]);
    const pos = hero.position;
    const chart = Charts.OPEN[pos] || Charts.OPEN.BTN;
    const inChart = Ranges.classesFromNotation(chart).has(cls);
    return {
      handClass: cls, position: pos, chart, inChart,
      text: inChart ? (cls + ' 在 ' + pos + ' 的基准开池范围里。') : (cls + ' 不在 ' + pos + ' 的基准开池范围里，除非有特殊剥削理由，否则应该更谨慎。')
    };
  }

  PM.Coach = { advise, gradeChosen, buildOptions, evOfOption, bestOption, preflopSummary, POSITION_TEXT, GRADE_COLORS };
})(typeof window !== 'undefined' ? window : globalThis);
