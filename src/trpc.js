// Parses a captured HTTP exchange into tRPC procedure calls.
// Supports tRPC v9/v10/v11, httpLink and httpBatchLink, GET and POST, with or without superjson.

import { deserialize, isSuperjson } from './superjson.js';

/**
 * @typedef {object} Exchange
 * @property {string} url
 * @property {string} method
 * @property {string} [requestBody]
 * @property {string} [responseBody]
 * @property {number} [status]
 *
 * @typedef {object} TrpcCall
 * @property {number} index        position in the batch
 * @property {string} path         procedure path, e.g. "post.byId"
 * @property {'query'|'mutation'} type
 * @property {unknown} input       decoded input
 * @property {unknown} rawInput    input as sent on the wire
 * @property {unknown} output      decoded result data (undefined on error)
 * @property {unknown} rawOutput   response item as received
 * @property {null|{message: string, code?: string, httpStatus?: number, data?: unknown}} error
 * @property {boolean} superjson   true when superjson was detected
 */

/** Quick check used to filter network traffic before parsing. */
export function looksLikeTrpc({ url, responseBody }) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }
  if (parsedUrl.searchParams.get('batch') === '1') return true;
  const body = safeJson(responseBody);
  if (body === NOT_JSON) return false;
  const items = Array.isArray(body) ? body : [body];
  return items.length > 0 && items.every(isEnvelope);
}

/** Splits one HTTP exchange into its tRPC calls. Returns null when it is not tRPC. */
export function parseExchange(exchange) {
  if (!looksLikeTrpc(exchange)) return null;

  const url = new URL(exchange.url);
  const isBatch = url.searchParams.get('batch') === '1';
  const segments = url.pathname.split('/');
  const paths = decodeURIComponent(segments[segments.length - 1] || '').split(',');
  const type = exchange.method.toUpperCase() === 'GET' ? 'query' : 'mutation';

  const rawInputs =
    type === 'query' ? safeJson(url.searchParams.get('input')) : safeJson(exchange.requestBody);
  const body = safeJson(exchange.responseBody);
  const responseItems = body === NOT_JSON ? [] : Array.isArray(body) ? body : [body];

  return {
    isBatch,
    calls: paths.map((path, index) => {
      let rawInput = rawInputs === NOT_JSON ? undefined : rawInputs;
      if (isBatch && rawInput && typeof rawInput === 'object') rawInput = rawInput[index];
      const rawOutput = responseItems[index];
      const input = decode(rawInput);
      const { output, error } = decodeResponseItem(rawOutput, exchange.status);
      return {
        index,
        path,
        type,
        input: input.value,
        rawInput,
        output: output.value,
        rawOutput,
        error,
        superjson: input.superjson || output.superjson || (error ? error.superjson : false),
      };
    }),
  };
}

function decodeResponseItem(item, status) {
  if (!item || typeof item !== 'object') {
    return { output: { value: undefined, superjson: false }, error: null };
  }
  if ('error' in item) {
    const decoded = decode(item.error);
    const shape = decoded.value || {};
    return {
      output: { value: undefined, superjson: false },
      error: {
        message: shape.message ?? 'Unknown error',
        code: shape.data?.code ?? (typeof shape.code === 'string' ? shape.code : undefined),
        httpStatus: shape.data?.httpStatus ?? status,
        data: shape.data,
        raw: shape,
        superjson: decoded.superjson,
      },
    };
  }
  // v10/v11: { result: { data } } ; v9: { result: { type: 'data', data } } ; v9 batch {id, result}
  const data = item.result ? item.result.data : undefined;
  return { output: decode(data), error: null };
}

function decode(value) {
  if (isSuperjson(value)) {
    try {
      return { value: deserialize(value), superjson: true };
    } catch {
      return { value, superjson: false };
    }
  }
  return { value, superjson: false };
}

function isEnvelope(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  if (item.result && typeof item.result === 'object' && 'data' in item.result) return true;
  if (item.error && typeof item.error === 'object') {
    const err = isSuperjson(item.error) ? item.error.json : item.error;
    return !!err && typeof err === 'object' && 'message' in err && 'code' in err;
  }
  return false;
}

const NOT_JSON = Symbol('not-json');

function safeJson(text) {
  if (text == null || text === '') return NOT_JSON;
  try {
    return JSON.parse(text);
  } catch {
    return NOT_JSON;
  }
}
