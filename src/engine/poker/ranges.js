/* 德州心法 · 范围引擎
 * 解析 range notation、生成 1326 个具体组合、范围加权抽样、范围工具。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};
  const Cards = PM.Cards, E = PM.Evaluator, Charts = PM.Charts;
  const R = Cards.RANKS;

  const allCombosCache = (function () {
    const arr = [];
    for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) {
      arr.push({ c1: a, c2: b, cls: Cards.handClass(a, b), key: a * 52 + b });
    }
    return arr;
  })();
  const byClass = {};
  allCombosCache.forEach(c => { (byClass[c.cls] = byClass[c.cls] || []).push(c); });

  function expandToken(tok) {
    tok = tok.trim().replace(/[，、]/g, ',').toUpperCase();
    // 后缀保持小写：AKs -> AKs；A5S-A2S -> A5s-A2s
    tok = tok.replace(/([2-9TJQKA])([SO])(?=[-+]|$)/g, (m, r, su) => r + su.toLowerCase());
    if (!tok) return [];
    // 连字符区间：A5s-A2s / 22-99
    const m = tok.match(/^([2-9TJQKA])([2-9TJQKA])([SO])?-([2-9TJQKA])([2-9TJQKA])([SO])?$/i);
    if (m) {
      const out = [];
      const hi1 = R.indexOf(m[1]), lo1 = R.indexOf(m[2]);
      const hi2 = R.indexOf(m[4]), lo2 = R.indexOf(m[5]);
      const kind = (m[3] || m[6] || '').toLowerCase();
      if (hi1 === lo1 && hi2 === lo2) {
        const from = Math.min(hi1, hi2), to = Math.max(hi1, hi2);
        for (let r = from; r <= to; r++) out.push(R[r] + R[r]);
        return out;
      }
      if (kind === 's' || kind === 'o') {
        const from = Math.min(lo1, lo2), to = Math.max(lo1, lo2);
        for (let k = from; k <= to; k++) out.push(R[hi1] + R[k] + kind);
        return out;
      }
      return [];
    }
    // A2s+ / TT+ / ATo+
    const plus = tok.match(/^([2-9TJQKA])([2-9TJQKA])([SO])?\+$/i);
    if (plus) {
      const hi = R.indexOf(plus[1]), lo = R.indexOf(plus[2]);
      const kind = plus[3] ? plus[3].toLowerCase() : '';
      if (hi === lo) {
        const out = [];
        for (let r = hi; r <= 12; r++) out.push(R[r] + R[r]);
        return out;
      }
      const out = [];
      for (let k = lo; k < hi; k++) out.push(R[hi] + R[k] + (kind || ''));
      // 无后缀时同时展开同花与不同花
      if (!kind) {
        for (let k = lo; k < hi; k++) out.push(R[hi] + R[k] + 's');
        for (let k = lo; k < hi; k++) out.push(R[hi] + R[k] + 'o');
      }
      return out;
    }
    // 没有后缀的两张牌：代表同花+不同花
    if (/^[2-9TJQKA]{2}$/.test(tok) && tok[0] !== tok[1]) {
      return [tok + 's', tok + 'o'];
    }
    return [tok];
  }

  function classesFromNotation(notation) {
    const set = new Set();
    String(notation || '').split(/[,\s]+/).forEach(t => {
      expandToken(t).forEach(cls => { if (byClass[cls]) set.add(cls); });
    });
    return set;
  }

  function combosFromNotation(notation, weight) {
    weight = weight == null ? 1 : weight;
    const clsSet = classesFromNotation(notation);
    const out = [];
    clsSet.forEach(cls => byClass[cls].forEach(c => out.push({ c1: c.c1, c2: c.c2, cls: cls, w: weight })));
    return out;
  }

  function normalizeRange(range) {
    if (!range) return [];
    if (typeof range === 'string') return combosFromNotation(range, 1);
    if (Array.isArray(range)) {
      if (range.length && typeof range[0] === 'number') {
        // [c1,c2] 或 [c1,c2,c1,c2...]
        if (range.length === 2) return [{ c1: range[0], c2: range[1], cls: Cards.handClass(range[0], range[1]), w: 1 }];
      } else if (range.length && Array.isArray(range[0])) {
        return range.map(h => ({ c1: h[0], c2: h[1], cls: Cards.handClass(h[0], h[1]), w: 1 }));
      } else if (range.length && typeof range[0] === 'object' && range[0].c1 != null) {
        return range.map(x => ({ c1: x.c1, c2: x.c2, cls: x.cls || Cards.handClass(x.c1, x.c2), w: x.w == null ? 1 : x.w }));
      }
      return [];
    }
    return [];
  }

  function rangePercent(range) {
    const rs = normalizeRange(range);
    let w = 0;
    rs.forEach(c => w += c.w);
    return w / 1326;
  }

  function filterBlocked(range, dead) {
    const set = new Set(dead || []);
    return range.filter(c => !set.has(c.c1) && !set.has(c.c2));
  }

  function sampleCombo(range, dead, rng) {
    const set = dead instanceof Set ? dead : new Set(dead || []);
    let total = 0;
    const legal = [];
    for (let i = 0; i < range.length; i++) {
      const c = range[i];
      if (!set.has(c.c1) && !set.has(c.c2)) { legal.push(c); total += c.w; }
    }
    if (!legal.length) return null;
    let x = rng() * total;
    for (let i = 0; i < legal.length; i++) {
      x -= legal[i].w;
      if (x <= 0) return legal[i];
    }
    return legal[legal.length - 1];
  }

  function sampleHoles(range, dead, rng) {
    const c = sampleCombo(range, dead, rng);
    return c ? [c.c1, c.c2] : null;
  }

  // 用成牌强度 + 听牌来给每个组合加权（翻后范围过滤的基础）
  function handPotential(hole, board) {
    const all = hole.concat(board);
    if (all.length < 5) return { made: 0, draw: 0, total: 0 };
    const sc = E.evaluateCards(all);
    const cat = E.catOf(sc);
    const d = E.drawInfo(hole, board);
    const madeScore = Math.min(1, cat / 7);
    const drawScore = Math.min(0.5, d.outs / 24);
    return { made: madeScore, draw: drawScore, total: madeScore * 0.8 + drawScore * 0.4 };
  }

  function makeWeightedRange(classes, weightMap) {
    const out = [];
    classes.forEach(cls => {
      (byClass[cls] || []).forEach(c => out.push({ c1: c.c1, c2: c.c2, cls: cls, w: weightMap ? weightMap[cls] || 0 : 1 }));
    });
    return out.filter(x => x.w > 0);
  }

  // Chen formula，用于翻前粗略排序
  function chen(hole) {
    const r1 = Cards.rankOf(hole[0]) + 2, r2 = Cards.rankOf(hole[1]) + 2;
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    const pts = { 14: 10, 13: 8, 12: 7, 11: 6 };
    let score = pts[hi] || hi / 2;
    if (hi === lo) return Math.max(5, score * 2);
    const suited = Cards.suitOf(hole[0]) === Cards.suitOf(hole[1]);
    if (suited) score += 2;
    const gap = hi - lo - 1;
    score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (gap <= 1 && hi < 12) score += 1;
    return Math.round(score * 2) / 2;
  }

  // 翻前强度 0..1（用于无 chart 场景）
  function preflopStrength(hole) {
    return Math.max(0, Math.min(1, (chen(hole) + 1) / 21));
  }

  function classesInRange(range) {
    const map = {};
    normalizeRange(range).forEach(c => { map[c.cls] = (map[c.cls] || 0) + c.w; });
    return map;
  }

  function topClasses(range, n) {
    const map = classesInRange(range);
    return Object.keys(map).sort((a, b) => classPower(b) - classPower(a)).slice(0, n || 8);
  }
  function classPower(cls) {
    const hi = R.indexOf(cls[0]), lo = R.indexOf(cls[1]);
    return (hi + 2) * 2 + (lo + 2) + (cls[2] === 's' ? 3 : 0) + (hi === lo ? 20 : 0);
  }

  // 牌的“阻挡效应”：对手范围中与这些牌冲突的组合比例
  function blockerEffect(range, cards) {
    const rs = normalizeRange(range);
    if (!rs.length) return 0;
    const set = new Set(cards);
    let total = 0, blocked = 0;
    rs.forEach(c => { total += c.w; if (set.has(c.c1) || set.has(c.c2)) blocked += c.w; });
    return total ? blocked / total : 0;
  }

  PM.Ranges = {
    allCombos: allCombosCache, byClass,
    classesFromNotation, combosFromNotation, normalizeRange, rangePercent,
    filterBlocked, sampleCombo, sampleHoles, handPotential, makeWeightedRange,
    chen, preflopStrength, classesInRange, topClasses, classPower, blockerEffect,
    expandToken
  };
})(typeof window !== 'undefined' ? window : globalThis);
