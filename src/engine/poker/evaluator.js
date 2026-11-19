/* 德州心法 · 牌力评估器
 * 主评估器：7 张牌直接评估（O(1) 级），用于蒙特的卡洛。
 * 校验器：21 组 5 张牌暴力枚举，独立实现，用于交叉验证。
 * 计分：category * 15^5 + kickers（基 15），可直接比较大小。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};
  const CAT_NAMES = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
  const CAT_NAMES_EN = ['High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'];
  const P15 = [1, 15, 225, 3375, 50625, 759375, 11390625];

  function encode(cat, ks) {
    let s = cat * 11390625;
    for (let i = 0; i < ks.length; i++) s += ks[i] * P15[4 - i];
    return s;
  }
  function catOf(score) { return Math.floor(score / 11390625); }
  function kickersOf(score) {
    let rem = score % 11390625;
    const out = [];
    for (let i = 4; i >= 0; i--) { out.push(Math.floor(rem / P15[i])); rem %= P15[i]; }
    return out;
  }
  function straightHigh(rankSet) {
    const a = Array.from(rankSet).sort((x, y) => y - x);
    let run = 1, prev = a[0];
    for (let i = 1; i < a.length; i++) {
      if (a[i] === prev - 1) { run++; prev = a[i]; if (run >= 5) return a[i] + 4; }
      else { run = 1; prev = a[i]; }
    }
    // 只有在没有更高顺子时，A 才作 1 组成轮子顺（A5432，5 高）
    if (a[0] === 12 && [3, 2, 1, 0].every(r => rankSet.has(r))) return 3;
    return -1;
  }
  function evaluate5(cards) {
    if (!cards || cards.length !== 5) throw new Error('evaluate5 需要 5 张牌');
    const rc = new Array(13).fill(0);
    const suit0 = cards[0] & 3;
    let flush = true;
    for (let i = 0; i < 5; i++) {
      rc[cards[i] >> 2]++;
      if ((cards[i] & 3) !== suit0) flush = false;
    }
    const ranks = [];
    for (let r = 12; r >= 0; r--) if (rc[r]) ranks.push(r);
    const sh = straightHigh(new Set(ranks));
    if (flush && sh >= 0) return encode(8, [sh + 2]);
    if (flush) return encode(5, ranks.slice(0, 5).map(r => r + 2));
    // 按数量、点数排序
    const groups = [];
    for (let r = 12; r >= 0; r--) if (rc[r]) groups.push([rc[r], r]);
    groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const cnt = groups[0][0];
    if (cnt === 4) {
      return encode(7, [groups[0][1] + 2, groups[1][1] + 2]);
    }
    if (cnt === 3 && groups[1] && groups[1][0] >= 2) {
      return encode(6, [groups[0][1] + 2, groups[1][1] + 2]);
    }
    if (sh >= 0) return encode(4, [sh + 2]);
    if (cnt === 3) return encode(3, [groups[0][1] + 2, groups[1][1] + 2, groups[2][1] + 2]);
    if (cnt === 2 && groups[1] && groups[1][0] === 2) {
      return encode(2, [groups[0][1] + 2, groups[1][1] + 2, groups[2][1] + 2]);
    }
    if (cnt === 2) return encode(1, [groups[0][1] + 2, groups[1][1] + 2, groups[2][1] + 2, groups[3][1] + 2]);
    return encode(0, ranks.slice(0, 5).map(r => r + 2));
  }
  function evaluate7(cards) {
    if (!cards || cards.length !== 7) throw new Error('evaluate7 需要 7 张牌');
    const rc = new Uint8Array(13);
    const sc = [0, 0, 0, 0];
    const suitRanks = [[], [], [], []];
    for (let i = 0; i < 7; i++) {
      const c = cards[i], r = c >> 2, s = c & 3;
      rc[r]++; sc[s]++; suitRanks[s].push(r);
    }
    // 同花 / 同花顺
    for (let s = 0; s < 4; s++) {
      if (sc[s] >= 5) {
        const rs = suitRanks[s].slice().sort((a, b) => b - a).slice(0, 7);
        const sh = straightHigh(new Set(rs));
        if (sh >= 0) return encode(8, [sh + 2]);
        let encoded = encode(5, rs.slice(0, 5).map(r => r + 2));
        return encoded;
      }
    }
    // 四条、葫芦、三条、两对、对子
    let quad = -1, trip1 = -1, trip2 = -1, pair1 = -1, pair2 = -1;
    for (let r = 12; r >= 0; r--) {
      if (rc[r] === 4) quad = r;
      else if (rc[r] === 3) { if (trip1 < 0) trip1 = r; else if (trip2 < 0) trip2 = r; }
      else if (rc[r] === 2) { if (pair1 < 0) pair1 = r; else if (pair2 < 0) pair2 = r; }
    }
    if (quad >= 0) {
      let k = -1;
      for (let r = 12; r >= 0; r--) if (r !== quad && rc[r]) { k = r; break; }
      return encode(7, [quad + 2, k + 2]);
    }
    if (trip1 >= 0) {
      let pair = pair1;
      if (trip2 >= 0) pair = Math.max(pair, trip2);
      if (pair >= 0) return encode(6, [trip1 + 2, pair + 2]);
    }
    const rankSet = new Set();
    for (let r = 0; r < 13; r++) if (rc[r]) rankSet.add(r);
    const sh = straightHigh(rankSet);
    if (sh >= 0) return encode(4, [sh + 2]);
    if (trip1 >= 0) {
      const ks = [trip1 + 2];
      for (let r = 12; r >= 0 && ks.length < 3; r--) if (r !== trip1 && rc[r]) ks.push(r + 2);
      return encode(3, ks);
    }
    if (pair1 >= 0 && pair2 >= 0) {
      let k = -1;
      for (let r = 12; r >= 0; r--) if (r !== pair1 && r !== pair2 && rc[r]) { k = r; break; }
      return encode(2, [pair1 + 2, pair2 + 2, k + 2]);
    }
    if (pair1 >= 0) {
      const ks = [pair1 + 2];
      for (let r = 12; r >= 0 && ks.length < 4; r--) if (r !== pair1 && rc[r]) ks.push(r + 2);
      return encode(1, ks);
    }
    const high = [];
    for (let r = 12; r >= 0 && high.length < 5; r--) if (rc[r]) high.push(r + 2);
    return encode(0, high);
  }
  // 独立暴力实现：21 种 5 张组合，只调用 evaluate5
  const C5 = (function () {
    const out = [];
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 4; b++) for (let c = b + 1; c < 5; c++)
      for (let d = c + 1; d < 6; d++) for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
    return out;
  })();
  function evaluate7Brute(cards) {
    let best = -1;
    for (let i = 0; i < C5.length; i++) {
      const idx = C5[i];
      const s = evaluate5([cards[idx[0]], cards[idx[1]], cards[idx[2]], cards[idx[3]], cards[idx[4]]]);
      if (s > best) best = s;
    }
    return best;
  }
  function bestFive(cards) {
    let best = -1, bi = null;
    const n = cards.length;
    if (n < 5) return { score: -1, cards: [], category: -1 };
    for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++)
      for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) {
        const hand = [cards[a], cards[b], cards[c], cards[d], cards[e]];
        const s = evaluate5(hand);
        if (s > best) { best = s; bi = hand; }
      }
    return { score: best, cards: bi, category: catOf(best) };
  }
  function catName(score) {
    const c = catOf(score);
    return CAT_NAMES[c] || '未知';
  }
  function describe(score) {
    const cat = catOf(score);
    const ks = kickersOf(score);
    const R = '23456789TJQKA';
    const rn = v => R[v - 2] || '?';
    let sub = '';
    if (cat === 8) sub = ks[0] === 14 ? '皇家同花顺' : '高张 ' + rn(ks[0]);
    else if (cat === 7) sub = rn(ks[0]) + ' 四条';
    else if (cat === 6) sub = rn(ks[0]) + ' 带 ' + rn(ks[1]) + ' 葫芦';
    else if (cat === 5) sub = rn(ks[0]) + ' 高同花';
    else if (cat === 4) sub = rn(ks[0]) + ' 高顺子';
    else if (cat === 3) sub = rn(ks[0]) + ' 三条';
    else if (cat === 2) sub = rn(ks[0]) + '/' + rn(ks[1]) + ' 两对';
    else if (cat === 1) sub = rn(ks[0]) + ' 一对';
    else sub = rn(ks[0]) + ' 高牌';
    return { category: cat, name: CAT_NAMES[cat], nameEn: CAT_NAMES_EN[cat], sub, text: sub };
  }
  function evaluateAnyBrute(cards) {
    if (cards.length < 5) return -1;
    let best = -1;
    const n = cards.length;
    for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++)
      for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) {
        const s = evaluate5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
        if (s > best) best = s;
      }
    return best;
  }
  function evaluateCards(cards) {
    if (cards.length >= 7) return evaluate7(cards.slice(0, 7));
    if (cards.length === 6) return evaluateAnyBrute(cards);
    if (cards.length === 5) return evaluate5(cards);
    return -1;
  }
  function isRoyal(score, cards) {
    return catOf(score) === 8 && kickersOf(score)[0] === 14;
  }
  // 当前牌面下，手牌与公共牌组成的最佳牌
  function madeHand(hole, board) {
    const all = hole.concat(board);
    if (all.length < 5) return { category: -1, name: '未成牌', score: -1 };
    const score = evaluateCards(all);
    const d = describe(score);
    return { score, category: d.category, name: d.name, text: d.text, sub: d.sub, bestFive: bestFive(all).cards };
  }
  // 听牌检测（用于新手教练的补牌解释）
  function drawInfo(hole, board) {
    const out = { flushDraw: false, backdoorFlush: false, openEnded: false, gutshot: false, overcards: 0, outs: 0, labels: [] };
    if (!hole || hole.length < 2 || board.length < 3) return out;
    const all = hole.concat(board);
    const suits = [[], [], [], []];
    all.forEach(c => suits[c & 3].push(c >> 2));
    const holeSuits = [hole[0] & 3, hole[1] & 3];
    for (let s = 0; s < 4; s++) {
      const n = suits[s].length;
      if (n === 4 && (holeSuits[0] === s || holeSuits[1] === s)) {
        out.flushDraw = true;
        out.outs += 9;
        out.labels.push('同花听牌（约9张补牌）');
      } else if (n === 3 && (holeSuits[0] === s || holeSuits[1] === s) && board.length === 3) {
        out.backdoorFlush = true;
        out.labels.push('后门同花听牌');
      }
    }
    const rs = new Set(all.map(c => c >> 2));
    // 找 5 连张的缺口
    const arr = Array.from(rs).sort((a, b) => a - b);
    let madeStraight = false;
    for (let i = 0; i <= arr.length - 5; i++) if (arr[i + 4] - arr[i] === 4) madeStraight = true;
    if (arr.includes(12) && [0, 1, 2, 3].every(x => rs.has(x))) madeStraight = true;
    if (!madeStraight) {
      // 每条 4 张连续段内缺 1 张 => 卡顺；开放型用 4 连 + 两端
      let gut = false, oesd = false;
      for (let lo = 0; lo <= 8; lo++) {
        const have = [lo, lo + 1, lo + 2, lo + 3, lo + 4].filter(r => rs.has(r));
        if (have.length === 4) {
          const missing = [lo, lo + 1, lo + 2, lo + 3, lo + 4].find(r => !rs.has(r));
          if (missing === lo || missing === lo + 4) oesd = true; else gut = true;
        }
      }
      if (oesd) { out.openEnded = true; out.outs += 8; out.labels.push('两头顺听牌（约8张补牌）'); }
      else if (gut) { out.gutshot = true; out.outs += 4; out.labels.push('卡顺听牌（约4张补牌）'); }
    }
    const boardRanks = new Set(board.map(c => c >> 2));
    const hr = [hole[0] >> 2, hole[1] >> 2];
    out.overcards = hr.filter(r => !boardRanks.has(r) && r > Math.max.apply(null, board.map(c => c >> 2))).length;
    if (out.overcards > 0) {
      out.outs += out.overcards * 3;
      out.labels.push(out.overcards + ' 张高牌（约 ' + (out.overcards * 3) + ' 张补牌）');
    }
    return out;
  }

  PM.Evaluator = {
    CAT_NAMES, CAT_NAMES_EN, evaluate5, evaluate7, evaluate7Brute, evaluateCards,
    bestFive, catOf, catName, describe, kickersOf, encode, madeHand, drawInfo,
    isRoyal, straightHigh
  };
})(typeof window !== 'undefined' ? window : globalThis);
