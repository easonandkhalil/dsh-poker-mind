/* Build a static HTML approximation of the shell.overlay table for visual QA. */
const fs = require('fs');
const path = require('path');

let captured = null;
global.window = { __ModuleLoader__: { load(def) { captured = def; } } };
let timerId = 0;
const timers = new Map();
global.setTimeout = (fn, ms) => { const id = ++timerId; timers.set(id, { at: Number(ms) || 0, fn }); return id; };
global.clearTimeout = (id) => timers.delete(id);
global.document = undefined;

require(path.join(__dirname, '..', 'client.js'));
const states = [];
const refs = [];
let cursor = 0;
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], (v) => { states[i] = v; }]; },
  useRef(initial) { const i = cursor++; if (!(i in refs)) refs[i] = { current: initial }; return refs[i]; },
  useEffect() {}, useMemo(fn) { return fn(); }, useCallback(fn) { return fn; }
};
const api = captured.factory((name) => { if (name === 'react') return React; throw new Error(name); });
const components = {};
api.apply({ slots: { inject(_o, r) { r(); }, register(o, c) { components[o.name] = c; } } });
const table = components['shell.overlay'];
const button = components['conversation.composer.dock'];

function render(comp) { cursor = 0; return comp({}); }
let tree = render(table);
const launch = find(render(button), (n) => n.props && n.props.className === 'pm-launch');
launch.props.onClick();
// Flush the coach advice timer so the panel has real content.
let best = null;
for (const [id, t] of timers) if (!best || t.at < best.t.at) best = { id, t };
if (best) { timers.delete(best.id); best.t.fn(); }
tree = render(table);

function find(node, pred) {
  if (!node || typeof node !== 'object') return null;
  if (pred(node)) return node;
  for (const c of node.children || []) { const r = find(c, pred); if (r) return r; }
  return null;
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function cssName(k) { return k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()); }
function styleText(style) {
  if (!style || typeof style !== 'object') return '';
  return Object.entries(style).filter(([, v]) => v != null).map(([k, v]) => cssName(k) + ':' + v).join(';');
}
function attrs(props) {
  const out = [];
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'children' || k === 'key' || k === 'onClick' || k === 'onChange' || k === 'dangerouslySetInnerHTML') continue;
    if (k === 'style') { const s = styleText(v); if (s) out.push('style="' + esc(s) + '"'); continue; }
    if (v === false || v == null) continue;
    const name = k === 'className' ? 'class' : k;
    if (v === true) { out.push(name); continue; }
    out.push(name + '="' + esc(v) + '"');
  }
  return out.join(' ');
}
function html(node) {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return esc(node);
  if (Array.isArray(node)) return node.map(html).join('');
  if (typeof node !== 'object') return '';
  if (node.type === React.Fragment) return (node.children || []).map(html).join('');
  if (typeof node.type === 'function') return html(node.type(node.props));
  if (node.type === 'style') return '';
  const kids = (node.children || []).map(html).join('');
  const tag = typeof node.type === 'string' ? node.type : 'div';
  if (tag === 'input') return '<input ' + attrs(node.props) + '>';
  return '<' + tag + (attrs(node.props) ? ' ' + attrs(node.props) : '') + '>' + kids + '</' + tag + '>';
}
const styleNode = find(tree, (n) => n.type === 'style');
const css = styleNode ? (styleNode.children || []).join('') : '';
const page = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:#040c08;color:#f4e8cd;font-family:"Microsoft YaHei",system-ui,sans-serif}
${css}
</style>${html(tree)}`;
fs.writeFileSync(path.join(__dirname, '..', 'dist-preview.html'), page, 'utf8');
console.log('wrote dist-preview.html', Buffer.byteLength(page));
