/* 德州心法 · 牌与牌堆
 * 牌用 0..51 的整数表示：rank * 4 + suit
 * rank: 0=2 ... 12=A ; suit: 0=♠ 1=♥ 2=♦ 3=♣
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};

  const RANKS = '23456789TJQKA';
  const SUITS = 'shdc';
  const SUIT_SYMBOL = ['♠', '♥', '♦', '♣'];
  const SUIT_NAME = ['黑桃', '红桃', '方块', '梅花'];

  function makeCard(rank, suit) { return rank * 4 + suit; }
  function rankOf(c) { return c >> 2; }
  function suitOf(c) { return c & 3; }
  function rankChar(c) { return RANKS[rankOf(c)]; }
  function suitChar(c) { return SUITS[suitOf(c)]; }
  function cardText(c) { return rankChar(c) + suitChar(c); }
  function cardSymbol(c) { return rankChar(c) + SUIT_SYMBOL[suitOf(c)]; }
  function cardNameCN(c) { return SUIT_NAME[suitOf(c)] + RANKS[rankOf(c)]; }
  function parseOne(s) {
    if (s == null) return null;
    if (typeof s === 'number') return s >= 0 && s < 52 ? s : null;
    s = String(s).trim();
    if (!s) return null;
    const r = RANKS.indexOf(s[0].toUpperCase());
    const su = SUITS.indexOf(s[1].toLowerCase());
    if (r < 0 || su < 0) throw new Error('无法识别的牌: ' + s);
    return makeCard(r, su);
  }
  function parse(str) {
    if (!str) return [];
    if (Array.isArray(str)) return str.map(parseOne);
    return String(str).trim().split(/[\s,]+/).filter(Boolean).map(parseOne);
  }
  function parseSafe(str) {
    try { return parse(str); } catch (e) { return []; }
  }
  function fullDeck() {
    const d = [];
    for (let i = 0; i < 52; i++) d.push(i);
    return d;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(deck, rng) {
    rng = rng || Math.random;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;
  }
  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function removeKnown(deck, known) {
    const set = new Set(known);
    return deck.filter(c => !set.has(c));
  }
  function handClass(c1, c2) {
    const r1 = rankOf(c1), r2 = rankOf(c2);
    const hi = Math.max(r1, r2), lo = Math.min(r1, r2);
    const suited = suitOf(c1) === suitOf(c2);
    if (hi === lo) return RANKS[hi] + RANKS[hi];
    return RANKS[hi] + RANKS[lo] + (suited ? 's' : 'o');
  }
  function classCards(cls) {
    // 返回该 169 手牌类别对应的所有具体组合
    const hi = RANKS.indexOf(cls[0]);
    const lo = RANKS.indexOf(cls[1]);
    const kind = cls[2];
    const out = [];
    if (hi === lo) {
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        out.push([makeCard(hi, a), makeCard(lo, b)]);
      }
      return out;
    }
    if (kind === 's') {
      for (let s = 0; s < 4; s++) out.push([makeCard(hi, s), makeCard(lo, s)]);
      return out;
    }
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      if (a !== b) out.push([makeCard(hi, a), makeCard(lo, b)]);
    }
    return out;
  }
  const ALL_CLASSES = (function () {
    const out = [];
    for (let hi = 12; hi >= 0; hi--) {
      for (let lo = hi; lo >= 0; lo--) {
        if (hi === lo) out.push(RANKS[hi] + RANKS[hi]);
        else { out.push(RANKS[hi] + RANKS[lo] + 's'); out.push(RANKS[hi] + RANKS[lo] + 'o'); }
      }
    }
    return out;
  })();

  PM.Cards = {
    RANKS, SUITS, SUIT_SYMBOL, SUIT_NAME, ALL_CLASSES,
    makeCard, rankOf, suitOf, rankChar, suitChar, cardText, cardSymbol, cardNameCN,
    parse, parseOne, parseSafe, fullDeck, shuffle, mulberry32, hashString,
    removeKnown, handClass, classCards
  };
})(typeof window !== 'undefined' ? window : globalThis);
