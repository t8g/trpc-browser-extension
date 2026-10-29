import { parseExchange } from './src/trpc.js';
import { highlightText, renderTree, toPrettyJson } from './src/tree.js';

const devtools = globalThis.chrome?.devtools;

const state = {
  calls: [], // flattened tRPC calls, newest last
  selectedId: null,
  tab: 'output',
  filter: '',
  errorsOnly: false,
  search: '', // search inside the selected call's detail
  matchIndex: 0,
};
let nextId = 1;

const $ = (id) => document.getElementById(id);
const ui = {
  list: $('calls'),
  empty: $('empty'),
  count: $('count'),
  detail: $('detail'),
  detailEmpty: $('detail-empty'),
  type: $('d-type'),
  path: $('d-path'),
  meta: $('d-meta'),
  content: $('tab-content'),
  search: $('search'),
  searchCount: $('search-count'),
};

applyTheme();

$('clear').addEventListener('click', clear);
$('filter').addEventListener('input', (e) => {
  state.filter = e.target.value.trim().toLowerCase();
  renderList();
});
$('errors-only').addEventListener('change', (e) => {
  state.errorsOnly = e.target.checked;
  renderList();
});
document.querySelectorAll('.tabs button').forEach((button) =>
  button.addEventListener('click', () => {
    state.tab = button.dataset.tab;
    state.matchIndex = 0;
    renderDetail();
  }),
);
$('copy').addEventListener('click', copyCurrentTab);

let searchTimer;
ui.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = ui.search.value;
    state.matchIndex = 0;
    renderDetail();
  }, 120);
});
ui.search.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    moveMatch(e.shiftKey ? -1 : 1);
  } else if (e.key === 'Escape' && ui.search.value) {
    e.stopPropagation(); // keep the DevTools drawer from toggling
    ui.search.value = '';
    state.search = '';
    renderDetail();
  }
});
$('search-prev').addEventListener('click', () => moveMatch(-1));
$('search-next').addEventListener('click', () => moveMatch(1));
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && selectedCall()) {
    e.preventDefault();
    ui.search.focus();
    ui.search.select();
  }
});

if (devtools) {
  devtools.network.onRequestFinished.addListener(onRequestFinished);
  devtools.network.onNavigated.addListener(() => {
    if (!$('preserve').checked) clear();
  });
} else {
  // Opened outside DevTools: show sample data so the UI can be worked on in a normal tab.
  import('./src/fixtures.js').then(({ fixtures }) => {
    document.title += ' (démo)';
    fixtures.forEach((f) => addExchange(f));
  });
}

function onRequestFinished(har) {
  const { request, response } = har;
  // Cheap pre-filter: tRPC responses are JSON.
  const mime = response.content?.mimeType || '';
  if (mime && !mime.includes('json')) return;

  har.getContent((body, encoding) => {
    addExchange({
      url: request.url,
      method: request.method,
      requestBody: request.postData?.text,
      responseBody: encoding === 'base64' ? decodeBase64(body) : body,
      status: response.status,
      duration: Math.round(har.time),
      startedAt: har.startedDateTime,
    });
  });
}

function addExchange(exchange) {
  let parsed;
  try {
    parsed = parseExchange(exchange);
  } catch (err) {
    console.warn('[tRPC DevTools] could not parse', exchange.url, err);
    return;
  }
  if (!parsed) return;
  for (const call of parsed.calls) {
    state.calls.push({
      ...call,
      id: nextId++,
      isBatch: parsed.isBatch,
      batchSize: parsed.calls.length,
      url: exchange.url,
      status: exchange.status,
      duration: exchange.duration,
      startedAt: exchange.startedAt,
      responseBody: exchange.responseBody,
      requestBody: exchange.requestBody,
    });
  }
  renderList();
}

function clear() {
  state.calls = [];
  state.selectedId = null;
  renderList();
  renderDetail();
}

function visibleCalls() {
  return state.calls.filter(
    (c) => (!state.filter || c.path.toLowerCase().includes(state.filter)) && (!state.errorsOnly || c.error),
  );
}

function renderList() {
  const calls = visibleCalls();
  ui.list.replaceChildren(
    ...calls.map((call) => {
      const li = document.createElement('li');
      li.className = (call.id === state.selectedId ? 'selected ' : '') + (call.error ? 'has-error' : '');
      li.append(
        badge(call),
        Object.assign(document.createElement('span'), { className: 'path', textContent: call.path, title: call.url }),
        Object.assign(document.createElement('span'), {
          className: 'muted',
          textContent: call.duration != null ? `${call.duration} ms` : '',
        }),
      );
      li.addEventListener('click', () => {
        state.selectedId = call.id;
        state.matchIndex = 0;
        renderList();
        renderDetail();
      });
      return li;
    }),
  );
  ui.empty.hidden = state.calls.length > 0;
  ui.count.textContent = state.calls.length
    ? `${calls.length}/${state.calls.length} appel${state.calls.length > 1 ? 's' : ''}`
    : '';
}

function badge(call) {
  const span = document.createElement('span');
  span.className = `badge ${call.error ? 'error' : call.type}`;
  span.textContent = call.error ? 'err' : call.type === 'query' ? 'Q' : 'M';
  span.title = call.type;
  return span;
}

function selectedCall() {
  return state.calls.find((c) => c.id === state.selectedId);
}

function renderDetail() {
  const call = selectedCall();
  ui.detail.hidden = !call;
  ui.detailEmpty.hidden = !!call;
  if (!call) return;

  ui.type.className = `badge ${call.type}`;
  ui.type.textContent = call.type;
  ui.path.textContent = call.path;
  ui.meta.textContent = [
    call.status && `HTTP ${call.status}`,
    call.duration != null && `${call.duration} ms`,
    call.isBatch && `batch ${call.index + 1}/${call.batchSize}`,
    call.superjson && 'superjson',
  ]
    .filter(Boolean)
    .join(' · ');

  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));

  const query = state.search;
  const nodes = [];
  if (state.tab === 'output') {
    if (call.error) nodes.push(errorBox(call.error), renderTree(call.error.raw, { query }));
    else nodes.push(renderTree(call.output, { query }));
  } else if (state.tab === 'input') {
    nodes.push(renderTree(call.input, { query }));
  } else {
    const raw = toPrettyJson({ url: call.url, rawInput: call.rawInput, rawOutput: call.rawOutput });
    nodes.push(highlightText('pre', 'raw', raw, query));
  }
  ui.content.replaceChildren(...nodes);
  showMatch();
}

function matches() {
  return [...ui.content.querySelectorAll('mark.tree-match')];
}

function moveMatch(step) {
  const count = matches().length;
  if (!count) return;
  state.matchIndex = (state.matchIndex + step + count) % count;
  showMatch();
}

// Marks the current match, scrolls to it and updates the "n/total" counter.
function showMatch() {
  const marks = matches();
  if (!state.search.trim()) {
    ui.searchCount.textContent = '';
    return;
  }
  if (!marks.length) {
    ui.searchCount.textContent = 'aucun résultat';
    return;
  }
  state.matchIndex = Math.min(state.matchIndex, marks.length - 1);
  marks.forEach((m, i) => m.classList.toggle('current', i === state.matchIndex));
  marks[state.matchIndex].scrollIntoView({ block: 'nearest' });
  ui.searchCount.textContent = `${state.matchIndex + 1}/${marks.length}`;
}

function errorBox(error) {
  const box = document.createElement('div');
  box.className = 'error-box';
  const code = document.createElement('span');
  code.className = 'code';
  code.textContent = [error.code, error.httpStatus].filter(Boolean).join(' ');
  box.append(code, document.createTextNode(error.message));
  return box;
}

function copyCurrentTab() {
  const call = selectedCall();
  if (!call) return;
  const value =
    state.tab === 'input'
      ? call.input
      : state.tab === 'raw'
        ? { rawInput: call.rawInput, rawOutput: call.rawOutput }
        : call.error ? call.error.raw : call.output;
  copyText(toPrettyJson(value) ?? 'undefined');
}

// navigator.clipboard is blocked inside DevTools panels, so fall back to execCommand.
function copyText(text) {
  const area = document.createElement('textarea');
  area.value = text;
  document.body.append(area);
  area.select();
  document.execCommand('copy');
  area.remove();
}

function decodeBase64(text) {
  try {
    const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return text;
  }
}

function applyTheme() {
  const name = devtools?.panels?.themeName;
  const dark = name ? name === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('theme-dark', dark);
}
