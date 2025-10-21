// Key names for storage
const LS_KEY = 'quotesList';
const SESSION_LAST = 'lastViewedQuoteId';

// Default starter quotes (used only if localStorage empty)
const defaultQuotes = [
  { id: genId(), text: "The only way to do great work is to love what you do.", category: "Motivation" },
  { id: genId(), text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" },
  { id: genId(), text: "Success is not final, failure is not fatal.", category: "Perseverance" }
];

// In-memory array used by app
let quotes = [];

// DOM refs
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const addBtn = document.getElementById('addBtn');
const newQuoteText = document.getElementById('newQuoteText');
const newQuoteCategory = document.getElementById('newQuoteCategory');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const quoteList = document.getElementById('quoteList');
const showAllBtn = document.getElementById('showAll');

// ---------- Utility ----------
function genId() {
  // Simple unique id (timestamp + random)
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
}

function saveQuotes() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(quotes));
  } catch (e) {
    console.error('Failed saving to localStorage', e);
    alert('Could not save quotes to localStorage.');
  }
}

function loadQuotes() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    quotes = [...defaultQuotes];
    saveQuotes();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // ensure each item has id, text and category
      quotes = parsed.map(item => ({
        id: item.id || genId(),
        text: String(item.text || '').trim(),
        category: String(item.category || '').trim()
      })).filter(q => q.text && q.category);
    } else {
      quotes = [...defaultQuotes];
      saveQuotes();
    }
  } catch (e) {
    console.error('Failed loading quotes from localStorage', e);
    quotes = [...defaultQuotes];
    saveQuotes();
  }
}

function renderQuote(q) {
  // sanitize minimal by using textContent not innerHTML
  quoteDisplay.innerHTML = '';
  const p = document.createElement('p');
  p.textContent = `"${q.text}"`;
  p.style.fontStyle = 'italic';
  p.style.fontSize = '1.05rem';

  const meta = document.createElement('div');
  meta.textContent = `— ${q.category}`;
  meta.style.color = '#555';
  meta.style.marginTop = '6px';

  quoteDisplay.appendChild(p);
  quoteDisplay.appendChild(meta);
}

function getQuoteById(id) {
  return quotes.find(q => q.id === id);
}

// ---------- Main features ----------

// Show a random quote and save its id into sessionStorage (last viewed)
function showRandomQuote() {
  if (!quotes.length) {
    quoteDisplay.textContent = 'No quotes available.';
    return;
  }
  const idx = Math.floor(Math.random() * quotes.length);
  const q = quotes[idx];
  renderQuote(q);
  try {
    sessionStorage.setItem(SESSION_LAST, q.id);
  } catch (e) {
    // sessionStorage might fail in some environments - ignore safely
    console.warn('sessionStorage not available', e);
  }
}

// Add a new quote from inputs, persist to localStorage and refresh list
function addQuote() {
  const text = newQuoteText.value.trim();
  const category = newQuoteCategory.value.trim();

  if (!text || !category) {
    alert('Please enter both quote text and category.');
    return;
  }

  const newQ = { id: genId(), text, category };
  quotes.push(newQ);
  saveQuotes();
  newQuoteText.value = '';
  newQuoteCategory.value = '';
  refreshQuoteList();
  renderQuote(newQ); // show the newly added quote
  try { sessionStorage.setItem(SESSION_LAST, newQ.id); } catch (e) {}
}

// Render the list of stored quotes with remove buttons
function refreshQuoteList() {
  quoteList.innerHTML = '';
  if (!quotes.length) {
    quoteList.textContent = 'No stored quotes.';
    return;
  }

  quotes.forEach(q => {
    const row = document.createElement('div');
    row.className = 'quote-row';

    const left = document.createElement('div');
    const text = document.createElement('div');
    text.textContent = q.text;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = q.category + ' • id: ' + q.id;

    left.appendChild(text);
    left.appendChild(meta);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';

    const showBtn = document.createElement('button');
    showBtn.textContent = 'Show';
    showBtn.className = 'small';
    showBtn.addEventListener('click', () => {
      renderQuote(q);
      try { sessionStorage.setItem(SESSION_LAST, q.id); } catch (e) {}
    });

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'small danger';
    removeBtn.addEventListener('click', () => {
      if (!confirm('Remove this quote?')) return;
      quotes = quotes.filter(item => item.id !== q.id);
      saveQuotes();
      refreshQuoteList();
      // if removed quote was displayed and session last points to it, clear session
      try {
        const lastId = sessionStorage.getItem(SESSION_LAST);
        if (lastId === q.id) sessionStorage.removeItem(SESSION_LAST);
      } catch (e) {}
    });

    right.appendChild(showBtn);
    right.appendChild(removeBtn);

    row.appendChild(left);
    row.appendChild(right);
    quoteList.appendChild(row);
  });
}

// Export current quotes to a JSON file
function exportToJson() {
  try {
    const dataStr = JSON.stringify(quotes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `quotes-export-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Export failed', e);
    alert('Export failed.');
  }
}

// Import quotes from user-selected JSON file
function importFromJsonFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!Array.isArray(parsed)) {
        alert('Imported JSON must be an array of quote objects.');
        return;
      }

      // Validate and normalize imported items
      const valid = [];
      parsed.forEach(item => {
        if (!item) return;
        const text = String(item.text || item.quote || '').trim();
        const category = String(item.category || item.cat || '').trim();
        if (!text || !category) return;
        // If item has id and it collides with existing id, generate a new one
        let id = item.id && !quotes.some(q => q.id === item.id) ? item.id : genId();
        valid.push({ id, text, category });
      });

      if (!valid.length) {
        alert('No valid quotes found in file.');
        return;
      }

      // Append and save
      quotes.push(...valid);
      saveQuotes();
      refreshQuoteList();
      alert(`Imported ${valid.length} quotes successfully.`);
    } catch (e) {
      console.error('Import error', e);
      alert('Failed to import: invalid JSON.');
    }
  };
  reader.readAsText(file);
}

// Load initial app state, restore session last viewed quote if any
function init() {
  loadQuotes();
  refreshQuoteList();

  // If session has last viewed id, attempt to display it
  try {
    const lastId = sessionStorage.getItem(SESSION_LAST);
    const lastQuote = lastId ? getQuoteById(lastId) : null;
    if (lastQuote) renderQuote(lastQuote);
    else showRandomQuote();
  } catch (e) {
    // if sessionStorage fails, just show random
    showRandomQuote();
  }
}

// ---------- event wiring ----------
newQuoteBtn.addEventListener('click', showRandomQuote);
addBtn.addEventListener('click', addQuote);
exportBtn.addEventListener('click', exportToJson);
importFile.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) importFromJsonFile(file);
  // clear file input to allow re-importing same file if needed
  importFile.value = '';
});
showAllBtn.addEventListener('click', () => {
  // Scroll to list and highlight it by refreshing, list already rendered
  refreshQuoteList();
  document.getElementById('quoteList').scrollIntoView({ behavior: 'smooth' });
});

// Initialize app
init();