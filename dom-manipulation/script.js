// ------------- Configuration -------------
const LS_KEY = 'quotesList';
const SERVER_ENDPOINT = 'https://jsonplaceholder.typicode.com/posts'; // mock endpoint (replace with your API)
const SYNC_INTERVAL_MS = 30_000; // 30s periodic sync (tweak as needed)
const SERVER_POLL_INTERVAL_MS = SYNC_INTERVAL_MS;

const SESSION_LAST = 'lastViewedQuoteId';
const LS_FILTER = 'lastSelectedCategory';

// ------------- In-memory app state -------------
let quotes = []; // { id, text, category, updatedAt }
let lastSyncAt = null;

// ------------- DOM refs -------------
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const syncNowBtn = document.getElementById('syncNow');
const syncIndicator = document.getElementById('syncIndicator');
const newQuoteText = document.getElementById('newQuoteText');
const newQuoteCategory = document.getElementById('newQuoteCategory');
const addBtn = document.getElementById('addBtn');
const quoteList = document.getElementById('quoteList');
const categoryFilter = document.getElementById('categoryFilter');
const notification = document.getElementById('notification');

const overlay = document.getElementById('overlay');
const conflictBox = document.getElementById('conflictBox');
const conflictsContainer = document.getElementById('conflictsContainer');
const resolveAllServerBtn = document.getElementById('resolveAllServer');
const resolveAllLocalBtn = document.getElementById('resolveAllLocal');
const closeConflictsBtn = document.getElementById('closeConflicts');

// ------------- Utilities -------------
function genId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
}

function nowIso() { return new Date().toISOString(); }

function saveLocal() {
  localStorage.setItem(LS_KEY, JSON.stringify(quotes));
}

function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) { quotes = []; return; }
  try {
    quotes = JSON.parse(raw);
  } catch (e) {
    console.error('bad local storage', e);
    quotes = [];
  }
}

function setSyncStatus(text, className = 'info') {
  syncIndicator.textContent = text;
  notification.className = className;
  // show small transient message
  notification.style.display = text ? 'block' : 'none';
  notification.textContent = `${text}${lastSyncAt ? ' (' + lastSyncAt + ')' : ''}`;
  // hide after short time unless it's an important warn
  if (className === 'info') {
    setTimeout(() => { notification.style.display = 'none'; }, 3500);
  }
}

// ------------- Rendering & UI -------------
function renderQuote(q) {
  quoteDisplay.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = `"${q.text}"`;
  p.style.fontStyle = 'italic';
  const meta = document.createElement('div');
  meta.textContent = `— ${q.category}`;
  meta.style.color = '#555';
  meta.style.marginTop = '6px';
  quoteDisplay.append(p, meta);
}

function getUniqueCategories() {
  const cats = quotes.map(q => (q.category || '').trim()).filter(Boolean);
  return [...new Set(cats)].sort();
}

function populateCategories() {
  const cats = getUniqueCategories();
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    categoryFilter.appendChild(opt);
  });
  // restore selected
  const last = localStorage.getItem(LS_FILTER) || 'all';
  if ([...categoryFilter.options].some(o => o.value === last)) categoryFilter.value = last;
}

function refreshQuoteList() {
  const filter = categoryFilter.value || 'all';
  quoteList.innerHTML = '';
  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.category === filter);
  if (!filtered.length) { quoteList.textContent = 'No quotes for chosen filter.'; return; }

  filtered.forEach(q => {
    const row = document.createElement('div');
    row.className = 'quote-row';

    const left = document.createElement('div');
    const text = document.createElement('div'); text.textContent = q.text;
    const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${q.category} • ${q.id}`;
    left.append(text, meta);

    const right = document.createElement('div');
    const showBtn = document.createElement('button'); showBtn.textContent = 'Show'; showBtn.className='small';
    showBtn.onclick = () => { renderQuote(q); try{ sessionStorage.setItem(SESSION_LAST, q.id);}catch(e){} };
    const removeBtn = document.createElement('button'); removeBtn.textContent = 'Remove'; removeBtn.className='small danger';
    removeBtn.onclick = () => { if(!confirm('Remove?')) return; quotes = quotes.filter(x=>x.id!==q.id); saveLocal(); populateCategories(); refreshQuoteList(); };

    right.append(showBtn, removeBtn);
    row.append(left, right);
    quoteList.appendChild(row);
  });
}

// ------------- Local CRUD -------------
function addLocalQuote(text, category) {
  const item = { id: genId(), text, category, updatedAt: nowIso() };
  quotes.push(item); saveLocal(); populateCategories(); refreshQuoteList();
  renderQuote(item); try{ sessionStorage.setItem(SESSION_LAST, item.id);}catch(e){}
  return item;
}

// ------------- Server simulation helpers -------------
// Map server "post" (JSONPlaceholder) to our quote shape
function mapServerToQuote(serverItem) {
  // JSONPlaceholder has { id, title, body } - map title -> text, body -> category
  return {
    id: String(serverItem.id), // server id
    text: serverItem.title ? serverItem.title.slice(0,300) : 'Untitled',
    category: serverItem.body ? serverItem.body.split(' ')[0] : 'misc',
    updatedAt: serverItem.updatedAt || nowIso() // placeholder
  };
}

// Fetch server-side quotes (mock)
async function fetchQuotesFromServer() {
  // For a real API you'd GET e.g. /api/quotes
  const res = await fetch(SERVER_ENDPOINT);
  if (!res.ok) throw new Error('Server fetch failed: ' + res.status);
  const data = await res.json();
  // Map posts -> quotes (only first N for performance)
  const mapped = data.slice(0,30).map(mapServerToQuote);
  return mapped;
}

// Optionally push local changes to server (simulation - posts not persisted on jsonplaceholder)
async function pushLocalToServer(items) {
  // For demo we POST each item to /posts (will return created resource but not persist)
  // In a real app, you'd have a proper endpoint with auth and conflict-safe updates (PUT/PATCH)
  const promises = items.map(it => {
    return fetch(SERVER_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ title: it.text, body: it.category, updatedAt: it.updatedAt })
    }).then(r => r.json()).catch(e => { console.warn('push failed', e); return null; });
  });
  return Promise.all(promises);
}

// ------------- Sync & Conflict Logic -------------
function detectConflicts(localArr, serverArr) {
  // Build dictionaries by ID (string)
  const localMap = new Map(localArr.map(i => [String(i.id), i]));
  const serverMap = new Map(serverArr.map(i => [String(i.id), i]));

  const conflicts = [];

  // For each server item that also exists locally, check differences
  for (const [id, sItem] of serverMap.entries()) {
    if (localMap.has(id)) {
      const lItem = localMap.get(id);
      // If content differs (text/category) and updatedAt differs, it's a conflict
      if ((lItem.text !== sItem.text || lItem.category !== sItem.category) &&
          (lItem.updatedAt !== sItem.updatedAt)) {
        conflicts.push({ id, local: lItem, server: sItem });
      }
    }
  }
  return conflicts;
}

// Merge strategy: serverWins (automatic) with report of conflicts
function mergeServerIntoLocal(serverArr) {
  const localMap = new Map(quotes.map(q => [String(q.id), q]));

  // Add or update from server
  serverArr.forEach(s => {
    const id = String(s.id);
    if (!localMap.has(id)) {
      // new from server
      quotes.push({ id, text: s.text, category: s.category, updatedAt: s.updatedAt || nowIso() });
    } else {
      // update local with server version if server updatedAt is newer OR we choose serverWins
      const local = localMap.get(id);
      // simple server-wins strategy: always take server version
      if (local.text !== s.text || local.category !== s.category) {
        local.text = s.text;
        local.category = s.category;
        local.updatedAt = s.updatedAt || nowIso();
      }
    }
  });
  // Optionally: keep local-only items intact (we do)
  saveLocal();
}

// Main sync operation (fetch, detect, handle)
async function performSync(showNotifications = true) {
  try {
    syncIndicator.textContent = 'syncing...';
    setSyncStatus('Syncing with server...', 'info');
    const serverData = await fetchQuotesFromServer();
    lastSyncAt = new Date().toLocaleTimeString();
    // Detect conflicts
    const conflicts = detectConflicts(quotes, serverData);
    if (conflicts.length) {
      // by default apply serverWins (automatic)
      mergeServerIntoLocal(serverData);
      saveLocal();
      // present manual resolution option for user's review
      showConflictModal(conflicts);
      if (showNotifications) setSyncStatus(`Conflicts detected and server changes applied. You can review them.`, 'warn');
    } else {
      // No conflicts: simply merge additions
      mergeServerIntoLocal(serverData);
      saveLocal();
      if (showNotifications) setSyncStatus('Synced successfully.', 'info');
    }
    lastSyncAt = new Date().toLocaleTimeString();
    syncIndicator.textContent = `last: ${lastSyncAt}`;
    populateCategories(); refreshQuoteList();
  } catch (err) {
    console.error('Sync failed', err);
    setSyncStatus('Sync failed: ' + (err.message || ''), 'warn');
    syncIndicator.textContent = 'error';
  }
}

// ------------- Conflict modal UI & handlers -------------
function showConflictModal(conflicts) {
  conflictsContainer.innerHTML = ''; // clear
  conflicts.forEach(c => {
    const item = document.createElement('div'); item.className = 'conflict-item';

    const left = document.createElement('div'); left.className='conflict-side';
    const localDiv = document.createElement('div'); localDiv.innerHTML = `<strong>Local</strong><div>${c.local.text}</div><div class="meta">${c.local.category}</div>`;
    const serverDiv = document.createElement('div'); serverDiv.innerHTML = `<strong>Server</strong><div>${c.server.text}</div><div class="meta">${c.server.category}</div>`;
    left.append(localDiv, serverDiv);

    const actions = document.createElement('div'); actions.className='conflict-actions';
    const keepServer = document.createElement('button'); keepServer.textContent='Keep Server'; keepServer.className='small secondary';
    const keepLocal = document.createElement('button'); keepLocal.textContent='Keep Local'; keepLocal.className='small';

    keepServer.onclick = () => { applyConflictChoice(c.id, 'server'); item.style.opacity = '0.5'; };
    keepLocal.onclick = () => { applyConflictChoice(c.id, 'local'); item.style.opacity = '0.5'; };

    actions.append(keepServer, keepLocal);
    item.append(left, actions);
    conflictsContainer.appendChild(item);
  });

  overlay.style.display = 'block';
  conflictBox.style.display = 'block';
  conflictBox.setAttribute('aria-hidden','false');
}

function hideConflictModal() {
  overlay.style.display = 'none';
  conflictBox.style.display = 'none';
  conflictBox.setAttribute('aria-hidden','true');
}

function applyConflictChoice(id, choice) {
  const idx = quotes.findIndex(q => String(q.id) === String(id));
  const conflicting = quotes[idx];
  // We need server version to apply if server chosen; fetch it (we have merged server earlier, but for demo we will fetch server again or use a cached approach)
  // Simpler approach: treat "server" as already applied during automatic merge; "local" requires pushing local to server (simulation)
  if (choice === 'local') {
    // push local item to server (simulated)
    const localItem = conflicting;
    // simulate server update by POSTing to endpoint (note: JSONPlaceholder won't persist)
    fetch(SERVER_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ title: localItem.text, body: localItem.category, updatedAt: localItem.updatedAt })
    }).then(() => {
      setSyncStatus('Local version pushed to server (simulation).', 'info');
    }).catch(() => {
      setSyncStatus('Failed to push local version to server (simulation).', 'warn');
    });
    // keep local as-is (no changes)
  } else {
    // server chosen: nothing to do because serverWins already applied.
    setSyncStatus('Kept server version for item ' + id, 'info');
  }
}

// bulk resolve actions
resolveAllServerBtn.onclick = () => {
  // server already applied; nothing more to do, just close
  hideConflictModal();
  setSyncStatus('Server versions kept for all conflicts.', 'info');
};
resolveAllLocalBtn.onclick = async () => {
  // Push all local conflicting items to server (simulation)
  const toPush = quotes.map(q => ({ title: q.text, body: q.category }));
  try {
    await pushLocalToServer(quotes);
    hideConflictModal();
    setSyncStatus('Local versions pushed to server (simulation).', 'info');
  } catch (e) {
    setSyncStatus('Failed to push local versions.', 'warn');
  }
};
closeConflictsBtn.onclick = hideConflictModal;
overlay.onclick = hideConflictModal;

// ------------- Init & Event wiring -------------
function initApp() {
  loadLocal();
  populateCategories();
  refreshQuoteList();

  // show last session quote or a random one
  const lastId = sessionStorage.getItem(SESSION_LAST);
  const last = quotes.find(q => q.id === lastId);
  if (last) renderQuote(last);
  else if (quotes.length) renderQuote(quotes[0]);

  // start periodic sync
  performSync(false); // initial silent sync attempt
  setInterval(() => performSync(false), SERVER_POLL_INTERVAL_MS);

  // wire events
  newQuoteBtn.onclick = () => {
    // show random respecting filter
    const filter = categoryFilter.value || 'all';
    const pool = filter === 'all' ? quotes : quotes.filter(q => q.category === filter);
    if (!pool.length) { quoteDisplay.textContent = 'No quotes for selected filter.'; return; }
    const item = pool[Math.floor(Math.random() * pool.length)];
    renderQuote(item);
    try { sessionStorage.setItem(SESSION_LAST, item.id); } catch(e){}
  };
  addBtn.onclick = () => {
    const t = newQuoteText.value.trim(), c = newQuoteCategory.value.trim();
    if (!t || !c) { alert('Enter both quote and category'); return; }
    const newItem = { id: genId(), text: t, category: c, updatedAt: nowIso(), locallyAdded: true };
    quotes.push(newItem);
    saveLocal(); populateCategories(); refreshQuoteList();
    renderQuote(newItem);
    newQuoteText.value = ''; newQuoteCategory.value = '';
    setSyncStatus('Quote added locally. Will sync soon.', 'info');
  };
  syncNowBtn.onclick = () => performSync(true);
  categoryFilter.onchange = () => { localStorage.setItem(LS_FILTER, categoryFilter.value); refreshQuoteList(); };
}

// load local storage, ensure quotes have updatedAt field for conflict logic
function loadLocal() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) { quotes = []; return; }
  try {
    quotes = JSON.parse(raw).map(item => ({
      id: item.id || genId(),
      text: item.text || item.title || '',
      category: item.category || item.body || 'misc',
      updatedAt: item.updatedAt || nowIso()
    }));
  } catch (e) {
    console.error('bad local', e); quotes = [];
  }
}

// populate categories implements separately (used above)
function populateCategories() {
  const cats = getUniqueCategories();
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  cats.forEach(c => { const o = document.createElement('option'); o.value=c; o.textContent=c; categoryFilter.appendChild(o); });
  const last = localStorage.getItem(LS_FILTER) || 'all';
  if ([...categoryFilter.options].some(o => o.value===last)) categoryFilter.value = last;
}

function getUniqueCategories() {
  const cats = quotes.map(q => (q.category || '').trim()).filter(Boolean);
  return [...new Set(cats)].sort();
}

// ------------- start -------------
initApp();