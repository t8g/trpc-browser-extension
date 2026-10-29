// Collapsible JSON tree renderer that also understands rich superjson values.
// Builds DOM nodes with textContent only, so captured data is never parsed as HTML.

const AUTO_EXPAND_DEPTH = 2;

/** Renders `value` into a new element. */
export function renderTree(value) {
  const root = el('div', 'tree');
  root.append(renderNode(undefined, value, 0));
  return root;
}

function renderNode(key, value, depth) {
  const children = childrenOf(value);
  const row = el('div', 'tree-row');

  if (!children) {
    row.append(keyLabel(key), leaf(value));
    return row;
  }

  const details = el('details', 'tree-node');
  details.open = depth < AUTO_EXPAND_DEPTH;
  const summary = el('summary');
  summary.append(keyLabel(key), el('span', 'tree-preview', preview(value, children)));
  details.append(summary);

  // Children are rendered lazily, the first time the node is opened.
  let rendered = false;
  const renderChildren = () => {
    if (rendered) return;
    rendered = true;
    const list = el('div', 'tree-children');
    for (const [childKey, childValue] of children) list.append(renderNode(childKey, childValue, depth + 1));
    if (children.length === 0) list.append(el('div', 'tree-empty', 'empty'));
    details.append(list);
  };
  if (details.open) renderChildren();
  details.addEventListener('toggle', renderChildren);
  return details;
}

function childrenOf(value) {
  if (value instanceof Map) return [...value.entries()].map(([k, v], i) => [mapKey(k, i), v]);
  if (value instanceof Set) return [...value].map((v, i) => [String(i), v]);
  if (value instanceof Error) return [['message', value.message], ['name', value.name]];
  if (Array.isArray(value)) return value.map((v, i) => [String(i), v]);
  if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof RegExp) && !(value instanceof URL)) {
    return Object.entries(value);
  }
  return null;
}

function preview(value, children) {
  const n = children.length;
  if (value instanceof Map) return `Map(${n})`;
  if (value instanceof Set) return `Set(${n})`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (Array.isArray(value)) return `Array(${n})`;
  if (value && value.__superjsonType) return value.__superjsonType;
  return n === 0 ? '{}' : `{ ${children.slice(0, 4).map(([k]) => k).join(', ')}${n > 4 ? ', …' : ''} }`;
}

function leaf(value) {
  if (value === null) return el('span', 'v-null', 'null');
  if (value === undefined) return el('span', 'v-null', 'undefined');
  if (value instanceof Date) return typed('Date', isNaN(value) ? 'Invalid Date' : value.toISOString(), 'v-date');
  if (value instanceof RegExp) return typed('RegExp', String(value), 'v-string');
  if (value instanceof URL) return typed('URL', value.href, 'v-string');
  switch (typeof value) {
    case 'string':
      return el('span', 'v-string', JSON.stringify(value));
    case 'number':
      return el('span', 'v-number', Object.is(value, -0) ? '-0' : String(value));
    case 'bigint':
      return typed('BigInt', `${value}n`, 'v-number');
    case 'boolean':
      return el('span', 'v-boolean', String(value));
    case 'symbol':
      return typed('Symbol', value.description ?? '', 'v-string');
    default:
      return el('span', '', String(value));
  }
}

function typed(type, text, className) {
  const wrap = el('span');
  wrap.append(el('span', 'v-type', type), el('span', className, text));
  return wrap;
}

function keyLabel(key) {
  if (key === undefined) return document.createTextNode('');
  return el('span', 'tree-key', `${key}: `);
}

function mapKey(key, index) {
  if (typeof key === 'string') return key;
  if (key === null || typeof key !== 'object') return String(key);
  return `[key ${index}]`;
}

function el(tag, className = '', text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** JSON.stringify that keeps rich values readable (used by the "Copy" button). */
export function toPrettyJson(value) {
  return JSON.stringify(
    value,
    function (key, v) {
      const raw = this[key];
      if (raw instanceof Date) return raw.toISOString();
      if (typeof raw === 'bigint') return `${raw}n`;
      if (raw instanceof Map) return Object.fromEntries([...raw].map(([k, val]) => [String(k), val]));
      if (raw instanceof Set) return [...raw];
      if (raw instanceof Error) return { name: raw.name, message: raw.message };
      if (raw instanceof RegExp) return String(raw);
      if (raw === undefined) return null;
      if (typeof raw === 'symbol') return raw.toString();
      return v;
    },
    2,
  );
}
