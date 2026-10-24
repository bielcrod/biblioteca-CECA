// Biblioteca CECA — catálogo online
// Os livros ficam em books-data.js (catalogBooks).

const ACHE_URL = 'https://bielcrod.github.io/ache-seu-livro/';
const SITE_URL = 'https://bielcrod.github.io/biblioteca-CECA/';
const BOOKS_PER_PAGE = 12;

// Cor de cada categoria (usada nas capas desenhadas e nas bolinhas)
const CATEGORY_COLORS = {
  'Literatura Brasileira': '#1f6f68',
  'Literatura Estrangeira': '#3b7ca3',
  'Clássicos': '#7d3a62',
  'Romance': '#cf4f3a',
  'Ficção Científica': '#34497a',
  'Fantasia': '#4f7a3f',
  'Aventura': '#2f6d8c',
  'Biografia': '#8a5a2b',
  'Poesia': '#a2416b',
  'Teatro': '#b5602a',
  'Cordel': '#9c3d2e',
  'Quadrinhos': '#5a4a8a',
  'Infantojuvenil': '#a8641a',
  'Didáticos': '#5b6470'
};

const state = {
  search: '',
  category: '',
  sort: 'title',
  page: 1,
  filtered: []
};

const elements = {
  searchInput: document.getElementById('searchInput'),
  sortFilter: document.getElementById('sortFilter'),
  categoryChips: document.getElementById('categoryChips'),
  resultsCount: document.getElementById('resultsCount'),
  booksGrid: document.getElementById('booksGrid'),
  pagination: document.getElementById('pagination'),
  bookModal: document.getElementById('bookModal'),
  bookModalTitle: document.getElementById('bookModalTitle'),
  bookModalContent: document.getElementById('bookModalContent')
};

// ===== Utilitários =====
function normalizeText(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Só letras e números: "A Ilha do tesouro" e "A ILHA DO TESOURO" viram a mesma chave
function textKey(text) {
  return normalizeText(text).replace(/[^a-z0-9]/g, '');
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

function categoryColor(category) {
  return CATEGORY_COLORS[category] || '#6b5a4c';
}

function findBookById(id) {
  return catalogBooks.find(book => book.id === Number(id));
}

// ===== Capas (Open Library) =====
// Muitos livros do catálogo não têm capa na Open Library. Por isso a capa só é usada
// quando o título encontrado bate com o do catálogo; senão fica a capa desenhada.
const COVER_CACHE_KEY = 'bibliotecaCeca_coverCache';

function getCoverCache() {
  try {
    return JSON.parse(localStorage.getItem(COVER_CACHE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveCoverToCache(bookId, url) {
  try {
    const cache = getCoverCache();
    cache[bookId] = url;
    localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error('Erro ao salvar cache de capas:', e);
  }
}

function titlesMatch(a, b) {
  const wordsA = normalizeText(a).split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const wordsB = new Set(normalizeText(b).split(/[^a-z0-9]+/).filter(w => w.length > 2));
  if (wordsA.length === 0) return textKey(a) === textKey(b);
  const common = wordsA.filter(w => wordsB.has(w)).length;
  return common / wordsA.length >= 0.6;
}

async function fetchCover(book) {
  const cache = getCoverCache();
  if (book.id in cache) return cache[book.id];

  try {
    const query = `title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`;
    const response = await fetch(`https://openlibrary.org/search.json?${query}&fields=cover_i,title&limit=3`);
    if (!response.ok) throw new Error(`Open Library respondeu ${response.status}`);
    const data = await response.json();
    const doc = (data.docs || []).find(d => d.cover_i && titlesMatch(book.title, d.title));
    const url = doc ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '';
    saveCoverToCache(book.id, url);
    return url;
  } catch (e) {
    // Sem internet ou API fora do ar: fica a capa desenhada e tenta de novo outro dia
    return '';
  }
}

function fakeCoverHtml(book) {
  return `
    <div class="fake-cover" style="--cover-color:${categoryColor(book.category)}">
      <strong>${escapeHtml(book.title)}</strong>
      <small>${escapeHtml(book.author)}</small>
    </div>`;
}

const coverObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        coverObserver.unobserve(entry.target);
        loadCover(entry.target);
      });
    }, { rootMargin: '150px' })
  : null;

function loadCover(coverElement) {
  const book = findBookById(coverElement.dataset.bookId);
  if (!book) return;
  fetchCover(book).then(url => {
    if (!url) return;
    const img = new Image();
    img.alt = '';
    img.onload = () => coverElement.appendChild(img);
    img.src = url;
  });
}

function watchCover(coverElement) {
  if (coverObserver) coverObserver.observe(coverElement);
  else loadCover(coverElement);
}

// ===== Ligação com o Ache seu Livro =====
// O books-data.js do Ache seu Livro é carregado junto (mesmo site). Se não carregar, isto só retorna null.
function findInAcheSeuLivro(book) {
  if (typeof booksDatabase === 'undefined') return null;
  const key = textKey(book.title);
  const author = normalizeText(book.author);
  return booksDatabase.find(other =>
    textKey(other.title) === key &&
    normalizeText(other.author).split(' ').some(word => word.length > 3 && author.includes(word))
  ) || null;
}

// ===== Categorias =====
function renderCategoryChips() {
  const counts = {};
  catalogBooks.forEach(book => {
    counts[book.category] = (counts[book.category] || 0) + 1;
  });

  const categories = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  const chips = [{ value: '', label: 'Todas', count: catalogBooks.length }]
    .concat(categories.map(c => ({ value: c, label: c, count: counts[c] })));

  elements.categoryChips.innerHTML = '';
  chips.forEach(chip => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-chip' + (chip.value === state.category ? ' selected' : '');
    button.setAttribute('aria-pressed', chip.value === state.category ? 'true' : 'false');
    button.innerHTML = `
      ${chip.value ? `<span class="dot" style="--chip-color:${categoryColor(chip.value)}"></span>` : ''}
      ${escapeHtml(chip.label)} <span class="count">${chip.count}</span>`;
    button.addEventListener('click', () => {
      state.category = chip.value;
      state.page = 1;
      renderCategoryChips();
      applyFilters();
    });
    elements.categoryChips.appendChild(button);
  });
}

// ===== Busca, filtro e ordem =====
function applyFilters() {
  const term = normalizeText(state.search.trim());

  state.filtered = catalogBooks.filter(book => {
    const matchesSearch = !term ||
      normalizeText(book.title).includes(term) ||
      normalizeText(book.author).includes(term) ||
      normalizeText(book.description).includes(term);
    const matchesCategory = !state.category || book.category === state.category;
    return matchesSearch && matchesCategory;
  });

  const byText = field => (a, b) => normalizeText(a[field]).localeCompare(normalizeText(b[field]), 'pt-BR');
  switch (state.sort) {
    case 'author': state.filtered.sort(byText('author')); break;
    case 'recent': state.filtered.sort((a, b) => (b.year || 0) - (a.year || 0)); break;
    case 'oldest': state.filtered.sort((a, b) => (a.year || 9999) - (b.year || 9999)); break;
    default: state.filtered.sort(byText('title'));
  }

  renderBooks();
}

function renderBooks() {
  const total = state.filtered.length;
  elements.resultsCount.textContent = total === 1 ? '1 livro encontrado' : `${total} livros encontrados`;
  elements.booksGrid.innerHTML = '';

  if (total === 0) {
    elements.booksGrid.innerHTML = `
      <div class="no-books">
        <strong>Nenhum livro encontrado</strong>
        Este catálogo ainda não tem todos os livros da escola. Pergunte na biblioteca!
      </div>`;
    elements.pagination.innerHTML = '';
    return;
  }

  const totalPages = Math.ceil(total / BOOKS_PER_PAGE);
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * BOOKS_PER_PAGE;

  state.filtered.slice(start, start + BOOKS_PER_PAGE).forEach(book => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'book-card';
    card.setAttribute('aria-label', `${book.title}, de ${book.author}`);
    card.innerHTML = `
      <div class="book-cover" data-book-id="${book.id}">${fakeCoverHtml(book)}</div>
      <div class="book-info">
        <h3 class="book-title">${escapeHtml(book.title)}</h3>
        <p class="book-author">${escapeHtml(book.author)}</p>
        <div class="book-meta">
          <span class="category-tag"><span class="dot" style="--chip-color:${categoryColor(book.category)}"></span>${escapeHtml(book.category)}</span>
          ${book.year ? `<span>${book.year}</span>` : ''}
        </div>
      </div>`;
    card.addEventListener('click', () => showBookModal(book.id));
    elements.booksGrid.appendChild(card);
    watchCover(card.querySelector('.book-cover'));
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  elements.pagination.innerHTML = '';
  if (totalPages <= 1) return;

  const addButton = (label, page, active = false, ariaLabel = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = label;
    if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
    if (active) {
      button.classList.add('active');
      button.setAttribute('aria-current', 'page');
    }
    button.addEventListener('click', () => {
      state.page = page;
      renderBooks();
      elements.resultsCount.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    elements.pagination.appendChild(button);
  };

  if (state.page > 1) addButton('&laquo;', state.page - 1, false, 'Página anterior');

  let startPage = Math.max(1, state.page - 2);
  const endPage = Math.min(totalPages, startPage + 4);
  startPage = Math.max(1, endPage - 4);
  for (let i = startPage; i <= endPage; i++) addButton(String(i), i, i === state.page);

  if (state.page < totalPages) addButton('&raquo;', state.page + 1, false, 'Próxima página');
}

// ===== Detalhes do livro =====
function showBookModal(bookId) {
  const book = findBookById(bookId);
  if (!book) return;

  const acheBook = findInAcheSeuLivro(book);
  elements.bookModalTitle.textContent = book.title;
  elements.bookModalContent.innerHTML = `
    <div class="book-detail">
      <div class="book-cover" data-book-id="${book.id}">${fakeCoverHtml(book)}</div>
      <div class="book-detail-info">
        <p class="book-detail-author">${escapeHtml(book.author)}</p>
        <div class="book-detail-meta">
          <span class="category-tag"><span class="dot" style="--chip-color:${categoryColor(book.category)}"></span>${escapeHtml(book.category)}</span>
          ${book.year ? `<span>${book.year}</span>` : ''}
        </div>
        ${book.description ? `<p class="book-detail-description">${escapeHtml(book.description)}</p>` : ''}
      </div>
    </div>
    <div class="book-detail-links">
      ${acheBook ? `<a class="btn btn-primary" href="${ACHE_URL}?livro=${acheBook.id}"><i class="fas fa-wand-magic-sparkles"></i> Ver livros parecidos no Ache seu Livro</a>` : ''}
      <button type="button" class="btn" id="shareBookBtn"><i class="fas fa-share-alt"></i> Compartilhar</button>
    </div>
    <p class="ask-library"><i class="fas fa-circle-info"></i> Para pegar emprestado, confira na biblioteca da escola se há exemplar disponível.</p>
  `;

  loadCover(elements.bookModalContent.querySelector('.book-cover'));
  document.getElementById('shareBookBtn').addEventListener('click', () => shareBook(book));

  elements.bookModal.style.display = 'block';
  elements.bookModal.scrollTop = 0;
  elements.bookModal.querySelector('.close-modal').focus({ preventScroll: true });
}

function closeModal() {
  elements.bookModal.style.display = 'none';
}

async function shareBook(book) {
  const url = `${SITE_URL}?livro=${book.id}`;
  const text = `📚 "${book.title}", de ${book.author}, no catálogo da Biblioteca CECA.`;

  if (navigator.share) {
    try {
      await navigator.share({ title: book.title, text, url });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    alert('Link do livro copiado!');
  } catch (e) {
    prompt('Copie o link do livro:', url);
  }
}

// ===== Início =====
function init() {
  elements.searchInput.addEventListener('input', debounce(() => {
    state.search = elements.searchInput.value;
    state.page = 1;
    applyFilters();
  }, 200));

  elements.sortFilter.addEventListener('change', () => {
    state.sort = elements.sortFilter.value;
    state.page = 1;
    applyFilters();
  });

  elements.bookModal.querySelector('.close-modal').addEventListener('click', closeModal);
  elements.bookModal.addEventListener('click', (e) => {
    if (e.target === elements.bookModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  renderCategoryChips();
  applyFilters();

  // Link direto para um livro: ?livro=123
  const params = new URLSearchParams(window.location.search);
  if (params.has('livro')) showBookModal(params.get('livro'));
}

init();
