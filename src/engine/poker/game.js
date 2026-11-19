/* 德州心法 · 游戏引擎
 * 完整单桌 NLHE：位置、盲注、翻前/翻后下注、全下、边池、摊牌、亮牌。
 * 纯规则引擎，不负责动画；教练与 AI 在外部调用。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};
  const Cards = PM.Cards, E = PM.Evaluator, Ranges = PM.Ranges, RangeModel = PM.RangeModel;

  const POS_BY_OFFSET = {
    2: ['BTN', 'BB'],
    3: ['BTN', 'SB', 'BB'],
    4: ['BTN', 'SB', 'BB', 'CO'],
    5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
    6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']
  };

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function fmtBB(chips, bb) { return +(chips / bb).toFixed(1); }

  class PokerGame {
    constructor(config) {
      this.config = Object.assign({
        aiCount: 3, mode: 'beginner', startingStack: 200, sb: 1, bb: 2,
        heroName: '你', seed: Date.now() & 0x7fffffff, heroStats: null
      }, config || {});
      this.heroName = this.config.heroName || '你';
      this.handNo = 0;
      this.button = null;
      this.buttonShouldRotate = false;
      this.phase = 'idle';
      this.street = 'preflop';
      this.actions = [];
      this.seq = 0;
      this.board = [];
      this.deck = [];
      this.pot = 0;
      this.currentBet = 0;
      this.lastRaiseSize = this.config.bb;
      this.lastAggressor = null;
      this.actingIndex = -1;
      this.pendingRunout = false;
      this.result = null;
      this.heroDecisions = [];
      this.pendingAdvice = null;
      this.rng = Cards.mulberry32(this.config.seed);
      this.heroStats = this.config.heroStats || null;
      this.revealAll = true;
      this.seats = [];
      this._setupSeats();
    }

    _setupSeats() {
      const profiles = this.config.profiles || [];
      this.seats = [];
      const hero = {
        index: 0, id: 'hero', name: this.heroName, isHero: true, isAI: false,
        profile: null, avatar: 'images/hero-avatar.jpg',
        stack: this.config.startingStack, startingStack: this.config.startingStack,
        cards: [], folded: false, allIn: false, streetBet: 0, committed: 0,
        hasActed: false, lastAction: null, lastActionLabel: '', lastAmount: 0,
        position: '', isButton: false, isSB: false, isBB: false, revealed: true,
        handStartStack: this.config.startingStack, totalInvested: 0, won: 0,
        thinking: false, lastReasoning: '', lastThought: '', rangeSummary: null
      };
      this.seats.push(hero);
      for (let i = 1; i <= this.config.aiCount; i++) {
        const p = profiles[i - 1] || PM.Opponents.OPPONENTS[(i - 1) % PM.Opponents.OPPONENTS.length];
        this.seats.push({
          index: i, id: p.id, name: p.name, isHero: false, isAI: true,
          profile: p, avatar: p.avatar,
          stack: this.config.startingStack, startingStack: this.config.startingStack,
          cards: [], folded: false, allIn: false, streetBet: 0, committed: 0,
          hasActed: false, lastAction: null, lastActionLabel: '', lastAmount: 0,
          position: '', isButton: false, isSB: false, isBB: false, revealed: false,
          handStartStack: this.config.startingStack, totalInvested: 0, won: 0,
          thinking: false, lastReasoning: '', lastThought: '', rangeSummary: null
        });
      }
    }

    get n() { return this.seats.length; }
    get bb() { return this.config.bb; }
    get sb() { return this.config.sb; }
    get heroSeat() { return this.seats[0]; }
    get actingSeat() { return this.actingIndex >= 0 ? this.seats[this.actingIndex] : null; }

    _positions(button) {
      const n = this.n;
      const arr = POS_BY_OFFSET[n] || POS_BY_OFFSET[6];
      const map = [];
      for (let off = 0; off < n; off++) {
        map[(button + off) % n] = arr[off];
      }
      return map;
    }

    startHand() {
      if (this.n < 2) throw new Error('至少需要两名玩家');
      // 破产自动重新买入
      this.seats.forEach(s => {
        if (s.stack <= 0) {
          s.stack = this.config.startingStack;
          s.rebought = true;
        }
        s.rebought = s.rebought || false;
      });
      this.handNo++;
      if (this.button == null) {
        this.button = Math.floor(this.rng() * this.n);
      } else {
        this.button = (this.button + 1) % this.n;
      }
      this.phase = 'betting';
      this.street = 'preflop';
      this.actions = [];
      this.seq = 0;
      this.board = [];
      this.result = null;
      this.pendingRunout = false;
      this.heroDecisions = [];
      this.pendingAdvice = null;
      this.currentBet = 0;
      this.lastRaiseSize = this.bb;
      this.lastAggressor = null;
      this.actingIndex = -1;
      this._rangeCache = null;
      this._rangeEpoch = (this._rangeEpoch || 0) + 1;
      this.pot = 0;

      const positions = this._positions(this.button);
      this.seats.forEach((s, i) => {
        s.position = positions[i];
        s.isButton = i === this.button;
        s.isSB = false;
        s.isBB = false;
        s.cards = [];
        s.folded = false;
        s.allIn = false;
        s.streetBet = 0;
        s.committed = 0;
        s.hasActed = false;
        s.lastAction = null;
        s.lastActionLabel = '';
        s.lastAmount = 0;
        s.revealed = !!s.isHero;
        s.handStartStack = s.stack;
        s.totalInvested = 0;
        s.won = 0;
        s.thinking = false;
        s.lastReasoning = '';
        s.lastThought = '';
        s.rangeSummary = null;
        s.rebought = false;
      });

      // 洗牌并发底牌
      this.deck = Cards.shuffle(Cards.fullDeck(), this.rng);
      const order = [];
      if (this.n === 2) {
        order.push((this.button + 1) % this.n, this.button);
      } else {
        // 从按钮左手开始绕一整圈，按钮位也要发牌
        for (let k = 1; k <= this.n; k++) order.push((this.button + k) % this.n);
      }
      // 标准发牌顺序：从按钮左手开始，每人一张，转两圈
      for (let round = 0; round < 2; round++) {
        for (let i = 0; i < order.length; i++) {
          this.seats[order[i]].cards.push(this.deck.shift());
        }
      }

      // 盲注
      let sbIndex, bbIndex;
      if (this.n === 2) {
        sbIndex = this.button;
        bbIndex = (this.button + 1) % this.n;
      } else {
        sbIndex = (this.button + 1) % this.n;
        bbIndex = (this.button + 2) % this.n;
      }
      this.seats[sbIndex].isSB = true;
      this.seats[bbIndex].isBB = true;
      this.sbIndex = sbIndex;
      this.bbIndex = bbIndex;
      this._postBlind(this.seats[sbIndex], this.sb, '小盲');
      this._postBlind(this.seats[bbIndex], this.bb, '大盲');
      this.currentBet = Math.max(this.seats[sbIndex].streetBet, this.seats[bbIndex].streetBet);
      this.lastRaiseSize = Math.max(this.bb, this.currentBet);
      this.lastAggressor = this.seats[bbIndex].streetBet >= this.seats[sbIndex].streetBet ? bbIndex : sbIndex;
      this.pot = this.seats.reduce((a, s) => a + s.committed, 0);
      this._beginActionPreflop();
      return this;
    }

    _postBlind(seat, amount, label) {
      const pay = Math.min(seat.stack, amount);
      seat.stack -= pay;
      seat.streetBet += pay;
      seat.committed += pay;
      seat.totalInvested += pay;
      seat.lastAmount = pay;
      seat.lastAction = 'post';
      seat.lastActionLabel = label;
      if (seat.stack === 0) seat.allIn = true;
      this.actions.push({
        seq: ++this.seq, street: 'preflop', seat: seat.index, name: seat.name,
        type: 'post', amount: pay, target: seat.streetBet, potAfter: this._potTotal(),
        label: label + ' ' + pay, allIn: seat.allIn, auto: true
      });
    }

    _beginActionPreflop() {
      const start = (this.bbIndex + 1) % this.n;
      this.actingIndex = this._nextActionable(start);
      if (this.actingIndex === -1) {
        this._roundComplete();
      }
    }

    _nextActionable(from) {
      for (let k = 0; k < this.n; k++) {
        const idx = (from + k) % this.n;
        const s = this.seats[idx];
        if (!s.folded && !s.allIn && s.stack > 0) {
          if (!s.hasActed || s.streetBet < this.currentBet || this.currentBet === 0) return idx;
        }
      }
      return -1;
    }

    _potTotal() {
      return this.seats.reduce((a, s) => a + s.committed, 0);
    }

    _active() {
      return this.seats.filter(s => !s.folded);
    }

    _actionable() {
      return this.seats.filter(s => !s.folded && !s.allIn && s.stack > 0);
    }

    legalActions(seatIndex) {
      const s = this.seats[seatIndex];
      if (!s || this.phase !== 'betting' || this.actingIndex !== seatIndex || s.folded || s.allIn) return null;
      const toCall = Math.max(0, this.currentBet - s.streetBet);
      const callAmount = Math.min(toCall, s.stack);
      const maxTarget = s.streetBet + s.stack;
      let canRaise = maxTarget > this.currentBet && s.stack > 0;
      let minRaiseTo = 0;
      if (canRaise) {
        if (this.currentBet === 0) minRaiseTo = Math.min(this.bb, maxTarget);
        else minRaiseTo = Math.min(this.currentBet + Math.max(this.lastRaiseSize, this.bb), maxTarget);
        if (minRaiseTo <= this.currentBet) minRaiseTo = maxTarget;
      }
      return {
        seatIndex, toCall, callAmount, canCheck: toCall === 0, canCall: toCall > 0 && s.stack > 0,
        canFold: true, canRaise, minRaiseTo, maxRaiseTo: maxTarget,
        canAllIn: s.stack > 0, allInTarget: maxTarget,
        isBet: this.currentBet === 0, pot: this._potTotal(), stack: s.stack,
        currentBet: this.currentBet, lastRaiseSize: this.lastRaiseSize,
        bb: this.bb, position: s.position, street: this.street,
        canBet: this.currentBet === 0 && s.stack > 0
      };
    }

    act(seatIndex, action) {
      const s = this.seats[seatIndex];
      if (!s) throw new Error('座位不存在');
      if (this.phase !== 'betting') throw new Error('当前不在下注阶段');
      if (this.actingIndex !== seatIndex) throw new Error('还没轮到该玩家行动');
      if (s.folded || s.allIn) throw new Error('该玩家无法行动');
      const legal = this.legalActions(seatIndex);
      const type = action.type;
      const potBefore = this._potTotal();
      let paid = 0, target = s.streetBet, finalType = type, label = '', aggressive = false;

      if (type === 'fold') {
        s.folded = true;
        s.hasActed = true;
        s.lastAction = 'fold';
        s.lastActionLabel = '弃牌';
        label = '弃牌';
      } else if (type === 'check') {
        if (legal.toCall > 0) throw new Error('面对下注不能过牌');
        s.hasActed = true;
        s.lastAction = 'check';
        s.lastActionLabel = '过牌';
        label = '过牌';
      } else if (type === 'call') {
        paid = Math.min(legal.toCall, s.stack);
        this._pay(s, paid);
        target = s.streetBet;
        s.hasActed = true;
        s.lastAction = 'call';
        s.allIn = s.stack === 0;
        s.lastActionLabel = s.allIn ? '全下跟注' : '跟注 ' + paid;
        label = s.lastActionLabel;
        finalType = 'call';
      } else if (type === 'raise' || type === 'allin') {
        let desired = type === 'allin' ? legal.maxRaiseTo : Number(action.amount);
        if (!isFinite(desired)) throw new Error('加注金额无效');
        desired = Math.round(desired);
        if (desired <= this.currentBet) {
          // 视为全下跟注
          paid = Math.min(legal.toCall, s.stack);
          this._pay(s, paid);
          target = s.streetBet;
          s.hasActed = true;
          s.lastAction = 'call';
          s.allIn = s.stack === 0;
          label = s.allIn ? '全下跟注' : '跟注 ' + paid;
          finalType = 'call';
        } else {
          if (!legal.canRaise) throw new Error('当前不能加注');
          desired = clamp(desired, Math.min(legal.minRaiseTo, legal.maxRaiseTo), legal.maxRaiseTo);
          if (desired <= this.currentBet) desired = legal.maxRaiseTo;
          const prevBet = this.currentBet;
          const raiseSize = desired - prevBet;
          paid = desired - s.streetBet;
          if (paid > s.stack) paid = s.stack;
          target = s.streetBet + paid;
          const fullRaise = (prevBet === 0 && target >= this.bb) || (prevBet > 0 && raiseSize >= this.lastRaiseSize);
          this._pay(s, paid);
          s.hasActed = true;
          s.lastAction = (prevBet === 0 ? 'bet' : 'raise');
          s.allIn = s.stack === 0;
          aggressive = true;
          if (target > this.currentBet) this.currentBet = target;
          if (fullRaise) {
            this.lastRaiseSize = prevBet === 0 ? target : raiseSize;
            this.seats.forEach(o => { if (o !== s && !o.folded && !o.allIn) o.hasActed = false; });
          } else {
            // 不足最小加注的全下，不重开行动，但未匹配的玩家仍需补齐
            this.lastRaiseSize = Math.max(this.lastRaiseSize, this.bb);
          }
          this.lastAggressor = seatIndex;
          finalType = 'raise';
          label = (prevBet === 0 ? '下注 ' : '加注到 ') + target;
          if (s.allIn) label += ' · 全下';
        }
      } else {
        throw new Error('未知行动: ' + type);
      }

      s.lastAmount = paid;
      this.pot = this._potTotal();
      const rec = {
        seq: ++this.seq, street: this.street, seat: seatIndex, name: s.name,
        type: finalType, amount: paid, target: s.streetBet, potBefore,
        potAfter: this.pot, label: label, allIn: s.allIn, aggressive,
        position: s.position, cards: s.cards.slice(), stackAfter: s.stack,
        actionLabel: label, reasoning: action.reasoning || '', thought: action.thought || '',
        coachGrade: action.coachGrade || null
      };
      this.actions.push(rec);
      if (s.isHero && this.pendingAdvice) {
        this.heroDecisions.push(Object.assign({ actionSeq: rec.seq, actionLabel: label, chosen: finalType }, this.pendingAdvice));
        this.pendingAdvice = null;
      }
      if (s.isHero) s.revealed = true;

      this._afterAction(seatIndex);
      return rec;
    }

    _pay(seat, n) {
      n = Math.max(0, Math.min(seat.stack, Math.round(n)));
      seat.stack -= n;
      seat.streetBet += n;
      seat.committed += n;
      seat.totalInvested += n;
      if (seat.stack <= 0) { seat.stack = 0; seat.allIn = true; }
      return n;
    }

    _afterAction(fromIndex) {
      const alive = this._active();
      if (alive.length === 1) {
        this._finishFold(alive[0]);
        return;
      }
      const actionable = this._actionable();
      const allMatched = actionable.every(o => o.streetBet === this.currentBet);
      const allActed = actionable.every(o => o.hasActed);
      if (actionable.length === 0 || (allMatched && allActed)) {
        this._roundComplete();
        return;
      }
      const next = this._nextActionable((fromIndex + 1) % this.n);
      if (next === -1) this._roundComplete();
      else this.actingIndex = next;
    }

    _roundComplete() {
      this.actingIndex = -1;
      // 重置本街下注
      this.seats.forEach(s => { s.streetBet = 0; s.hasActed = false; });
      this.currentBet = 0;
      this.lastRaiseSize = this.bb;
      this.lastAggressor = null;
      if (this.street === 'river') {
        this._showdown();
        return;
      }
      if (this._actionable().length <= 1) {
        this.phase = 'runout';
        this.pendingRunout = true;
        return;
      }
      this.phase = 'betting';
      this._dealNextStreet();
      const start = (this.button + 1) % this.n;
      this.actingIndex = this._nextActionable(start);
      if (this.actingIndex === -1) this._roundComplete();
    }

    _dealNextStreet() {
      if (this.street === 'preflop') {
        this.board.push(this.deck.shift(), this.deck.shift(), this.deck.shift());
        this.street = 'flop';
      } else if (this.street === 'flop') {
        this.board.push(this.deck.shift());
        this.street = 'turn';
      } else if (this.street === 'turn') {
        this.board.push(this.deck.shift());
        this.street = 'river';
      }
    }

    // 全下后由 UI 分步调用，一张街一张街发牌
    runoutStep() {
      if (this.phase !== 'runout') return false;
      if (this.street === 'river') { this._showdown(); return true; }
      this._dealNextStreet();
      this.actingIndex = -1;
      this.pendingRunout = true;
      return true;
    }

    _setupStreetBetting() {
      this.actingIndex = this._nextActionable((this.button + 1) % this.n);
    }

    _finishFold(winner) {
      const gross = this._potTotal();
      const maxOther = Math.max(0, ...this.seats.filter(s => s.index !== winner.index).map(s => s.committed));
      const refund = Math.max(0, winner.committed - maxOther);
      const pot = gross - refund;
      if (refund > 0) winner.stack += refund;
      winner.stack += pot;
      winner.won = pot;
      const wasHero = winner.isHero;
      this.revealAll = true;
      this.seats.forEach(s => { s.revealed = true; });
      const hero = this.heroSeat;
      this.pot = pot;
      const profit = hero.stack - hero.handStartStack;
      this.phase = 'complete';
      this.actingIndex = -1;
      this.pendingRunout = false;
      this.result = {
        type: 'fold', board: this.board.slice(), pot: pot,
        winners: [{ seatIndex: winner.index, name: winner.name, amount: pot, handName: '无需摊牌', isHero: winner.isHero }],
        refunds: refund > 0 ? [{ seatIndex: winner.index, name: winner.name, amount: refund }] : [],
        showdown: this._showdownPlayers(),
        heroProfit: profit, heroWon: wasHero,
        summary: winner.isHero ? '你收下底池：所有对手都弃牌了。' : (winner.name + ' 收下底池：其他人都弃牌了。'),
        allFolded: true
      };
      this._finalizeRecord();
    }

    _showdownPlayers() {
      return this.seats.map(s => {
        const all = s.cards.concat(this.board);
        let score = -1, desc = null, best = null;
        if (all.length >= 5) {
          score = E.evaluateCards(all);
          desc = E.describe(score);
          best = E.bestFive(all).cards;
        }
        return {
          seatIndex: s.index, name: s.name, cards: s.cards.slice(), folded: s.folded,
          isHero: s.isHero, committed: s.committed, won: s.won || 0, score: score,
          handName: desc ? desc.text : '未摊牌', handCategory: desc ? desc.category : -1,
          bestFive: best, revealed: s.revealed, allIn: s.allIn,
          position: s.position, profile: s.profile ? s.profile.id : 'hero'
        };
      });
    }

    _showdown() {
      this.phase = 'complete';
      this.actingIndex = -1;
      this.pendingRunout = false;
      this.seats.forEach(s => { s.revealed = true; });
      const active = this._active();
      const scores = {};
      active.forEach(s => {
        scores[s.index] = E.evaluateCards(s.cards.concat(this.board));
      });
      // 边池分层
      const levels = Array.from(new Set(this.seats.map(s => s.committed).filter(x => x > 0))).sort((a, b) => a - b);
      const pots = [];
      const refunds = [];
      let refundTotal = 0;
      let prev = 0;
      for (const level of levels) {
        const contributors = this.seats.filter(s => s.committed >= level).length;
        const amount = (level - prev) * contributors;
        const eligible = active.filter(s => s.committed >= level);
        if (amount > 0 && contributors === 1) {
          // 未被跟注的部分退回，不能算作边池
          const only = this.seats.find(s => s.committed >= level);
          if (only) {
            refunds.push({ seatIndex: only.index, name: only.name, amount: amount });
            refundTotal += amount;
            only.stack += amount;
          }
        } else if (amount > 0 && eligible.length) {
          let best = -1;
          eligible.forEach(s => { if (scores[s.index] > best) best = scores[s.index]; });
          const winners = eligible.filter(s => scores[s.index] === best);
          pots.push({
            amount, level, eligible: eligible.map(s => s.index),
            winnerSeats: winners.map(s => s.index),
            winnerNames: winners.map(s => s.name),
            handName: E.describe(best).text
          });
        }
        prev = level;
      }
      // 将边池奖金分给赢家（奇数筹码按按钮左手优先）
      const award = {};
      this.seats.forEach(s => { award[s.index] = 0; });
      const order = [];
      for (let k = 0; k < this.n; k++) order.push((this.button + 1 + k) % this.n);
      pots.forEach(p => {
        const winners = p.winnerSeats.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
        const each = Math.floor(p.amount / winners.length);
        let rem = p.amount - each * winners.length;
        winners.forEach((idx, i) => {
          let amt = each + (i < rem ? 1 : 0);
          award[idx] += amt;
        });
      });
      const pot = this._potTotal() - refundTotal;
      const winners = [];
      Object.keys(award).forEach(k => {
        const idx = Number(k);
        if (award[idx] > 0) {
          const s = this.seats[idx];
          s.stack += award[idx];
          s.won = award[idx];
          const d = E.describe(scores[idx]);
          winners.push({
            seatIndex: idx, name: s.name, amount: award[idx], isHero: s.isHero,
            handName: d ? d.text : '弃牌', handScore: scores[idx] || -1,
            cards: s.cards.slice(), position: s.position
          });
        }
      });
      winners.sort((a, b) => b.amount - a.amount);
      const hero = this.heroSeat;
      const profit = hero.stack - hero.handStartStack;
      this.pot = pot;
      const heroWinner = winners.find(w => w.isHero);
      const sameHand = winners.length > 1 && winners.every(w => w.handScore === winners[0].handScore);
      let summary;
      if (winners.length === 1) {
        summary = winners[0].isHero ? '你赢下底池！' : (winners[0].name + ' 赢下底池。');
        summary += ' ' + winners[0].handName + '。';
      } else if (sameHand) {
        summary = '平分底池：' + winners.map(w => w.name + '（' + w.handName + '）').join('、') + '。';
      } else {
        summary = '边池分配：' + winners.map(w => w.name + ' 赢得 ' + w.amount + '（' + w.handName + '）').join('；') + '。';
      }
      if (refundTotal > 0) summary += ' 未跟注的 ' + refundTotal + ' 已退回。';
      this.result = {
        type: 'showdown', board: this.board.slice(), pot,
        winners, showdown: this._showdownPlayers(), refunds,
        pots, heroProfit: profit, heroWon: !!heroWinner,
        summary, allFolded: false,
        heroHand: hero.cards.length === 2 && this.board.length === 5 ? E.describe(E.evaluateCards(hero.cards.concat(this.board))) : null
      };
      this._finalizeRecord();
    }

    _finalizeRecord() {
      const hero = this.heroSeat;
      this.result.heroCards = hero.cards.slice();
      this.result.heroPosition = hero.position;
      this.result.heroProfitBB = fmtBB(this.result.heroProfit, this.bb);
      this.result.potBB = fmtBB(this.result.pot, this.bb);
      this.result.button = this.button;
      this.result.stacks = this.seats.map(s => ({ name: s.name, stack: s.stack, stackBB: fmtBB(s.stack, this.bb), isHero: s.isHero }));
      this.result.opponents = this.seats.filter(s => !s.isHero).map(s => ({
        id: s.id, name: s.name, title: s.profile ? s.profile.title : '', style: s.profile ? s.profile.styleCN : '',
        cards: s.cards.slice(), folded: s.folded, committed: s.committed,
        profile: s.profile
      }));
      this.result.actions = this.actions.slice();
      this.result.heroDecisions = this.heroDecisions.slice();
      this.result.handNo = this.handNo;
      this.result.startingStacks = this.seats.map(s => ({ name: s.name, stack: s.handStartStack }));
      this.result.scoreboard = this.seats.map(s => ({
        name: s.name, isHero: s.isHero, stack: s.stack, profit: s.stack - s.handStartStack,
        profitBB: fmtBB(s.stack - s.handStartStack, this.bb)
      }));
    }

    buildHandRecord(mode) {
      const r = this.result || {};
      const decisions = (this.heroDecisions || []).map(d => ({
        actionSeq: d.actionSeq, actionLabel: d.actionLabel, chosen: d.chosen,
        street: d.street, position: d.position, handClass: d.handClass,
        potBB: d.potBB, toCall: d.toCall, potOdds: d.potOdds,
        equity: d.equity, equityCI: d.equityCI, requiredEquity: d.requiredEquity,
        spr: d.spr, outs: d.outs, outLabels: d.outLabels, tags: d.tags,
        headline: d.headline, betterLine: d.betterLine,
        best: d.best ? { type: d.best.type, label: d.best.label, amount: d.best.amount, evBB: d.best.evBB } : null,
        options: (d.options || []).map(o => ({ type: o.type, label: o.label, amount: o.amount, evBB: o.evBB })),
        grade: d.grade || null, beginner: d.beginner || [], expert: d.expert || [],
        oppSummaries: (d.oppSummaries || []).map(o => ({ name: o.name, position: o.position, style: o.style, rangePct: o.rangePct, rangeLabel: o.rangeLabel }))
      }));
      return {
        id: 'hand-' + this.config.seed + '-' + this.handNo + '-' + Date.now(),
        createdAt: new Date().toISOString(),
        mode: mode || this.config.mode,
        aiCount: this.config.aiCount,
        startingStack: this.config.startingStack,
        bb: this.bb, sb: this.sb,
        handNo: this.handNo,
        heroCards: this.heroSeat.cards.slice(),
        heroPosition: this.heroSeat.position,
        board: this.board.slice(),
        button: this.button,
        result: {
          type: r.type, board: r.board, pot: r.pot, potBB: r.potBB,
          winners: r.winners, showdown: r.showdown, pots: r.pots, refunds: r.refunds,
          summary: r.summary, heroProfit: r.heroProfit, heroProfitBB: r.heroProfitBB,
          heroWon: r.heroWon, allFolded: r.allFolded, heroHand: r.heroHand,
          actions: r.actions, heroDecisions: decisions,
          stacks: r.stacks, scoreboard: r.scoreboard,
          opponents: (r.opponents || []).map(o => ({
            id: o.id, name: o.name, title: o.title, style: o.style,
            cards: o.cards, folded: o.folded, committed: o.committed
          }))
        },
        opponents: this.seats.filter(s => !s.isHero).map(s => ({
          id: s.id, name: s.name, title: s.profile.title, style: s.profile.styleCN,
          avatar: s.avatar, skill: s.profile.skill,
          stats: s.profile.stats, profile: { bio: s.profile.bio, quote: s.profile.quote }
        }))
      };
    }

    // 供 UI 使用的动作文字
    static actionText(action) {
      if (!action) return '';
      const map = { fold: '弃牌', check: '过牌', call: '跟注', raise: '加注', post: '下注', allin: '全下' };
      return action.label || map[action.type] || action.type;
    }

    // 公开信息（不含 AI 底牌）
    publicSnapshot() {
      return {
        handNo: this.handNo, street: this.street, board: this.board.slice(),
        pot: this._potTotal(), potBB: fmtBB(this._potTotal(), this.bb),
        currentBet: this.currentBet, actingIndex: this.actingIndex,
        phase: this.phase, result: this.result,
        seats: this.seats.map(s => ({
          index: s.index, name: s.name, isHero: s.isHero, stack: s.stack, stackBB: fmtBB(s.stack, this.bb),
          cards: s.isHero || s.revealed ? s.cards.slice() : [null, null],
          folded: s.folded, allIn: s.allIn, position: s.position, isButton: s.isButton,
          isSB: s.isSB, isBB: s.isBB, lastActionLabel: s.lastActionLabel,
          lastAction: s.lastAction, committed: s.committed, streetBet: s.streetBet,
          avatar: s.avatar, profile: s.isHero ? null : { id: s.id, name: s.name, title: s.profile.title, style: s.profile.style, styleCN: s.profile.styleCN, skill: s.profile.skill }
        }))
      };
    }
  }

  PM.PokerGame = PokerGame;
  PM.GameUtils = { fmtBB, POS_BY_OFFSET, clamp };
})(typeof window !== 'undefined' ? window : globalThis);

