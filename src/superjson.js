// Minimal superjson deserializer (no dependency).
// Handles the `{ json, meta: { values } }` envelope produced by superjson.serialize().
// Format reference: https://github.com/flightcontrolhq/superjson

/** Returns true when `value` looks like a superjson envelope. */
export function isSuperjson(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'json' in value &&
    Object.keys(value).every((k) => k === 'json' || k === 'meta') &&
    (value.meta === undefined || (typeof value.meta === 'object' && value.meta !== null))
  );
}

/** Turns a superjson envelope back into rich JS values (Date, Map, Set, BigInt...). */
export function deserialize({ json, meta }) {
  const values = meta && meta.values;
  if (values === undefined) return json;
  return applyTree(clone(json), values);
}

// Splits "a.b\\.c" into ["a", "b.c"] (superjson escapes dots and backslashes in keys).
export function parsePath(path) {
  const segments = [];
  let current = '';
  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    if (char === '\\' && i + 1 < path.length) {
      current += path[++i];
    } else if (char === '.') {
      segments.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  segments.push(current);
  return segments;
}

// A tree is either a leaf/inner node `[type, children?]` or a record of `path -> tree`.
function applyTree(value, tree) {
  if (Array.isArray(tree)) {
    const [type, children] = tree;
    if (children) value = applyChildren(value, children);
    return untransform(value, type);
  }
  return applyChildren(value, tree);
}

function applyChildren(value, children) {
  for (const [path, subtree] of Object.entries(children)) {
    value = setAtPath(value, parsePath(path), (v) => applyTree(v, subtree));
  }
  return value;
}

function setAtPath(value, segments, fn) {
  if (segments.length === 0) return fn(value);
  if (value === null || typeof value !== 'object') return value;
  const [head, ...rest] = segments;
  value[head] = setAtPath(value[head], rest, fn);
  return value;
}

function untransform(value, type) {
  if (Array.isArray(type)) {
    const [kind, name] = type;
    switch (kind) {
      case 'symbol':
        return Symbol(name);
      case 'class':
      case 'custom':
        return { __superjsonType: `${kind}:${name}`, value };
      case 'typed-array':
        return { __superjsonType: name, value };
      default:
        return value;
    }
  }
  switch (type) {
    case 'undefined':
      return undefined;
    case 'bigint':
      try {
        return BigInt(value);
      } catch {
        return value;
      }
    case 'Date':
      return new Date(value);
    case 'regexp': {
      const match = /^\/(.*)\/([a-z]*)$/s.exec(value);
      try {
        return match ? new RegExp(match[1], match[2]) : new RegExp(value);
      } catch {
        return value;
      }
    }
    case 'set':
      return new Set(value);
    case 'map':
      return new Map(value);
    case 'Error': {
      const error = new Error(value && value.message);
      if (value && value.name) error.name = value.name;
      if (value && value.stack) error.stack = value.stack;
      return error;
    }
    case 'URL':
      try {
        return new URL(value);
      } catch {
        return value;
      }
    case 'number':
      return Number(value);
    default:
      return value;
  }
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
