/* Texas Mind quick-game UI. Plain React.createElement: the DSH client loader
 * does not run a JSX transform for plugin bundles. */

const PM_STYLE = `
.pm-launch{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;pointer-events:auto;position:relative;z-index:2;
  border:1px solid var(--dsw-alias-border-secondary,rgba(201,164,92,.35));
  background:color-mix(in srgb,var(--dsw-alias-bg-elevated,#10291f) 88%,transparent);
  color:var(--dsw-alias-text-primary,#f3e7c9);font:inherit;font-size:12px;cursor:pointer;
  line-height:1;white-space:nowrap;transition:border-color .15s,background .15s}
.pm-launch:hover{border-color:#c9a45c;background:rgba(201,164,92,.12)}
.pm-launch .pm-spade{font-size:15px;color:#d9b96c;line-height:1}
.pm-overlay{position:fixed;top:14px;right:14px;bottom:14px;left:auto;width:min(470px,calc(100vw - 28px));
  z-index:2147483000;pointer-events:auto;display:flex;flex-direction:column;overflow:hidden;
  background:radial-gradient(120% 90% at 50% 0%,#14372a 0%,#081711 55%,#040c08 100%);
  box-shadow:0 28px 90px rgba(0,0,0,.62),0 0 0 1px rgba(201,164,92,.16);
  border:1px solid rgba(201,164,92,.28);border-radius:18px;
  color:#f4e8cd;font-family:var(--dsw-alias-font-family,ui-sans-serif,system-ui,"Microsoft YaHei",sans-serif);
  font-size:14px;box-sizing:border-box;animation:pm-slide-in .18s ease-out both}
@keyframes pm-slide-in{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}
.pm-overlay *{box-sizing:border-box}
.pm-top{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid rgba(201,164,92,.18);
  background:rgba(3,12,8,.55);flex:none}
.pm-brand{display:flex;align-items:baseline;gap:7px;font-weight:650;letter-spacing:.02em;white-space:nowrap}
.pm-brand .pm-brand-spade{color:#d9b96c;font-size:18px}
.pm-brand small{font-size:9px;font-weight:400;color:rgba(244,232,205,.55);letter-spacing:.06em}
.pm-meta{display:none}
.pm-close{width:30px;height:30px;border-radius:50%;border:1px solid rgba(201,164,92,.28);
  background:rgba(8,24,17,.7);color:#f4e8cd;font-size:18px;line-height:1;cursor:pointer}
.pm-close:hover{border-color:#c9a45c}
.pm-main{display:flex;flex-direction:column;flex:1;min-height:0;padding:10px 12px 6px;gap:8px;overflow:hidden}
.pm-felt{position:relative;flex:none;width:100%;height:34vh;min-height:245px;max-height:330px;border-radius:36% / 30%;
  background:radial-gradient(ellipse at 50% 45%,#1d5a3b 0%,#14442e 48%,#0c2b1e 75%,#071a12 100%);
  border:8px solid #3a2117;box-shadow:inset 0 0 0 2px rgba(201,164,92,.45),inset 0 0 46px rgba(0,0,0,.65),0 12px 34px rgba(0,0,0,.5);
  margin:0}
.pm-felt:before{content:"";position:absolute;inset:10px;border-radius:inherit;border:1px solid rgba(201,164,92,.18);pointer-events:none}
.pm-felt:after{content:"";position:absolute;inset:14% 12%;border-radius:50%;border:1px dashed rgba(201,164,92,.08);pointer-events:none}
.pm-street{position:absolute;top:18%;left:50%;transform:translateX(-50%);font-size:10px;letter-spacing:.22em;color:rgba(244,232,205,.42)}
.pm-pot{position:absolute;top:24%;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;
  padding:5px 13px;border-radius:999px;background:rgba(3,14,9,.6);border:1px solid rgba(201,164,92,.3);
  color:#d9b96c;font-size:12px;white-space:nowrap;box-shadow:0 4px 18px rgba(0,0,0,.3)}
.pm-pot b{color:#f4e8cd;font-size:14px}
.pm-pot i{font-style:normal;color:rgba(244,232,205,.45);font-size:10px}
.pm-board{position:absolute;top:35%;left:50%;transform:translateX(-50%);display:flex;gap:5px;align-items:center;justify-content:center;min-height:62px}
.pm-card{position:relative;width:38px;height:54px;border-radius:5px;background:linear-gradient(135deg,#fffaf0,#ece2cb);color:#161616;
  display:block;flex:none;overflow:hidden;
  box-shadow:0 3px 9px rgba(0,0,0,.42),inset 0 0 0 1px rgba(0,0,0,.13);font-weight:700;user-select:none}
.pm-card .pm-corner{position:absolute;top:4px;left:4px;display:flex;flex-direction:column;align-items:center;line-height:.9}
.pm-card .pm-rank{font-size:15px;line-height:1;font-weight:800;font-family:Georgia,"Times New Roman",serif}
.pm-card .pm-suit{font-size:10px;line-height:1;margin-top:1px;font-style:normal}
.pm-card .pm-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:21px;line-height:1;opacity:.92}
.pm-card .pm-corner-bottom{top:auto;left:auto;right:4px;bottom:4px;transform:rotate(180deg)}
.pm-card.red{color:#b52b34}
.pm-card.pm-back{background:linear-gradient(145deg,#174d36,#0b2c1e);color:#d9b96c;
  border:2px solid #b99352;box-shadow:inset 0 0 0 2px #102d20,0 3px 10px rgba(0,0,0,.4)}
.pm-card.pm-back .pm-back-mark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;opacity:.85}
.pm-card.pm-empty{background:transparent;border:1px dashed rgba(201,164,92,.22);box-shadow:none}
.pm-card.pm-empty:after{content:"";position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border:1px solid rgba(201,164,92,.15);transform:rotate(45deg)}
.pm-card.pm-small{width:27px;height:38px;border-radius:4px}
.pm-card.pm-small .pm-corner{top:3px;left:3px}
.pm-card.pm-small .pm-rank{font-size:11px}
.pm-card.pm-small .pm-center{font-size:14px}
.pm-card.pm-small .pm-corner-bottom{display:none}
.pm-card.pm-mini{width:22px;height:31px;border-radius:3px}
.pm-card.pm-mini .pm-corner{top:2px;left:2px}
.pm-card.pm-mini .pm-rank{font-size:9px}
.pm-card.pm-mini .pm-center{font-size:11px}
.pm-card.pm-mini .pm-corner-bottom{display:none}
.pm-seat{position:absolute;width:112px;text-align:center;transition:opacity .2s,filter .2s;z-index:2}
.pm-seat.pm-top{top:1%;left:50%;transform:translateX(-50%)}
.pm-seat.pm-left{top:31%;left:0}
.pm-seat.pm-right{top:31%;right:0}
.pm-seat.pm-hero{bottom:11%;left:50%;transform:translateX(-50%)}
.pm-seat.pm-folded{opacity:.4;filter:grayscale(.55)}
.pm-seat.pm-active .pm-avatar{box-shadow:0 0 0 3px #d9b96c,0 0 22px rgba(217,185,108,.45)}
.pm-seat.pm-winner .pm-avatar{box-shadow:0 0 0 3px #e9c477,0 0 26px rgba(233,196,119,.55)}
.pm-avatar{width:42px;height:42px;margin:0 auto 2px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:15px;font-weight:700;color:#f4e8cd;border:2px solid rgba(201,164,92,.65);
  background:radial-gradient(circle at 35% 30%,#356b50,#163a29);box-shadow:0 4px 14px rgba(0,0,0,.45);
  transition:box-shadow .2s}
.pm-seat.pm-hero .pm-avatar{width:48px;height:48px;border-color:#d9b96c}
.pm-seat-name{display:flex;align-items:center;justify-content:center;gap:4px;font-size:12px;font-weight:600;
  text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-pos{font-size:9px;font-weight:600;letter-spacing:.04em;padding:1px 4px;border-radius:3px;
  background:rgba(201,164,92,.18);color:#d9b96c;border:1px solid rgba(201,164,92,.22)}
.pm-stack{font-size:10px;color:rgba(244,232,205,.6);margin-top:1px}
.pm-stack b{color:#f4e8cd;font-weight:600}
.pm-seat-cards{display:flex;gap:3px;justify-content:center;margin-top:4px}
.pm-bet{display:inline-flex;align-items:center;gap:4px;margin-top:3px;padding:2px 7px;border-radius:999px;
  background:rgba(3,14,9,.82);border:1px solid rgba(201,164,92,.42);color:#f0d38e;font-size:10px;font-weight:600;
  box-shadow:0 3px 10px rgba(0,0,0,.28)}
.pm-bet:before{content:"";width:7px;height:7px;border-radius:50%;background:#d9b96c;box-shadow:0 0 0 2px rgba(217,185,108,.18)}
.pm-thinking{position:absolute;left:50%;transform:translateX(-50%);top:-26px;white-space:nowrap;
  padding:3px 9px;border-radius:999px;background:rgba(4,16,10,.9);border:1px solid rgba(201,164,92,.35);
  color:#d9b96c;font-size:10px}
.pm-thought{position:absolute;left:50%;transform:translateX(-50%);bottom:-24px;width:190px;text-align:center;pointer-events:none;
  font-size:10px;line-height:1.35;color:rgba(244,232,205,.55)}
.pm-dealer{display:inline-flex;width:17px;height:17px;border-radius:50%;align-items:center;justify-content:center;
  background:#e9d6a2;color:#182116;font-size:9px;font-weight:800;box-shadow:0 2px 5px rgba(0,0,0,.4)}
.pm-coach{width:auto;flex:1;display:flex;flex-direction:column;min-height:110px;
  background:linear-gradient(180deg,rgba(9,34,23,.92),rgba(4,16,10,.95));border:1px solid rgba(201,164,92,.2);
  border-radius:12px;overflow:auto}
.pm-coach-head{display:flex;align-items:center;gap:7px;padding:13px 15px 9px;border-bottom:1px solid rgba(201,164,92,.12);
  font-size:12px;font-weight:600;color:#e7d2a3;position:sticky;top:0;background:rgba(9,34,23,.97);z-index:2}
.pm-coach-head:before{content:"";width:6px;height:6px;border-radius:50%;background:#6fc08f;box-shadow:0 0 7px #6fc08f}
.pm-coach-head span{margin-left:auto;font-size:9px;font-weight:500;color:rgba(244,232,205,.42);letter-spacing:.06em}
.pm-coach-body{padding:12px 15px 16px}
.pm-calc{padding:20px 4px;color:rgba(244,232,205,.55);font-size:12px}
.pm-headline{font-size:16px;line-height:1.55;font-weight:650;color:#f7ebd1;letter-spacing:.01em}
.pm-tags{display:flex;flex-wrap:wrap;gap:5px;margin:9px 0 2px}
.pm-tag{font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(201,164,92,.12);color:#dcc189;border:1px solid rgba(201,164,92,.18)}
.pm-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:11px 0}
.pm-metric{padding:7px 5px;border-radius:8px;background:rgba(255,255,255,.035);border:1px solid rgba(201,164,92,.12);text-align:center}
.pm-metric b{display:block;font-size:10px;color:rgba(244,232,205,.45);font-weight:500;margin-bottom:2px}
.pm-metric strong{font-size:14px;color:#f2dfb1;font-weight:650}
.pm-better{font-size:12px;line-height:1.55;color:rgba(244,232,205,.76);padding:9px 10px;border-radius:8px;
  background:rgba(201,164,92,.07);border-left:2px solid #c9a45c;margin:10px 0}
.pm-better b{color:#e8cd91;font-weight:600}
.pm-sub{display:flex;align-items:center;justify-content:space-between;margin:7px 0 4px;font-size:10px;color:rgba(244,232,205,.4)}
.pm-sub button{border:0;background:transparent;color:#d9b96c;font:inherit;font-size:11px;cursor:pointer;padding:3px}
.pm-section{padding:9px 0;border-top:1px solid rgba(201,164,92,.09);font-size:12px;line-height:1.62;color:rgba(244,232,205,.7)}
.pm-section h4{font-size:10px;letter-spacing:.1em;color:#c9a45c;margin:0 0 3px;font-weight:650}
.pm-section p{margin:0}
.pm-grade{display:flex;align-items:center;gap:8px;margin-top:10px;padding:7px 9px;border-radius:8px;background:rgba(110,180,135,.08);font-size:11px}
.pm-grade b{color:#9fd8b2;font-size:13px}
.pm-turnbar{flex:none;display:flex;align-items:center;gap:8px;margin:0 16px 4px;padding:7px 11px;border-radius:8px;
  border:1px solid rgba(201,164,92,.16);background:rgba(5,22,15,.72);color:rgba(244,232,205,.58);font-size:12px;z-index:7}
.pm-turnbar strong{font-size:12.5px;font-weight:600;color:rgba(244,232,205,.82)}
.pm-turnbar small{margin-left:auto;font-size:11px;color:rgba(244,232,205,.42)}
.pm-turnbar.is-hero{border-color:rgba(217,185,108,.55);background:linear-gradient(90deg,rgba(201,164,92,.17),rgba(5,22,15,.78));
  box-shadow:0 0 0 1px rgba(201,164,92,.08),0 0 22px rgba(201,164,92,.08)}
.pm-turnbar.is-hero strong{color:#f6e3b3}
.pm-turn-dot{width:7px;height:7px;border-radius:50%;background:rgba(244,232,205,.3);flex:none}
.pm-turnbar.is-hero .pm-turn-dot{background:#e3c17b;box-shadow:0 0 8px #d9b96c}
.pm-actions{position:relative;z-index:6;flex:none;padding:8px 16px 14px;display:flex;gap:8px;align-items:center;justify-content:center;
  background:linear-gradient(0deg,rgba(2,10,6,.9),rgba(2,10,6,0))}
.pm-btn{height:42px;min-width:96px;padding:0 18px;border-radius:8px;border:1px solid rgba(201,164,92,.28);
  background:rgba(13,38,26,.92);color:#f4e8cd;font:inherit;font-size:13px;font-weight:600;cursor:pointer;
  transition:transform .1s,border-color .15s,background .15s}
.pm-btn:hover:not(:disabled){border-color:#c9a45c;background:rgba(28,62,43,.95)}
.pm-btn:active:not(:disabled){transform:translateY(1px)}
.pm-btn:disabled{opacity:.4;cursor:not-allowed}
.pm-btn.pm-fold{color:#e9a1a1;border-color:rgba(220,120,120,.24)}
.pm-btn.pm-call{color:#f6e9c8}
.pm-btn.pm-raise{background:linear-gradient(180deg,#e3c17b,#bd8f45);color:#152014;border-color:#e6c98d;font-weight:750}
.pm-btn.pm-raise:hover:not(:disabled){background:linear-gradient(180deg,#efd193,#cda05a)}
.pm-btn.pm-allin{color:#f0d38e;border-color:rgba(201,164,92,.5)}
.pm-raise-panel{position:absolute;left:50%;bottom:72px;transform:translateX(-50%);z-index:8;width:min(560px,calc(100% - 32px));
  padding:14px 16px;border-radius:14px;background:rgba(7,28,19,.98);border:1px solid rgba(201,164,92,.3);
  box-shadow:0 18px 60px rgba(0,0,0,.55)}
.pm-raise-top{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px}
.pm-raise-top strong{font-size:13px;color:#e7d2a3}
.pm-raise-top span{font-size:11px;color:rgba(244,232,205,.5)}
.pm-raise-val{font-size:24px;font-weight:700;color:#f5dfa0;line-height:1.2;margin-bottom:7px}
.pm-raise-val small{font-size:11px;font-weight:400;color:rgba(244,232,205,.45);margin-left:6px}
.pm-raise input[type=range]{width:100%;accent-color:#d9b96c;height:22px}
.pm-presets{display:flex;gap:6px;margin:7px 0 11px;flex-wrap:wrap}
.pm-preset{flex:1;min-width:58px;height:30px;border-radius:6px;border:1px solid rgba(201,164,92,.2);
  background:rgba(255,255,255,.035);color:rgba(244,232,205,.8);font:inherit;font-size:11px;cursor:pointer}
.pm-preset:hover{border-color:#c9a45c;color:#f5dfa0}
.pm-raise-actions{display:flex;gap:8px}
.pm-raise-actions .pm-btn{height:38px;flex:1;min-width:0}
.pm-result-mask{position:absolute;inset:0;z-index:10;background:rgba(2,9,6,.78);display:flex;align-items:center;justify-content:center;padding:24px}
.pm-result-card{width:min(620px,100%);max-height:92%;overflow:auto;border-radius:18px;padding:22px 24px;
  background:linear-gradient(180deg,#0d2a1e,#06160f);border:1px solid rgba(201,164,92,.32);box-shadow:0 24px 80px rgba(0,0,0,.6)}
.pm-eyebrow{font-size:9px;letter-spacing:.22em;color:rgba(201,164,92,.7);margin-bottom:6px}
.pm-result-card h2{margin:0;font-size:24px;font-weight:650;color:#f7ebd1;letter-spacing:.02em}
.pm-result-sub{font-size:12px;color:rgba(244,232,205,.55);margin:6px 0 12px;line-height:1.5}
.pm-result-net{font-size:26px;font-weight:750;color:#8fd6a7;margin-bottom:2px}
.pm-result-net.loss{color:#e39b9b}
.pm-result-net small{font-size:11px;font-weight:400;color:rgba(244,232,205,.45);margin-left:6px}
.pm-result-board{display:flex;gap:5px;justify-content:center;margin:14px 0}
.pm-result-list{display:flex;flex-direction:column;gap:5px;margin:12px 0 16px}
.pm-result-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;background:rgba(255,255,255,.03);border:1px solid transparent}
.pm-result-row.hero{border-color:rgba(201,164,92,.32);background:rgba(201,164,92,.07)}
.pm-result-row .pm-rn{flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pm-result-row .pm-rn small{display:block;font-size:9px;color:rgba(244,232,205,.42);margin-top:1px}
.pm-result-row .pm-rc{display:flex;gap:2px}
.pm-result-row .pm-rv{font-size:11px;color:#d9b96c;min-width:52px;text-align:right}
.pm-result-row .pm-rv.loss{color:#d89494}
.pm-result-actions{display:flex;gap:8px}
.pm-result-actions .pm-btn{flex:1}
.pm-err{position:absolute;left:50%;top:72px;transform:translateX(-50%);z-index:12;max-width:90%;padding:8px 14px;
  border-radius:8px;background:rgba(100,25,25,.94);color:#ffd9d9;font-size:12px;border:1px solid rgba(255,120,120,.35)}
@media(max-width:900px){.pm-meta{display:none}}
@media(max-width:760px){.pm-overlay{top:8px;right:8px;bottom:8px;width:calc(100vw - 16px);border-radius:12px}
  .pm-main{padding:8px}.pm-felt{height:31vh;min-height:210px;border-width:6px}
  .pm-seat{width:100px}.pm-avatar{width:38px;height:38px;font-size:14px}
  .pm-seat.pm-hero .pm-avatar{width:44px;height:44px}.pm-card{width:34px;height:48px}
  .pm-card .pm-rank{font-size:13px}.pm-card .pm-center{font-size:18px}
  .pm-actions{padding:6px 8px 10px}.pm-btn{min-width:0;flex:1;padding:0 8px}}
`;

/* The launch button lives in the composer dock, but the table is rendered in
 * shell.overlay so it is not clipped by the composer's layout/overflow. */
const overlayApi = { launch: null, close: null, pending: false };

function PokerLaunchButton() {
  return h(React.Fragment, null,
    h('style', { key: 'pm-style' }, PM_STYLE),
    h('button', {
      key: 'pm-launch',
      type: 'button',
      className: 'pm-launch',
      title: '德州心法 · 快速牌局',
      onPointerDown: (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (overlayApi.launch) overlayApi.launch();
        else overlayApi.pending = true;
      },
      onClick: (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (overlayApi.launch) overlayApi.launch();
        else overlayApi.pending = true;
      }
    },
      h('span', { className: 'pm-spade' }, '♠'), h('span', null, '快速牌局'))
  );
}

function cardNode(card, opts) {
  const o = opts || {};
  if (o.hidden) {
    return h('div', { className: 'pm-card pm-back ' + (o.cls || '') }, h('span', { className: 'pm-back-mark' }, '♠'));
  }
  if (card == null) {
    return h('div', { className: 'pm-card pm-empty ' + (o.cls || '') });
  }
  const suit = PM.Cards.suitOf(card);
  const red = suit === 1 || suit === 2;
  const rawRank = PM.Cards.rankChar(card);
  const rank = rawRank === 'T' ? '10' : rawRank;
  // Cards.suitChar() is the lowercase wire format (s/h/d/c); the UI wants
  // the actual suit glyphs so a card reads like a real playing card.
  const suitChar = PM.Cards.SUIT_SYMBOL[suit];
  return h('div', { className: 'pm-card ' + (red ? 'red ' : '') + (o.cls || '') },
    h('span', { className: 'pm-corner' }, h('b', { className: 'pm-rank' }, rank)),
    h('span', { className: 'pm-center' }, suitChar),
    h('span', { className: 'pm-corner pm-corner-bottom' }, h('b', { className: 'pm-rank' }, rank))
  );
}

function fmtBB(n) {
  const v = Number(n) || 0;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

function fmtPct(n) {
  if (n == null || !isFinite(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}

function hashColor(name) {
  let x = 0;
  for (let i = 0; i < String(name).length; i++) x = (x * 31 + String(name).charCodeAt(i)) & 0xffff;
  return 'hsl(' + (x % 360) + ' 34% 24%)';
}

const STATS_KEY = 'poker-mind-dsh-stats-v1';
function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (s && typeof s.hands === 'number') return { hands: s.hands, wins: s.wins || 0, net: Number(s.net) || 0 };
  } catch (e) {}
  return { hands: 0, wins: 0, net: 0 };
}
function saveStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) {}
}

function Seat(props) {
  const { seat, spot, active, winner, thinking, thought } = props;
  if (!seat) return null;
  const folded = seat.folded;
  const cls = 'pm-seat pm-' + spot + (folded ? ' pm-folded' : '') + (active ? ' pm-active' : '') + (winner ? ' pm-winner' : '');
  const cards = seat.isHero ? seat.cards : (seat.cards || [null, null]);
  return h('div', { className: cls },
    thinking ? h('div', { className: 'pm-thinking' }, thought || '思考中…') : null,
    h('div', { className: 'pm-avatar', style: { background: seat.isHero ? 'radial-gradient(circle at 35% 30%,#7b5a2f,#2d1d10)' : hashColor(seat.name) } },
      seat.isHero ? '你' : String(seat.name || '?').slice(0, 1)),
    h('div', { className: 'pm-seat-name' },
      h('span', null, seat.isHero ? '你' : seat.name),
      seat.position ? h('span', { className: 'pm-pos' }, seat.position) : null,
      seat.isButton ? h('span', { className: 'pm-dealer' }, 'D') : null
    ),
    h('div', { className: 'pm-stack' }, h('b', null, seat.stack), ' · ', seat.stackBB, 'BB'),
    h('div', { className: 'pm-seat-cards' },
      cards.map((c, i) => cardNode(c, { hidden: c == null, cls: seat.isHero ? 'pm-small' : 'pm-small' }))
    ),
    seat.streetBet > 0 ? h('div', { className: 'pm-bet' }, '下注 ' + seat.streetBet) : null,
    thought && !thinking ? h('div', { className: 'pm-thought' }, thought) : null
  );
}

function CoachPanel(props) {
  const { advice, calc, thinking, thought, grade, expanded, setExpanded } = props;
  if (calc) return h('aside', { className: 'pm-coach' },
    h('div', { className: 'pm-coach-head' }, '实时教练', h('span', null, '计算中')),
    h('div', { className: 'pm-coach-body' }, h('div', { className: 'pm-calc' }, '正在估算胜率、范围与赔率…'))
  );
  if (!advice) {
    return h('aside', { className: 'pm-coach' },
      h('div', { className: 'pm-coach-head' }, '实时教练', h('span', null, '等待行动')),
      h('div', { className: 'pm-coach-body' },
        h('div', { className: 'pm-headline' }, thinking ? '对手正在思考。' : '轮到你了。'),
        h('div', { className: 'pm-section' }, h('p', null,
          thinking ? (thought || '观察对手的下注尺度，范围会随着行动变化。') :
          '看牌、算赔率，再做决定。教练会在你行动前给出胜率、范围和更优解。')),
        grade ? h('div', { className: 'pm-grade' },
          h('span', null, '上一手评价'), h('b', null, grade.label),
          h('span', null, 'EV 损失 ' + Number(grade.lossBB || 0).toFixed(2) + 'BB')) : null
      )
    );
  }
  const tags = (advice.tags || []).slice(0, 5);
  const sections = advice.beginner || [];
  return h('aside', { className: 'pm-coach' },
    h('div', { className: 'pm-coach-head' }, '实时教练', h('span', null, advice.street === 'preflop' ? '翻前' : advice.street.toUpperCase())),
    h('div', { className: 'pm-coach-body' },
      h('div', { className: 'pm-headline' }, advice.headline),
      h('div', { className: 'pm-tags' }, tags.map((t, i) => h('span', { key: i, className: 'pm-tag' }, t))),
      h('div', { className: 'pm-metrics' },
        h('div', { className: 'pm-metric' }, h('b', null, '估算胜率'), h('strong', null, fmtPct(advice.equity))),
        h('div', { className: 'pm-metric' }, h('b', null, '底池赔率'), h('strong', null, advice.toCall > 0 ? fmtPct(advice.potOdds) : '—')),
        h('div', { className: 'pm-metric' }, h('b', null, '补牌'), h('strong', null, advice.outs || 0)),
        h('div', { className: 'pm-metric' }, h('b', null, 'SPR'), h('strong', null, Number(advice.spr || 0).toFixed(1)))
      ),
      h('div', { className: 'pm-better' }, h('b', null, '更优解：'), advice.betterLine),
      h('div', { className: 'pm-sub' }, h('span', null, '位置 ' + advice.position + ' · ' + advice.handClass), h('button', { type: 'button', className: 'pm-link', onClick: () => setExpanded(!expanded) }, expanded ? '收起拆解' : '展开拆解')),
      expanded ? sections.map((s, i) => h('div', { className: 'pm-section', key: i },
        h('h4', null, s.title), h('p', null, s.text)
      )) : null,
      h('div', { className: 'pm-sub' }, h('span', null, '对手范围估算')),
      (advice.oppSummaries || []).map((o, i) => h('div', { className: 'pm-section', key: 'o' + i },
        h('h4', null, (o.name || '对手') + ' · ' + (o.style || '') + ' · ' + (o.position || '')),
        h('p', null, '约 ' + fmtPct(o.rangePct) + '；' + (o.rangeLabel || '—'))
      )),
      grade ? h('div', { className: 'pm-grade' },
        h('span', null, '上一手评价'), h('b', null, grade.label),
        h('span', null, 'EV 损失 ' + Number(grade.lossBB || 0).toFixed(2) + 'BB · ' + (grade.note || ''))) : null
    )
  );
}

function ResultPanel(props) {
  const { result, onNext, onClose } = props;
  if (!result) return null;
  const winners = result.winners || [];
  const heroWon = winners.some(w => w.isHero);
  const winnerText = winners.length ? winners.map(w => w.name).join('、') : '无人';
  const rows = (result.showdown || []).slice().sort((a, b) => (b.isHero ? 1 : 0) - (a.isHero ? 1 : 0));
  return h('div', { className: 'pm-result-mask' },
    h('div', { className: 'pm-result-card' },
      h('div', { className: 'pm-eyebrow' }, 'HAND COMPLETE · 第 ' + (result.handNo || '—') + ' 手'),
      h('h2', null, heroWon ? '你拿下了这一手' : winnerText + ' 拿下底池'),
      h('div', { className: 'pm-result-sub' }, result.summary || ''),
      h('div', { className: 'pm-result-net' + (Number(result.heroProfit) < 0 ? ' loss' : '') },
        fmtBB(Number(result.heroProfit || 0) / (result.bb || 2)) + ' BB',
        h('small', null, '本手净值 · 底池 ' + (result.pot || 0))),
      h('div', { className: 'pm-result-board' },
        (result.board || []).map((c, i) => cardNode(c, { key: i, cls: 'pm-small' }))),
      h('div', { className: 'pm-result-list' },
        rows.map((s, i) => {
          const sb = (result.scoreboard || []).find(x => x.name === s.name) || {};
          return h('div', { className: 'pm-result-row' + (s.isHero ? ' hero' : ''), key: i },
            h('div', { className: 'pm-rn' }, s.name + (s.isHero ? ' · 你' : ''), h('small', null, (s.handName || '') + (s.folded ? ' · 已弃牌' : ''))),
            h('div', { className: 'pm-rc' }, (s.cards || []).map((c, j) => cardNode(c, { key: j, cls: 'pm-mini' }))),
            h('div', { className: 'pm-rv' + (Number(sb.profit) < 0 ? ' loss' : '') }, (sb.profitBB || fmtBB(0)) + ' BB')
          );
        })),
      h('div', { className: 'pm-result-actions' },
        h('button', { type: 'button', className: 'pm-btn', onClick: onClose }, '关闭牌桌'),
        h('button', { type: 'button', className: 'pm-btn pm-raise', onClick: onNext }, '再来一手')
      )
    )
  );
}

function PokerTable() {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [legal, setLegal] = useState(null);
  const [result, setResult] = useState(null);
  const [thinking, setThinking] = useState(-1);
  const [thought, setThought] = useState('');
  const [calc, setCalc] = useState(false);
  const [err, setErr] = useState('');
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseTo, setRaiseTo] = useState(0);
  const [grade, setGrade] = useState(null);
  const [stats, setStats] = useState(loadStats);
  const [expanded, setExpanded] = useState(true);
  const gameRef = useRef(null);
  const timerRef = useRef(null);
  const tokenRef = useRef(0);
  const openRef = useRef(false);
  const statsRef = useRef(stats);
  const lastHandRef = useRef(0);
  statsRef.current = stats;

  function sync() {
    const g = gameRef.current;
    if (!g) return;
    setSnap(g.publicSnapshot());
    const heroTurn = g.phase === 'betting' && g.actingIndex === 0;
    setLegal(heroTurn ? g.legalActions(0) : null);
    if (g.phase === 'complete' && g.result) {
      setResult(g.result);
      setLegal(null);
      setCalc(false);
      recordResult(g);
    } else {
      setResult(null);
    }
  }

  function recordResult(g) {
    if (!g.result || g.handNo === lastHandRef.current) return;
    lastHandRef.current = g.handNo;
    const s = { ...statsRef.current };
    s.hands += 1;
    if (g.result.heroWon) s.wins += 1;
    s.net = +(s.net + Number(g.result.heroProfit || 0) / g.bb).toFixed(1);
    statsRef.current = s;
    setStats(s);
    saveStats(s);
  }

  function newGame() {
    const pool = PM.Opponents.OPPONENTS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const g = new PM.PokerGame({
      aiCount: 3, mode: 'beginner', startingStack: 200, sb: 1, bb: 2,
      heroName: '你', profiles: pool.slice(0, 3), seed: (Date.now() & 0x7fffffff)
    });
    g.startHand();
    gameRef.current = g;
    lastHandRef.current = 0;
    setResult(null);
    setAdvice(null);
    setGrade(null);
    setRaiseOpen(false);
    sync();
    kick();
  }

  function close() {
    openRef.current = false;
    tokenRef.current++;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setOpen(false);
    setRaiseOpen(false);
  }

  function launch() {
    setOpen(true);
    openRef.current = true;
    if (!gameRef.current) newGame();
    else { sync(); kick(); }
  }

  function kick() {
    if (!openRef.current) return;
    const token = ++tokenRef.current;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    const g = gameRef.current;
    if (!g) return;
    if (g.phase === 'complete') { sync(); return; }
    if (g.phase === 'runout') {
      setThinking(-1);
      setThought('全下后发完公共牌…');
      timerRef.current = setTimeout(() => {
        if (token !== tokenRef.current || !openRef.current) return;
        try { g.runoutStep(); } catch (e) { setErr(String(e.message || e)); }
        sync(); kick();
      }, 620);
      return;
    }
    if (g.phase !== 'betting') return;
    if (g.actingIndex === 0) {
      setThinking(-1);
      setThought('');
      setCalc(true);
      setAdvice(null);
      setLegal(g.legalActions(0));
      sync();
      timerRef.current = setTimeout(() => {
        if (token !== tokenRef.current || !openRef.current) return;
        let a = null;
        try { a = PM.Coach.advise(g, 0); } catch (e) { setErr(String(e.message || e)); }
        setAdvice(a);
        setCalc(false);
        setLegal(g.legalActions(0));
      }, 70);
      return;
    }
    const idx = g.actingIndex;
    const seat = g.seats[idx];
    setThinking(idx);
    setThought('正在整理范围…');
    setCalc(false);
    setAdvice(null);
    sync();
    timerRef.current = setTimeout(() => {
      if (token !== tokenRef.current || !openRef.current) return;
      let d = null;
      try { d = PM.AI.decide(g, idx); } catch (e) { setErr(String(e.message || e)); }
      if (!d) {
        const l = g.legalActions(idx);
        d = { type: l && l.canCheck ? 'check' : 'fold', label: '过牌/弃牌' };
      }
      setThought(d.thought || (seat.name + ' 正在思考…'));
      setThinking(idx);
      timerRef.current = setTimeout(() => {
        if (token !== tokenRef.current || !openRef.current) return;
        try {
          g.act(idx, { type: d.type, amount: d.amount, target: d.target, reasoning: d.reasoning, thought: d.thought });
        } catch (e) {
          setErr(String(e.message || e));
          try { g.act(idx, { type: g.legalActions(idx).canCheck ? 'check' : 'fold' }); } catch (e2) {}
        }
        setThinking(-1);
        setThought('');
        sync(); kick();
      }, 420);
    }, 320);
  }

  function actHero(type, amount) {
    const g = gameRef.current;
    if (!g || g.actingIndex !== 0 || g.phase !== 'betting') return;
    if (advice) g.pendingAdvice = advice;
    try {
      g.act(0, { type: type, amount: amount });
    } catch (e) {
      setErr(String(e.message || e));
      return;
    }
    if (advice) setGrade(PM.Coach.gradeChosen(advice, type, amount));
    setAdvice(null);
    setCalc(false);
    setRaiseOpen(false);
    sync();
    kick();
  }

  function openRaise() {
    const g = gameRef.current;
    const l = g && g.legalActions(0);
    if (!l || !l.canRaise) return;
    const target = Math.min(l.maxRaiseTo, Math.max(l.minRaiseTo, Math.round((g.pot + g.currentBet) * 0.66)));
    setRaiseTo(target);
    setRaiseOpen(true);
  }

  function preset(f) {
    const g = gameRef.current;
    const l = legal;
    if (!g || !l) return;
    const base = g.pot + (l.toCall || 0);
    let t = g.currentBet + Math.max(g.bb, Math.round(base * f));
    if (f >= 1.2) t = l.maxRaiseTo;
    t = Math.min(l.maxRaiseTo, Math.max(l.minRaiseTo, t));
    setRaiseTo(t);
  }

  function nextHand() {
    const g = gameRef.current;
    if (!g) return;
    try { g.startHand(); } catch (e) { setErr(String(e.message || e)); return; }
    setResult(null);
    setAdvice(null);
    setGrade(null);
    setRaiseOpen(false);
    setExpanded(true);
    sync();
    kick();
  }

  overlayApi.launch = launch;
  overlayApi.close = close;

  useEffect(() => {
    if (overlayApi.pending) {
      overlayApi.pending = false;
      launch();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (raiseOpen) setRaiseOpen(false);
        else close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, raiseOpen]);

  useEffect(() => () => {
    openRef.current = false;
    tokenRef.current++;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (overlayApi.launch === launch) overlayApi.launch = null;
    if (overlayApi.close === close) overlayApi.close = null;
  }, []);

  const g = gameRef.current;
  const seats = snap ? snap.seats : [];
  const hero = seats.find(s => s.isHero) || {};
  const ais = seats.filter(s => !s.isHero);
  const winnerIdx = result ? (result.winners || []).map(w => w.seatIndex) : [];
  const heroTurn = !!(legal && !(thinking >= 0) && !calc && !result);
  const thinkingSeat = thinking >= 0 ? seats[thinking] : null;
  const turnText = result ? '本手结束'
    : calc ? '教练正在计算…'
      : thinkingSeat ? (thinkingSeat.name + ' 正在思考…')
        : heroTurn ? (legal && legal.canCheck ? '轮到你行动 · 可以过牌或下注' : '轮到你行动 · 可跟注 ' + (legal ? legal.callAmount : 0))
          : (snap && snap.phase === 'runout' ? '全下后发完公共牌…' : '等待行动');

  const renderSeat = (s, spot) => h(Seat, {
    key: s.index, seat: s, spot: spot,
    active: snap && snap.actingIndex === s.index && !result,
    winner: winnerIdx.indexOf(s.index) >= 0,
    thinking: thinking === s.index,
    thought: thinking === s.index ? thought : ''
  });

  return h(React.Fragment, null,
    h('style', { key: 'pm-style' }, PM_STYLE),
    open ? h('div', { key: 'pm-overlay', className: 'pm-overlay', role: 'dialog', 'aria-label': '德州心法快速牌局' },
      h('div', { className: 'pm-top' },
        h('div', { className: 'pm-brand' }, h('span', { className: 'pm-brand-spade' }, '♠'), '德州心法', h('small', null, 'DSH QUICK TABLE')),
        h('div', { className: 'pm-meta' },
          (snap ? (snap.seats.length + ' 人桌 · 1/2 · 第 ' + (snap.handNo || 0) + ' 手') : '4 人桌 · 1/2') +
          '　|　' + stats.hands + ' 手 · 胜 ' + stats.wins + ' · 净 ' + fmtBB(stats.net) + 'BB'),
        h('button', { type: 'button', className: 'pm-close', onClick: close, 'aria-label': '关闭牌桌' }, '×')
      ),
      h('div', { className: 'pm-main' },
        h('div', { className: 'pm-felt' },
          h('div', { className: 'pm-street' }, snap ? String(snap.street || '').toUpperCase() : ''),
          h('div', { className: 'pm-pot' }, h('i', null, '底池'), h('b', null, snap ? snap.pot : 0), h('i', null, (snap ? snap.potBB : 0) + 'BB')),
          h('div', { className: 'pm-board' },
            [0, 1, 2, 3, 4].map(i => snap && snap.board[i] != null
              ? cardNode(snap.board[i], { key: i })
              : h('div', { key: i, className: 'pm-card pm-empty' }))),
          ais[0] ? renderSeat(ais[0], 'top') : null,
          ais[1] ? renderSeat(ais[1], 'left') : null,
          ais[2] ? renderSeat(ais[2], 'right') : null,
          hero && hero.name ? renderSeat(hero, 'hero') : null
        ),
        h(CoachPanel, { advice, calc, thinking, thought, grade, expanded, setExpanded })
      ),
      thinkingSeat ? h('div', { className: 'pm-thought', style: { position: 'absolute', bottom: '78px', left: '50%', transform: 'translateX(-50%)', zIndex: 4 } }, thought) : null,
      err ? h('div', { className: 'pm-err', onClick: () => setErr('') }, err + '（点击关闭）') : null,
      raiseOpen ? h('div', { className: 'pm-raise-panel' },
        h('div', { className: 'pm-raise-top' }, h('strong', null, '加注'), h('span', null, '目标筹码 · ' + Math.round(raiseTo / Math.max(1, (snap && snap.pot) || 1) * 100) + '% 底池')),
        h('div', { className: 'pm-raise-val' }, raiseTo, h('small', null, '筹码 / ' + (raiseTo / 2).toFixed(1) + 'BB')),
        h('input', { type: 'range', min: legal ? legal.minRaiseTo : 0, max: legal ? legal.maxRaiseTo : 200, step: 1, value: raiseTo, onChange: (e) => setRaiseTo(Number(e.target.value)) }),
        h('div', { className: 'pm-presets' },
          [[0.33, '1/3'], [0.5, '1/2'], [0.75, '3/4'], [1, '满池'], [1.2, '全下']].map((p, i) =>
            h('button', { key: i, type: 'button', className: 'pm-preset', onClick: () => preset(p[0]) }, p[1]))),
        h('div', { className: 'pm-raise-actions' },
          h('button', { type: 'button', className: 'pm-btn', onClick: () => setRaiseOpen(false) }, '取消'),
          h('button', { type: 'button', className: 'pm-btn pm-raise', onClick: () => actHero('raise', raiseTo) }, '确认加注'))
      ) : null,
      h('div', { className: 'pm-turnbar' + (heroTurn ? ' is-hero' : '') },
        h('span', { className: 'pm-turn-dot' }),
        h('strong', null, turnText),
        heroTurn ? h('small', null, '点击下方按钮行动') : null),
      h('div', { className: 'pm-actions' },
        h('button', { type: 'button', className: 'pm-btn pm-fold', disabled: !heroTurn || !legal, onClick: () => actHero('fold') }, '弃牌'),
        h('button', { type: 'button', className: 'pm-btn pm-call', disabled: !heroTurn || !legal, onClick: () => actHero(legal && legal.canCheck ? 'check' : 'call') },
          legal && legal.canCheck ? '过牌' : ('跟注 ' + (legal ? legal.callAmount : 0))),
        h('button', { type: 'button', className: 'pm-btn pm-raise', disabled: !heroTurn || !legal || !legal.canRaise, onClick: openRaise }, '加注'),
        h('button', { type: 'button', className: 'pm-btn pm-allin', disabled: !heroTurn || !legal, onClick: () => actHero('allin') }, '全下')
      ),
      h(ResultPanel, { result, onNext: nextHand, onClose: close })
    ) : null
  );
}
