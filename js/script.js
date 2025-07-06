document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    const state = {
        books: [],
        activeFilter: 'همه',
        currentBook: null,
        settings: {
            theme: 'light',
            font: 'Vazirmatn',
            fontSize: 16,
            textAlign: 'right'
        }
    };

    // --- DOM ELEMENTS ---
    const bookList = document.getElementById('book-list');
    const categoryTabs = document.getElementById('category-tabs');
    const footerNavButtons = document.querySelectorAll('#app-footer button');
    const pageSections = document.querySelectorAll('.page-section');
    const readerView = document.getElementById('reader-view');
    const viewer = document.getElementById('viewer');
    const readerProgressBar = document.getElementById('reader-progress-bar');
    const prevArrow = document.getElementById('prev');
    const nextArrow = document.getElementById('next');

    // --- INITIALIZATION ---
    function init() {
        loadSettings();
        applySettings();
        loadBooks();
        renderCategories();
        renderBookList();
        setupEventListeners();
        showPage('home-section');
    }

    // --- DATA HANDLING ---
    function loadBooks() {
        // Load progress from localStorage and merge with booksData
        const savedProgress = JSON.parse(localStorage.getItem('bookProgress')) || {};
        state.books = booksData.map(book => ({
            ...book,
            progress: savedProgress[book.id] || book.progress
        }));
    }

    function saveProgress(bookId, progressData) {
        const savedProgress = JSON.parse(localStorage.getItem('bookProgress')) || {};
        savedProgress[bookId] = progressData;
        localStorage.setItem('bookProgress', JSON.stringify(savedProgress));
    }
    
    function loadSettings() {
        const savedSettings = JSON.parse(localStorage.getItem('bookReaderSettings'));
        if (savedSettings) {
            state.settings = savedSettings;
        }
    }

    function saveSettings() {
        localStorage.setItem('bookReaderSettings', JSON.stringify(state.settings));
    }
    
    function applySettings() {
         document.documentElement.setAttribute('data-theme', state.settings.theme);
         // More settings application logic will go here (font size, etc)
    }


    // --- RENDERING ---
    function renderBookList() {
        bookList.innerHTML = '';
        const filteredBooks = state.activeFilter === 'همه'
            ? state.books
            : state.books.filter(book => book.tags.includes(state.activeFilter));

        if (filteredBooks.length === 0) {
            bookList.innerHTML = `<p>کتابی در این دسته یافت نشد.</p>`;
            return;
        }

        filteredBooks.forEach(book => {
            const percentage = (book.progress.readPages / book.progress.totalPages) * 100;
            const item = document.createElement('div');
            item.className = 'book-item';
            item.dataset.id = book.id;
            
            item.innerHTML = `
                <div class="book-cover">
                    <img src="${book.cover}" alt="${book.title}">
                </div>
                <div class="book-info">
                    <h3>${book.title} (${book.year})</h3>
                    <p class="meta">خوانده شده: ${book.progress.readPages} / ${book.progress.totalPages} صفحه</p>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width: ${percentage.toFixed(2)}%;"></div>
                        <span class="progress-bar-text">${Math.round(percentage)}%</span>
                    </div>
                     <div class="book-description">
                        <p>${book.description}</p>
                    </div>
                </div>
                 <span class="material-symbols-outlined book-expand">chevron_left</span>
            `;
            bookList.appendChild(item);
            
            // Event listener for opening the book
            item.querySelector('.book-cover').addEventListener('click', () => openBook(book.id));
             item.querySelector('.book-info').addEventListener('click', (e) => {
                 if(!e.target.closest('.book-expand')) {
                     openBook(book.id);
                 }
             });

            // Event listener for expanding description
            const expandBtn = item.querySelector('.book-expand');
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const description = item.querySelector('.book-description');
                description.classList.toggle('visible');
                expandBtn.classList.toggle('expanded');
            });
        });
    }

    function renderCategories() {
        const allTags = new Set(['همه']);
        state.books.forEach(book => book.tags.forEach(tag => allTags.add(tag)));

        categoryTabs.innerHTML = '';
        allTags.forEach(tag => {
            const tab = document.createElement('button');
            tab.textContent = tag;
            tab.dataset.filter = tag;
            if (tag === state.activeFilter) {
                tab.classList.add('active');
            }
            tab.addEventListener('click', () => {
                state.activeFilter = tag;
                document.querySelector('#category-tabs .active').classList.remove('active');
                tab.classList.add('active');
                renderBookList();
            });
            categoryTabs.appendChild(tab);
        });
    }

    // --- NAVIGATION ---
    function showPage(targetId) {
        pageSections.forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(targetId).classList.add('active');

        footerNavButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.target === targetId);
        });
    }

    // --- EPUB READER LOGIC ---
    function openBook(bookId) {
        const bookData = state.books.find(b => b.id === bookId);
        if (!bookData) return;

        state.currentBook = ePub(bookData.file);
        state.currentBook.renderTo(viewer, {
            width: "100%",
            height: "100%",
        });

        const rendition = state.currentBook.rendition;
        
        // Load last location
        const lastLocation = localStorage.getItem(`book-location-${bookId}`);
        rendition.display(lastLocation || undefined);

        // Update progress on location change
        rendition.on("relocated", (location) => {
            // Save current location
            localStorage.setItem(`book-location-${bookId}`, location.start.cfi);
            
            // Update thin progress bar
            state.currentBook.locations.generate(1000).then(locations => {
                const percentage = state.currentBook.locations.percentageFromCfi(location.start.cfi);
                readerProgressBar.style.width = `${percentage * 100}%`;
                
                // Update main list progress
                const totalPages = bookData.progress.totalPages; // This is an estimate
                const readPages = Math.round(totalPages * percentage);
                bookData.progress.readPages = readPages;
                saveProgress(bookId, bookData.progress);
                // No need to re-render the whole list while reading
            });
        });
        
        prevArrow.onclick = () => rendition.prev();
        nextArrow.onclick = () => rendition.next();

        readerView.classList.add('open');
        // Add a close button or gesture later
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        footerNavButtons.forEach(button => {
            button.addEventListener('click', () => {
                showPage(button.dataset.target);
            });
        });
        
        // Basic keyboard navigation for reader
        document.addEventListener('keydown', (e) => {
            if (readerView.classList.contains('open')) {
                if (e.key === 'ArrowLeft') state.currentBook.rendition.next();
                if (e.key === 'ArrowRight') state.currentBook.rendition.prev();
                if (e.key === 'Escape') { // Close reader with Escape key
                    readerView.classList.remove('open');
                    renderBookList(); // Update progress on close
                }
            }
        });
    }
    
    // --- START THE APP ---
    init();
});
