// Key names for storage
const LS_KEY = 'quotesList';
const SESSION_LAST = 'lastViewedQuoteId';
const LS_FILTER = 'lastSelectedCategory';

// Default quotes
const defaultQuotes = [
  { id: genId(), text: "The only way to do great work is to love what you do.", category: "Motivation" },
  { id: genId(), text: "In the middle of every difficulty lies opportunity.", category: "Inspiration" },
  { id: genId(), text: "Success is not final, failure is not fatal.", category: "Perseverance" }
];

let quotes = [];

// DOM references
const quoteDisplay = document.getElementById('quoteDisplay');
const newQuoteBtn = document.getElementById('newQuote');
const addBtn = document.getElementById('addBtn');
const newQuoteText = document.getElementById('newQuoteText');
const newQuoteCategory = document.getElementById('newQuoteCategory');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const quoteList = document.getElementById('quoteList');
const showAllBtn = document.getElementById('showAll');
const categoryFilter = document.getElementById('categoryFilter');

// ---------- Utility ----------
function genId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
}

function saveQuotes() {
  localStorage.setItem(LS_KEY, JSON.stringify(quotes));
}

function loadQuotes() {
  const raw = localStorage.getItem(LS_KEY);
  quotes = raw ? JSON.parse(raw) : defaultQuotes;
  saveQuotes();
}

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
  const cats = quotes.map(q => q.category.trim()).filter(Boolean);
  return [...new Set(cats)].sort();
}

// ---------- Category Filter ----------
function populateCategories() {
  const categories = getUniqueCategories();
  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });

  // restore last selected filter if present
  const lastFilter = localStorage.getItem(LS_FILTER);
  if (lastFilter && (lastFilter === 'all' || categories.includes(lastFilter))) {
    categoryFilter.value = lastFilter;
  }
}

function filterQuotes() {
  const selected = categoryFilter.value;
  localStorage.setItem(LS_FILTER, selected);
  refreshQuoteList(selected);
}

// ---------- Quote display ----------
function showRandomQuote() {
  if (!quotes.length) {
    quoteDisplay.textContent = 'No quotes available.';
    return;
  }
  const selectedCategory = categoryFilter.value;
  const filtered = selectedCategory === 'all'
    ? quotes
    : quotes.filter(q => q.category === selectedCategory);

  if (!filtered.length) {
    quoteDisplay.textContent = `No quotes found in "${selectedCategory}" category.`;
    return;
  }

  const idx = Math.floor(Math.random() * filtered.length);
  const q = filtered[idx];
  renderQuote(q);
  sessionStorage.setItem(SESSION_LAST, q.id);
}

function addQuote() {
  const text = newQuoteText.value.trim();
  const category = newQuoteCategory.value.trim();
  if (!text || !category) {
    alert('Please enter both quote text and category.');
    return;
  }

  quotes.push({ id: genId(), text, category });
  saveQuotes();
  populateCategories(); // update dropdown
  refreshQuoteList(categoryFilter.value);
  newQuoteText.value = '';
  newQuoteCategory.value = '';
  renderQuote(quotes[quotes.length - 1]);
  sessionStorage.setItem(SESSION_LAST, quotes[quotes.length - 1].id);
}

function refreshQuoteList(filter = 'all') {
  quoteList.innerHTML = '';
  const filtered = filter === 'all'
    ? quotes
    : quotes.filter(q => q.category === filter);

  if (!filtered.length) {
    quoteList.textContent = 'No quotes available for this category.';
    return;
  }

  filtered.forEach(q => {
    const row = document.createElement('div');
    row.className = 'quote-row';

    const left = document.createElement('div');
    left.innerHTML = `<div>${q.text}</div><div class="meta">${q.category}</div>`;

    const right = document.createElement('div');
    const showBtn = document.createElement('button');
    showBtn.textContent = 'Show';
    showBtn.className = 'small';
    showBtn.onclick = () => renderQuote(q);

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'small danger';
    removeBtn.onclick = () => {
      if (confirm('Remove this quote?')) {
        quotes = quotes.filter(item => item.id !== q.id);
        saveQuotes();
        populateCategories();
        refreshQuoteList(filter);
      }
    };

    right.append(showBtn, removeBtn);
    row.append(left, right);
    quoteList.appendChild(row);
  });
}

// ---------- Import / Export ----------
function exportToJson() {
  const blob = new Blob([JSON.stringify(quotes, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quotes.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importFromJsonFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const imported = JSON.parse(e.target.result);
    quotes.push(...imported);
    saveQuotes();
    populateCategories();
    refreshQuoteList(categoryFilter.value);
    alert('Quotes imported successfully!');
  };
  reader.readAsText(file);
}

// ---------- Initialization ----------
function init() {
  loadQuotes();
  populateCategories();

  // Restore last selected filter and last viewed quote
  const savedFilter = localStorage.getItem(LS_FILTER) || 'all';
  categoryFilter.value = savedFilter;
  refreshQuoteList(savedFilter);

  const lastQuoteId = sessionStorage.getItem(SESSION_LAST);
  const lastQuote = quotes.find(q => q.id === lastQuoteId);
  if (lastQuote) renderQuote(lastQuote);
  else showRandomQuote();
}

// ---------- Event Listeners ----------
newQuoteBtn.onclick = showRandomQuote;
addBtn.onclick = addQuote;
exportBtn.onclick = exportToJson;
importFile.onchange = e => {
  if (e.target.files.length) importFromJsonFile(e.target.files[0]);
};
categoryFilter.onchange = filterQuotes;
showAllBtn.onclick = () => {
  categoryFilter.value = 'all';
  filterQuotes();
};

// ---------- Start ----------
init();
