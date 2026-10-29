// Collapsible JSON tree renderer that also understands rich superjson values.
// Builds DOM nodes with textContent only, so captured data is never parsed as HTML.

const AUTO_EXPAND_DEPTH = 2;

/**
 * Renders `value` into a new element.
 * With `query`, matching keys and values are wrapped in <mark> and the branches
 * that contain a match are opened (the others stay closed).
 */
export function renderTree(value, { query = '' } = {}) {
  const ctx = { query: query.trim().toLowerCase(), memo: new WeakMap() };
  const root = el('div', 'tree');
  root.append(renderNode(undefined, value, 0, ctx));
  return root;
}

/** True when `key` or any key/value below `value` contains `query` (case-insensitive). */
export function treeMatches(value, query, key) {
  return containsMatch(key, value, { query: query.trim().toLowerCase(), memo: new WeakMap() });
}

function containsMatch(key, value, ctx) {
  if (!ctx.query) return false;
  if (key !== undefined && String(key).toLowerCase().includes(ctx.query)) return true;
  const children = childrenOf(value);
  if (!children) return leafText(value).toLowerCase().includes(ctx.query);
  if (ctx.memo.has(value)) return ctx.memo.get(value);
  ctx.memo.set(value, false); // guards against cycles
  const found = children.some(([k, v]) => containsMatch(k, v, ctx));
  ctx.memo.set(value, found);
  return found;
}

function renderNode(key, value, depth, ctx) {
  const children = childrenOf(value);
  const row = el('div', 'tree-row');

  if (!children) {
    row.append(keyLabel(key, ctx), leaf(value, ctx));
    return row;
  }

  const details = el('details', 'tree-node');
  details.open = ctx.query
    ? children.some(([k, v]) => containsMatch(k, v, ctx))
    : depth < AUTO_EXPAND_DEPTH;
  const summary = el('summary');
  summary.append(keyLabel(key, ctx), el('span', 'tree-preview', preview(value, children)));
  details.append(summary);

  // Children are rendered lazily, the first time the node is opened.
  let rendered = false;
  const renderChildren = () => {
    if (rendered) return;
    rendered = true;
    const list = el('div', 'tree-children');
    for (const [childKey, childValue] of children) list.append(renderNode(childKey, childValue, depth + 1, ctx));
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

// Text shown for a leaf value (also what the search looks at).
function leafText(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (value instanceof Date) return isNaN(value) ? 'Invalid Date' : value.toISOString();
  if (value instanceof RegExp) return String(value);
  if (value instanceof URL) return value.href;
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Object.is(value, -0) ? '-0' : String(value);
    case 'bigint':
      return `${value}n`;
    case 'symbol':
      return value.description ?? '';
    default:
      return String(value);
  }
}

function leafInfo(value) {
  if (value === null || value === undefined) return { className: 'v-null' };
  if (value instanceof Date) return { type: 'Date', className: 'v-date' };
  if (value instanceof RegExp) return { type: 'RegExp', className: 'v-string' };
  if (value instanceof URL) return { type: 'URL', className: 'v-string' };
  switch (typeof value) {
    case 'string':
      return { className: 'v-string' };
    case 'number':
      return { className: 'v-number' };
    case 'bigint':
      return { type: 'BigInt', className: 'v-number' };
    case 'boolean':
      return { className: 'v-boolean' };
    case 'symbol':
      return { type: 'Symbol', className: 'v-string' };
    default:
      return { className: '' };
  }
}

function leaf(value, ctx) {
  const { type, className } = leafInfo(value);
  const text = highlighted('span', className, leafText(value), ctx);
  if (!type) return text;
  const wrap = el('span');
  wrap.append(el('span', 'v-type', type), text);
  return wrap;
}

/** Element showing `text` with every occurrence of `query` wrapped in <mark>. */
export function highlightText(tag, className, text, query) {
  return highlighted(tag, className, text, { query: query.trim().toLowerCase() });
}

function highlighted(tag, className, text, ctx) {
  const node = el(tag, className);
  const q = ctx.query;
  if (!q) {
    node.textContent = text;
    return node;
  }
  const lower = text.toLowerCase();
  let from = 0;
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) node.append(text.slice(from, at));
    node.append(el('mark', 'tree-match', text.slice(at, at + q.length)));
    from = at + q.length;
  }
  if (from < text.length) node.append(text.slice(from));
  return node;
}

function keyLabel(key, ctx) {
  if (key === undefined) return document.createTextNode('');
  const label = highlighted('span', 'tree-key', String(key), ctx);
  label.append(': ');
  return label;
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
