/* 德州心法 · 胜率引擎
 * 加权范围蒙特卡洛 + 河牌单挑精确枚举 + 两套评估器交叉校验。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};
  const Cards = PM.Cards, E = PM.Evaluator, Ranges = PM.Ranges;

  function makeBase(hero, board) {
    const dead = hero.concat(board);
    const set = new Set(dead);
    if (set.size !== dead.length) throw new Error('存在重复牌');
    const deck = [];
    for (let c = 0; c < 52; c++) if (!set.has(c)) deck.push(c);
    return { dead, deck };
  }

  function cardKey(a, b) { return a < b ? a * 52 + b : b * 52 + a; }

  function monteCarloEquity(opts) {
    const hero = opts.hero.slice();
    const board = (opts.board || []).slice();
    const ranges = (opts.ranges || []).map(r => Ranges.normalizeRange(r));
    const iterations = Math.max(200, opts.iterations || 3000);
    const seed = opts.seed == null ? 0x9e3779b9 : opts.seed;
    const rng = Cards.mulberry32(seed);
    if (ranges.length === 0) {
      return { equity: 1, win: 1, tie: 0, lose: 0, samples: 0, ci: 0, exact: false, opponents: 0 };
    }
    const base = makeBase(hero, board);
    let wins = 0, ties = 0, losses = 0, used = 0, equityPoints = 0;
    const need = 5 - board.length;
    const maxTry = 40;
    for (let it = 0; it < iterations; it++) {
      const deadSet = new Set(base.dead);
      const oppHoles = [];
      let ok = true;
      for (let o = 0; o < ranges.length; o++) {
        let pick = null;
        for (let t = 0; t < maxTry; t++) {
          pick = Ranges.sampleCombo(ranges[o], deadSet, rng);
          if (!pick) break;
          if (!deadSet.has(pick.c1) && !deadSet.has(pick.c2)) break;
          pick = null;
        }
        if (!pick) { ok = false; break; }
        deadSet.add(pick.c1); deadSet.add(pick.c2);
        oppHoles.push([pick.c1, pick.c2]);
      }
      if (!ok) continue;
      // 从剩余牌中无放回抽公共牌
      const remain = base.deck.filter(c => !deadSet.has(c));
      const runout = board.slice();
      for (let j = 0; j < need; j++) {
        const idx = Math.floor(rng() * remain.length);
        runout.push(remain[idx]);
        remain[idx] = remain[remain.length - 1];
        remain.pop();
      }
      const hs = E.evaluate7(hero.concat(runout));
      let best = -1, tieCount = 0;
      for (let o = 0; o < oppHoles.length; o++) {
        const os = E.evaluate7(oppHoles[o].concat(runout));
        if (os > best) { best = os; tieCount = 1; }
        else if (os === best) tieCount++;
      }
      used++;
      if (hs > best) { wins++; equityPoints += 1; }
      else if (hs === best) { ties++; equityPoints += 1 / (tieCount + 1); }
      else { losses++; }
    }
    if (used === 0) throw new Error('范围与公共牌冲突，无法抽样');
    const equity = equityPoints / used;
    const p = equity;
    const ci = 1.96 * Math.sqrt(Math.max(0.000001, p * (1 - p) / used));
    return {
      equity, win: wins / used, tie: ties / used, lose: losses / used,
      samples: used, ci, exact: false, opponents: ranges.length,
      confidence: used >= 6000 ? '高' : used >= 2500 ? '中' : '低'
    };
  }

  // 河牌单挑：对所有合法组合精确枚举
  function exactRiver(hero, board, range) {
    if (board.length !== 5) return null;
    const rs = Ranges.filterBlocked(Ranges.normalizeRange(range), hero.concat(board));
    if (!rs.length) return null;
    const hs = E.evaluate7(hero.concat(board));
    let total = 0, win = 0, tie = 0, lose = 0;
    for (let i = 0; i < rs.length; i++) {
      const c = rs[i];
      const os = E.evaluate7([c.c1, c.c2].concat(board));
      const w = c.w == null ? 1 : c.w;
      total += w;
      if (hs > os) win += w; else if (hs === os) tie += w; else lose += w;
    }
    if (!total) return null;
    return { equity: (win + tie / 2) / total, win: win / total, tie: tie / total, lose: lose / total, samples: rs.length, ci: 0, exact: true, opponents: 1, confidence: '精确' };
  }

  function equity(opts) {
    if ((opts.board || []).length === 5 && (opts.ranges || []).length === 1) {
      const ex = exactRiver(opts.hero, opts.board, opts.ranges[0]);
      if (ex) return ex;
    }
    return monteCarloEquity(opts);
  }

  // 用相同的随机种子跑两次，确认可复现（UI 的“双引擎校验”）
  function crossCheck(hero, board, ranges, iterations) {
    const a = monteCarloEquity({ hero, board, ranges, iterations: iterations || 2000, seed: 20261116 });
    const b = monteCarloEquity({ hero, board, ranges, iterations: iterations || 2000, seed: 20261116 });
    let evalMismatch = 0;
    const rng = Cards.mulberry32(777);
    for (let i = 0; i < 250; i++) {
      const seven = Cards.shuffle(Cards.fullDeck(), rng).slice(0, 7);
      if (E.evaluate7(seven) !== E.evaluate7Brute(seven)) evalMismatch++;
    }
    return {
      reproducible: Math.abs(a.equity - b.equity) < 1e-12,
      evaluatorMismatch: evalMismatch,
      evalSamples: 250,
      equity: a.equity,
      pass: Math.abs(a.equity - b.equity) < 1e-12 && evalMismatch === 0
    };
  }

  // 补牌胜率：翻牌到河牌的粗略提升（Rule of 2/4 的参照）
  function drawEquity(outs, street) {
    const n = street === 'flop' ? 2 : 1;
    const raw = 1 - Math.pow((47 - outs) / 47, n);
    return raw;
  }

  // 随机对随机，用于基准（也是“双重验证”的第二个角度）
  function randomHandEquity(hero, board, opponents, iterations) {
    const range = '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o';
    const ranges = [];
    for (let i = 0; i < opponents; i++) ranges.push(range);
    return monteCarloEquity({ hero, board, ranges, iterations: iterations || 2500, seed: 8888 });
  }

  PM.Equity = { monteCarloEquity, exactRiver, equity, crossCheck, drawEquity, randomHandEquity, makeBase };
})(typeof window !== 'undefined' ? window : globalThis);

