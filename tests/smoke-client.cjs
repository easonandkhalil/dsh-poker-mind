/* Render the DSH poker dock with a tiny React hooks stand-in.
 * This is not a browser test: it catches component/render crashes and slot wiring. */
const fs = require('fs');
const path = require('path');

let captured = null;
global.window = {
  __ModuleLoader__: {
    load(definition) { captured = definition; }
  }
};
global.setTimeout = () => 0;
global.clearTimeout = () => {};
global.document = undefined;

require(path.join(__dirname, '..', 'client.js'));

if (!captured) throw new Error('client.js did not register a module');

const state = [];
const refs = [];
let cursor = 0;
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) {
    return { type, props: props || {}, children };
  },
  useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], (value) => { state[index] = value; }];
  },
  useRef(initial) {
    const index = cursor++;
    if (!(index in refs)) refs[index] = { current: initial };
    return refs[index];
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

function findLaunch(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.props && node.props.onClick && node.props.className === 'pm-launch') return node;
  for (const child of node.children || []) {
    const found = findLaunch(child);
    if (found) return found;
  }
  return null;
}

let tree = renderTable();
const launch = findLaunch(renderButton());
if (!launch) throw new Error('quick-game button not rendered');
launch.props.onClick();
tree = renderTable();
if (!state[0]) throw new Error('overlay did not open');

const text = JSON.stringify(tree);
if (!text.includes('pm-overlay')) throw new Error('overlay not rendered');
if (!text.includes('pm-felt')) throw new Error('table not rendered');
if (!text.includes('pm-coach')) throw new Error('coach panel not rendered');

function findActionButton(node, className) {
  if (!node || typeof node !== 'object') return null;
  if (node.props && node.props.className === className) return node;
  for (const child of node.children || []) {
    const found = findActionButton(child, className);
    if (found) return found;
  }
  return null;
}

// The hero-turn gate must treat thinking === -1 as "nobody is thinking".
// Regression: `!thinking` made every action button permanently disabled.
state[3] = { seatIndex: 0, toCall: 2, callAmount: 2, canCheck: false, canRaise: true, minRaiseTo: 4, maxRaiseTo: 200 };
state[5] = -1;
state[7] = false; // calc finished
state[4] = null;
tree = renderTable();
const callButton = findActionButton(tree, 'pm-btn pm-call');
if (!callButton) throw new Error('action buttons not rendered');
if (callButton.props.disabled) throw new Error('action buttons disabled on hero turn');
if (!JSON.stringify(tree).includes('轮到你行动')) throw new Error('hero turn prompt missing');

const legal = state[3];
if (legal && legal.canRaise) {
  state[9] = true;
  state[10] = legal.minRaiseTo;
  tree = renderTable();
  if (!JSON.stringify(tree).includes('pm-raise-panel')) throw new Error('raise panel not rendered');
}

console.log('PASS slot registration + button + overlay + table + coach + raise');
console.log('state:', state.map((v) => (v && typeof v === 'object' ? Object.keys(v).slice(0, 4) : v)));
