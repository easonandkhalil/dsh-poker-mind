/* Drive a full quick-table hand through the React component with a fake timer
 * queue. Catches UI wiring errors in AI turns, hero actions and the result view. */
const fs = require('fs');
const path = require('path');

let captured = null;
global.window = { __ModuleLoader__: { load(definition) { captured = definition; } } };
global.document = undefined;

let timerId = 0;
const timers = new Map();
global.setTimeout = (fn, ms) => {
  const id = ++timerId;
  timers.set(id, { at: Number(ms) || 0, fn });
  return id;
};
global.clearTimeout = (id) => { timers.delete(id); };

require(path.join(__dirname, '..', 'client.js'));
if (!captured) throw new Error('client.js did not register a module');

const states = [];
const refs = [];
let cursor = 0;
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  useState(initial) {
    const i = cursor++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], (value) => { states[i] = value; }];
  },
  useRef(initial) {
    const i = cursor++;
    if (!(i in refs)) refs[i] = { current: initial };
    return refs[i];
  },
  useEffect() {},
  useMemo(fn) { return fn(); },
  useCallback(fn) { return fn; }
};

const api = captured.factory((name) => {
  if (name === 'react') return React;
  throw new Error('unexpected require: ' + name);
});

const components = {};
api.apply({
  slots: {
    inject(_owner, register) { register(); },
    register(options, component) { components[options.name] = component; }
  }
});

if (!components['conversation.composer.dock']) throw new Error('launch slot not registered');
if (!components['shell.overlay']) throw new Error('overlay slot not registered');

function renderTable() {
  cursor = 0;
  return components['shell.overlay']({});
}

function renderButton() {
  cursor = 0;
  return components['conversation.composer.dock']({});
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'function') {
    walk(node.type(node.props), visit);
    return;
  }
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function findButton(tree, className) {
  let found = null;
  walk(tree, (node) => {
    if (!found && node.props && node.props.className === className && node.props.onClick) found = node;
  });
  return found;
}

function findLaunch(tree) {
  let found = null;
  walk(tree, (node) => {
    if (!found && node.props && node.props.className === 'pm-launch') found = node;
  });
  return found;
}

function flushOne() {
  let best = null;
  for (const [id, timer] of timers) {
    if (!best || timer.at < best.timer.at) best = { id, timer };
  }
  if (!best) return false;
  timers.delete(best.id);
  best.timer.fn();
  return true;
}

function hasResult(tree) {
  let yes = false;
  walk(tree, (node) => { if (node.props && node.props.className === 'pm-result-mask') yes = true; });
  return yes;
}

let tree = renderTable();
const launch = findLaunch(renderButton());
if (!launch) throw new Error('quick-game button not rendered');
launch.props.onClick();

let steps = 0;
while (steps++ < 80) {
  tree = renderTable();
  if (hasResult(tree)) break;
  const call = findButton(tree, 'pm-btn pm-call');
  const fold = findButton(tree, 'pm-btn pm-fold');
  // state[3] is legalActions and state[7] is calc; act only when hero is idle.
  if (call && states[3] && !states[7]) {
    call.props.onClick();
    continue;
  }
  if (fold && states[3] && !states[7] && !call) {
    fold.props.onClick();
    continue;
  }
  if (!flushOne()) break;
}

if (!hasResult(tree)) {
  console.error('DEBUG states', states.map((v) => (v && typeof v === 'object' ? Object.keys(v).slice(0, 6) : v)));
  console.error('DEBUG snap', states[1] && { handNo: states[1].handNo, phase: states[1].phase, actingIndex: states[1].actingIndex, street: states[1].street });
  console.error('DEBUG legal', states[3], 'calc', states[7], 'timers', timers.size, 'steps', steps);
  throw new Error('hand did not reach the result screen');
}
const text = JSON.stringify(tree);
if (!text.includes('底池') && !text.includes('牌')) throw new Error('result content missing');
console.log('PASS full hand: launch -> hero action -> AI turns -> result');
console.log('hands:', states[12] && states[12].hands, 'result keys:', states[4] && Object.keys(states[4]).slice(0, 6));
