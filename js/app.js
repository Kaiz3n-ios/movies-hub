// ========== TMDB API CONFIGURATION ==========
const API_KEY = 'f0e822067b2f9117a60a2b93adead327';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_URL = 'https://image.tmdb.org/t/p/original';

// ========== DOM ELEMENTS ==========
const moviesGrid = document.getElementById('movies-grid');
const categoryButtons = document.querySelectorAll('.category-btn');
const toggleButtonsContainer = document.getElementById('toggle-buttons-container');
const contentTypeButtons = document.querySelectorAll('.content-type-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const moviesTitle = document.getElementById('movies-title');
const movieCount = document.getElementById('movie-count');
const categoryLabel = document.getElementById('category-label');
const loadMoreBtn = document.getElementById('load-more');
const backToTopBtn = document.getElementById('back-to-top');
const skeletonLoader = document.getElementById('skeleton-loader');
const emptyState = document.getElementById('empty-state');
const loadingMore = document.getElementById('loading-more');

// Modals
const trailerModal = document.getElementById('trailer-modal');
const detailsModal = document.getElementById('details-modal');
const favoritesModal = document.getElementById('favorites-modal');
const closeTrailer = document.getElementById('close-trailer');
const closeDetails = document.getElementById('close-details');
const closeFavorites = document.getElementById('close-favorites');
const trailerContainer = document.getElementById('trailer-container');
const detailsContainer = document.getElementById('details-container');
const recommendationsGrid = document.getElementById('recommendations-grid');
const favoritesGrid = document.getElementById('favorites-grid');
const favoritesEmpty = document.getElementById('favorites-empty');

// Header Actions
const favoritesBtn = document.getElementById('favorites-btn');
const favoritesCount = document.getElementById('favorites-count');
const viewToggleBtn = document.getElementById('view-toggle-btn');
const viewIcon = document.getElementById('view-icon');
const viewText = document.getElementById('view-text');

// Advanced Filters
const yearFilter = document.getElementById('year-filter');
const ratingFilter = document.getElementById('rating-filter');
const sortFilter = document.getElementById('sort-filter');
const resetFiltersBtn = document.getElementById('reset-filters');

// Carousel
const carouselTrack = document.getElementById('carousel-track');

// Offline Indicator
const offlineIndicator = document.getElementById('offline-indicator');

// ========== STATE MANAGEMENT ==========
let currentContentType = 'movies';
let currentMovieType = 'upcoming';
let currentCategory = 'all';
let currentPage = 1;
let totalPages = 1;
let allItems = [];
let searchTimeout;
let isSearching = false;
let currentViewMode = 'grid';
let favorites = JSON.parse(localStorage.getItem('moviehub_favorites') || '[]');
let apiCache = new Map();
let currentYear = 'all';
let currentRating = 'all';
let currentSort = 'popularity.desc';
let carouselInterval = null;

// Genre mapping
const movieGenres = {
    28: 'Action', 35: 'Comedy', 18: 'Drama', 878: 'Sci-Fi',
    27: 'Horror', 10749: 'Romance', 16: 'Animation', 53: 'Thriller', 
    12: 'Adventure', 14: 'Fantasy', 80: 'Crime'
};

const tvGenres = {
    10759: 'Action', 35: 'Comedy', 18: 'Drama', 10765: 'Sci-Fi',
    27: 'Horror', 10749: 'Romance', 16: 'Animation', 9648: 'Mystery', 
    10751: 'Family', 80: 'Crime', 10768: 'War & Politics'
};

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    setupEventListeners();
    setupKeyboardShortcuts();
    setupYearFilter();
    setupGenreButtons();
    updateFavoritesCount();
    checkOnlineStatus();
    
    if (currentContentType === 'movies') {
        setupMovieButtons();
    } else {
        setupTVButtons();
    }
    
    await fetchFeaturedContent();
    await fetchContent();
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    // Content Type Toggle
    contentTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            contentTypeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentContentType = button.getAttribute('data-content');
            switchContentType();
        });
    });
    
    // Search
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    // Advanced Filters
    yearFilter.addEventListener('change', applyFilters);
    ratingFilter.addEventListener('change', applyFilters);
    sortFilter.addEventListener('change', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Load More
    loadMoreBtn.addEventListener('click', loadMore);
    
    // Modals
    closeTrailer.onclick = () => closeModal(trailerModal, trailerContainer);
    closeDetails.onclick = () => closeModal(detailsModal);
    closeFavorites.onclick = () => closeModal(favoritesModal);
    
    window.onclick = (e) => {
        if (e.target === trailerModal) closeModal(trailerModal, trailerContainer);
        if (e.target === detailsModal) closeModal(detailsModal);
        if (e.target === favoritesModal) closeModal(favoritesModal);
    };
    
    // Favorites
    favoritesBtn.addEventListener('click', showFavorites);
    
    // View Toggle
    viewToggleBtn.addEventListener('click', toggleViewMode);
    
    // Back to Top
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Scroll Events
    window.addEventListener('scroll', handleScroll);
    
    // Online/Offline
    window.addEventListener('online', () => {
        offlineIndicator.style.display = 'none';
        showNotification('Back online!', 'success');
    });
    
    window.addEventListener('offline', () => {
        offlineIndicator.style.display = 'block';
    });

    // Carousel Navigation
    setupCarouselNavigation();
}

// ========== CAROUSEL NAVIGATION ==========
function setupCarouselNavigation() {
    const prevBtn = document.querySelector('.carousel-prev');
    const nextBtn = document.querySelector('.carousel-next');

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', () => {
            carouselTrack.scrollBy({
                left: -320,
                behavior: 'smooth'
            });
        });

        nextBtn.addEventListener('click', () => {
            carouselTrack.scrollBy({
                left: 320,
                behavior: 'smooth'
            });
        });
    }

    // Auto-scroll carousel
    startCarouselAutoScroll();
    
    // Pause on hover
    carouselTrack.addEventListener('mouseenter', () => {
        stopCarouselAutoScroll();
    });
    
    carouselTrack.addEventListener('mouseleave', () => {
        startCarouselAutoScroll();
    });
}

function startCarouselAutoScroll() {
    stopCarouselAutoScroll();
    carouselInterval = setInterval(() => {
        if (carouselTrack.scrollLeft >= carouselTrack.scrollWidth - carouselTrack.clientWidth) {
            carouselTrack.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            carouselTrack.scrollBy({ left: 320, behavior: 'smooth' });
        }
    }, 5000);
}

function stopCarouselAutoScroll() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

// ========== SCROLL HANDLER ==========
function handleScroll() {
    // Show/hide back to top button
    if (window.scrollY > 500) {
        backToTopBtn.classList.add('show');
    } else {
        backToTopBtn.classList.remove('show');
    }

    // Lazy load images
    lazyLoadImages();
}

// ========== LAZY LOAD IMAGES ==========
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

// ========== KEYBOARD SHORTCUTS ==========
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ESC to close modals
        if (e.key === 'Escape') {
            if (trailerModal.style.display === 'block') closeModal(trailerModal, trailerContainer);
            if (detailsModal.style.display === 'block') closeModal(detailsModal);
            if (favoritesModal.style.display === 'block') closeModal(favoritesModal);
            if (isSearching) clearSearch();
        }
        
        // "/" to focus search
        if (e.key === '/' && !isInputFocused()) {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

function isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
}

// ========== CHECK ONLINE STATUS ==========
function checkOnlineStatus() {
    if (!navigator.onLine) {
        offlineIndicator.style.display = 'block';
    }
}

// ========== SETUP YEAR FILTER ==========
function setupYearFilter() {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1950; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    }
}

// ========== SETUP GENRE BUTTONS ==========
function setupGenreButtons() {
    const categoryButtonsContainer = document.getElementById('category-buttons');
    const genres = currentContentType === 'movies' ? movieGenres : tvGenres;
    
    categoryButtonsContainer.innerHTML = '<button class="category-btn active" data-category="all">All</button>';
    
    Object.entries(genres).forEach(([id, name]) => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.setAttribute('data-category', id);
        btn.innerHTML = `${name} <span class="count"></span>`;
        
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = id;
            currentPage = 1;
            if (!isSearching) {
                fetchContent();
            } else {
                performSearch(searchInput.value.trim());
            }
        });
        
        categoryButtonsContainer.appendChild(btn);
    });
}

// ========== SWITCH CONTENT TYPE ==========
function switchContentType() {
    currentPage = 1;
    allItems = [];
    isSearching = false;
    searchInput.value = '';
    clearSearchBtn.classList.remove('show');
    currentCategory = 'all';
    
    resetFilters();
    
    categoryLabel.textContent = currentContentType === 'movies' ? 'Browse Movies' : 'Browse TV Shows';
    
    setupGenreButtons();
    
    if (currentContentType === 'movies') {
        setupMovieButtons();
        currentMovieType = 'upcoming';
    } else {
        setupTVButtons();
        currentMovieType = 'popular';
    }
    
    updateTitle();
    fetchFeaturedContent();
    fetchContent();
}

// ========== SETUP CATEGORY BUTTONS ==========
function setupMovieButtons() {
    toggleButtonsContainer.innerHTML = `
        <button class="toggle-btn active" data-type="upcoming">
            <i class="fas fa-calendar-alt"></i> Upcoming
        </button>
        <button class="toggle-btn" data-type="now_playing">
            <i class="fas fa-fire"></i> Now Playing
        </button>
        <button class="toggle-btn" data-type="popular">
            <i class="fas fa-star"></i> Popular
        </button>
        <button class="toggle-btn" data-type="top_rated">
            <i class="fas fa-trophy"></i> Top Rated
        </button>
    `;
    attachToggleListeners();
}

function setupTVButtons() {
    toggleButtonsContainer.innerHTML = `
        <button class="toggle-btn active" data-type="popular">
            <i class="fas fa-star"></i> Popular
        </button>
        <button class="toggle-btn" data-type="top_rated">
            <i class="fas fa-trophy"></i> Top Rated
        </button>
        <button class="toggle-btn" data-type="airing_today">
            <i class="fas fa-tv"></i> Airing Today
        </button>
        <button class="toggle-btn" data-type="on_the_air">
            <i class="fas fa-broadcast-tower"></i> On The Air
        </button>
    `;
    attachToggleListeners();
}

function attachToggleListeners() {
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    toggleBtns.forEach(button => {
        button.addEventListener('click', () => {
            toggleBtns.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentMovieType = button.getAttribute('data-type');
            currentPage = 1;
            allItems = [];
            isSearching = false;
            searchInput.value = '';
            clearSearchBtn.classList.remove('show');
            updateTitle();
            fetchContent();
        });
    });
}

// ========== UPDATE TITLE ==========
function updateTitle() {
    const titleMap = {
        upcoming: 'Upcoming Movies',
        now_playing: 'Now Playing in Theaters',
        popular: currentContentType === 'movies' ? 'Popular Movies' : 'Popular TV Shows',
        top_rated: currentContentType === 'movies' ? 'Top Rated Movies' : 'Top Rated TV Shows',
        airing_today: 'Airing Today',
        on_the_air: 'Currently On The Air'
    };
    
    moviesTitle.textContent = titleMap[currentMovieType] || 'Browse';
}

// ========== FETCH WITH CACHE ==========
async function fetchWithCache(url, cacheTime = 300000) {
    if (apiCache.has(url)) {
        const { data, timestamp } = apiCache.get(url);
        if (Date.now() - timestamp < cacheTime) {
            return data;
        }
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        apiCache.set(url, { data, timestamp: Date.now() });
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        showNotification('Failed to load content. Please check your connection.', 'error');
        throw error;
    }
}

// ========== NOTIFICATION SYSTEM ==========
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========== FETCH FEATURED CONTENT ==========
async function fetchFeaturedContent() {
    try {
        const type = currentContentType === 'movies' ? 'movie' : 'tv';
        const url = `${BASE_URL}/${type}/popular?api_key=${API_KEY}&language=en-US&page=1`;
        const data = await fetchWithCache(url);
        
        const featured = data.results.slice(0, 15);
        displayCarousel(featured);
    } catch (error) {
        console.error('Error fetching featured content:', error);
    }
}

// ========== DISPLAY CAROUSEL ==========
function displayCarousel(items) {
    carouselTrack.innerHTML = '';
    
    // Duplicate for seamless loop
    const duplicated = [...items, ...items];
    
    duplicated.forEach(item => {
        const div = document.createElement('div');
        div.classList.add('carousel-item');
        div.onclick = () => openDetails(item.id);
        div.setAttribute('tabindex', '0');
        div.setAttribute('role', 'button');
        div.setAttribute('aria-label', `View details for ${item.title || item.name}`);
        
        // Keyboard support
        div.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openDetails(item.id);
            }
        });
        
        const posterPath = item.poster_path 
            ? IMG_URL + item.poster_path 
            : 'https://via.placeholder.com/300x450?text=No+Poster';
        
        const title = item.title || item.name;
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        
        div.innerHTML = `
            <img src="${posterPath}" alt="${title} poster" loading="lazy">
            <div class="carousel-overlay">
                <h3>${title}</h3>
                <p><i class="fas fa-star" style="color: #ffd700;"></i> ${rating}/10</p>
            </div>
        `;
        
        carouselTrack.appendChild(div);
    });
}

// ========== FETCH CONTENT ==========
async function fetchContent(page = 1) {
    try {
        if (page === 1) {
            showSkeletonLoader();
            allItems = [];
        }
        
        const type = currentContentType === 'movies' ? 'movie' : 'tv';
        let url = `${BASE_URL}/${type}/${currentMovieType}?api_key=${API_KEY}&language=en-US&page=${page}`;
        
        if (currentYear !== 'all') {
            url += `&year=${currentYear}`;
        }
        
        if (currentRating !== 'all') {
            url += `&vote_average.gte=${currentRating}`;
        }
        
        url += `&sort_by=${currentSort}`;
        
        const data = await fetchWithCache(url, 60000);
        totalPages = data.total_pages;
        
        let items = data.results;
        
        if (currentCategory !== 'all') {
            items = items.filter(item => 
                item.genre_ids && item.genre_ids.includes(parseInt(currentCategory))
            );
        }
        
        allItems = page === 1 ? items : [...allItems, ...items];
        displayContent(allItems);
        updateLoadMoreButton();
        
    } catch (error) {
        console.error('Error fetching content:', error);
        hideSkeletonLoader();
        showEmptyState('Error loading content. Please try again.');
    }
}

// ========== SEARCH ==========
function handleSearch(e) {
    const searchTerm = e.target.value.trim();
    
    if (searchTerm.length > 0) {
        clearSearchBtn.classList.add('show');
        isSearching = true;
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(searchTerm);
        }, 500);
    } else {
        clearSearch();
    }
}

async function performSearch(query) {
    try {
        showSkeletonLoader();
        
        const type = currentContentType === 'movies' ? 'movie' : 'tv';
        const url = `${BASE_URL}/search/${type}?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1`;
        
        const data = await fetchWithCache(url, 60000);
        
        let items = data.results.slice(0, 20);
        
        if (currentCategory !== 'all') {
            items = items.filter(item => 
                item.genre_ids && item.genre_ids.includes(parseInt(currentCategory))
            );
        }
        
        if (currentRating !== 'all') {
            items = items.filter(item => item.vote_average >= parseFloat(currentRating));
        }
        
        allItems = items;
        displayContent(allItems);
        
        moviesTitle.textContent = `Search: "${query}"`;
        movieCount.textContent = `Found ${data.total_results.toLocaleString()} results`;
        loadMoreBtn.style.display = 'none';
        
    } catch (error) {
        console.error('Error searching:', error);
        hideSkeletonLoader();
        showEmptyState('Search failed. Please try again.');
    }
}

function clearSearch() {
    searchInput.value = '';
    clearSearchBtn.classList.remove('show');
    isSearching = false;
    currentPage = 1;
    allItems = [];
    updateTitle();
    fetchContent();
}

// ========== DISPLAY CONTENT ==========
function displayContent(items) {
    hideSkeletonLoader();
    moviesGrid.innerHTML = '';
    
    if (items.length === 0) {
        showEmptyState();
        movieCount.textContent = '';
        return;
    }
    
    hideEmptyState();
    
    if (!isSearching) {
        movieCount.textContent = `Showing ${items.length.toLocaleString()} ${currentContentType === 'movies' ? 'movies' : 'shows'}`;
    }
    
    items.forEach(item => {
        const card = createContentCard(item);
        moviesGrid.appendChild(card);
    });
}

// ========== CREATE CONTENT CARD ==========
function createContentCard(item) {
    const card = document.createElement('div');
    card.classList.add('movie-card');
    card.setAttribute('tabindex', '0');
    
    const posterPath = item.poster_path 
        ? IMG_URL + item.poster_path 
        : 'https://via.placeholder.com/220x330?text=No+Poster';
    
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date || 'Coming Soon';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const isFavorite = favorites.some(fav => fav.id === item.id && fav.type === currentContentType);
    
    const type = currentContentType === 'movies' ? 'movie' : 'tv';
    
    card.innerHTML = `
        <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                onclick="toggleFavorite(event, ${item.id}, '${type}')"
                aria-label="Add to favorites">
            <i class="fas fa-heart"></i>
        </button>
        <img src="${posterPath}" alt="${title} poster" loading="lazy">
        <div class="movie-info">
            <h3>${title}</h3>
            <div class="movie-meta">
                <p><i class="fas fa-calendar"></i> ${releaseDate}</p>
                <p><i class="fas fa-star" style="color: #ffd700;"></i> ${rating}/10</p>
            </div>
            <p class="cast-info" data-id="${item.id}" data-type="${type}">
                <i class="fas fa-users"></i> Cast loading...
            </p>
            <div class="movie-actions">
                <button class="watch-trailer-btn" onclick="openTrailer(${item.id}, '${type}')">
                    <i class="fas fa-play"></i> Trailer
                </button>
                <button class="view-details-btn" onclick="openDetails(${item.id})">
                    <i class="fas fa-info-circle"></i> Details
                </button>
            </div>
        </div>
    `;
    
    // Lazy load cast on hover
    const castElement = card.querySelector('.cast-info');
    card.addEventListener('mouseenter', async () => {
        if (castElement.textContent.includes('loading')) {
            const cast = await fetchCast(item.id, type);
            if (cast.length > 0) {
                castElement.innerHTML = `<i class="fas fa-users"></i> ${cast.slice(0, 3).join(', ')}`;
            } else {
                castElement.style.display = 'none';
            }
        }
    }, { once: true });
    
    // Keyboard support
    card.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            openDetails(item.id);
        }
    });
    
    return card;
}

// ========== FETCH CAST ==========
async function fetchCast(id, type) {
    try {
        const url = `${BASE_URL}/${type}/${id}/credits?api_key=${API_KEY}`;
        const data = await fetchWithCache(url);
        return data.cast.slice(0, 5).map(actor => actor.name);
    } catch (error) {
        return [];
    }
}

// ========== FAVORITES ==========
function toggleFavorite(event, id, type) {
    event.stopPropagation();
    
    const index = favorites.findIndex(fav => fav.id === id && fav.type === type);
    
    if (index > -1) {
        favorites.splice(index, 1);
        showNotification('Removed from favorites', 'info');
    } else {
        favorites.push({ id, type });
        showNotification('Added to favorites!', 'success');
    }
    
    localStorage.setItem('moviehub_favorites', JSON.stringify(favorites));
    updateFavoritesCount();
    
    // Update all favorite buttons for this item
    document.querySelectorAll(`.favorite-btn`).forEach(btn => {
        const card = btn.closest('.movie-card');
        if (card) {
            const btnId = card.querySelector('[data-id]')?.dataset.id;
            if (btnId == id) {
                if (index > -1) {
                    btn.classList.remove('active');
                } else {
                    btn.classList.add('active');
                }
            }
        }
    });
    
    // Refresh favorites modal if open
    if (favoritesModal.style.display === 'block') {
        showFavorites();
    }
}

function updateFavoritesCount() {
    favoritesCount.textContent = favorites.length;
}

async function showFavorites() {
    favoritesGrid.innerHTML = '';
    
    if (favorites.length === 0) {
        favoritesEmpty.style.display = 'block';
        favoritesGrid.style.display = 'none';
    } else {
        favoritesEmpty.style.display = 'none';
        favoritesGrid.style.display = 'grid';
        
        // Show loading skeleton
        favoritesGrid.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
        
        const loadedFavorites = [];
        
        for (const fav of favorites) {
            try {
                const url = `${BASE_URL}/${fav.type}/${fav.id}?api_key=${API_KEY}&language=en-US`;
                const item = await fetchWithCache(url);
                
                const originalType = currentContentType;
                currentContentType = fav.type === 'movie' ? 'movies' : 'tv';
                const card = createContentCard(item);
                currentContentType = originalType;
                
                loadedFavorites.push(card);
            } catch (error) {
                console.error('Error loading favorite:', error);
            }
        }
        
        favoritesGrid.innerHTML = '';
        loadedFavorites.forEach(card => favoritesGrid.appendChild(card));
    }
    
    favoritesModal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// ========== VIEW MODE TOGGLE ==========
function toggleViewMode() {
    currentViewMode = currentViewMode === 'grid' ? 'list' : 'grid';
    
    if (currentViewMode === 'grid') {
        moviesGrid.classList.remove('list-view');
        moviesGrid.classList.add('grid-view');
        viewIcon.className = 'fas fa-th';
        viewText.textContent = 'Grid';
    } else {
        moviesGrid.classList.remove('grid-view');
        moviesGrid.classList.add('list-view');
        viewIcon.className = 'fas fa-list';
        viewText.textContent = 'List';
    }
}

// ========== FILTERS ==========
function applyFilters() {
    currentYear = yearFilter.value;
    currentRating = ratingFilter.value;
    currentSort = sortFilter.value;
    currentPage = 1;
    
    if (!isSearching) {
        fetchContent();
    } else {
        performSearch(searchInput.value.trim());
    }
}

function resetFilters() {
    yearFilter.value = 'all';
    ratingFilter.value = 'all';
    sortFilter.value = 'popularity.desc';
    currentYear = 'all';
    currentRating = 'all';
    currentSort = 'popularity.desc';
    currentCategory = 'all';
    
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    const allBtn = document.querySelector('.category-btn[data-category="all"]');
    if (allBtn) allBtn.classList.add('active');
    
    currentPage = 1;
    if (!isSearching) {
        fetchContent();
    }
}

// ========== LOAD MORE ==========
function loadMore() {
    currentPage++;
    loadMoreBtn.style.display = 'none';
    loadingMore.style.display = 'flex';
    
    fetchContent(currentPage).then(() => {
        loadingMore.style.display = 'none';
    });
}

function updateLoadMoreButton() {
    if (currentPage < totalPages && currentPage < 5 && !isSearching) {
        loadMoreBtn.style.display = 'block';
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

// ========== OPEN TRAILER ==========
async function openTrailer(id, type) {
    try {
        const url = `${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}&language=en-US`;
        const data = await fetchWithCache(url);
        
        const trailer = data.results.find(
            video => video.type === 'Trailer' && video.site === 'YouTube'
        ) || data.results[0];
        
        if (trailer) {
            document.getElementById('trailer-title').textContent = 'Watch Trailer';
            trailerContainer.innerHTML = `
                <iframe 
                    src="https://www.youtube.com/embed/${trailer.key}?autoplay=1" 
                    allowfullscreen
                    allow="autoplay"
                    title="Movie trailer">
                </iframe>
            `;
            trailerModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        } else {
            showNotification('Trailer not available', 'info');
        }
    } catch (error) {
        console.error('Error fetching trailer:', error);
        showNotification('Could not load trailer', 'error');
    }
}

// ========== OPEN DETAILS ==========
async function openDetails(id) {
    try {
        const type = currentContentType === 'movies' ? 'movie' : 'tv';
        
        // Show loading state
        detailsContainer.innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <div class="spinner"></div>
                <p>Loading details...</p>
            </div>
        `;
        detailsModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Fetch all data in parallel
        const [details, credits, recommendations, providers] = await Promise.all([
            fetchWithCache(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=en-US`),
            fetchWithCache(`${BASE_URL}/${type}/${id}/credits?api_key=${API_KEY}`),
            fetchWithCache(`${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}&language=en-US&page=1`),
            fetchWithCache(`${BASE_URL}/${type}/${id}/watch/providers?api_key=${API_KEY}`)
        ]);
        
        const cast = credits.cast.slice(0, 10).map(actor => actor.name).join(', ');
        
        displayDetails(details, cast, recommendations.results.slice(0, 12), providers.results, type);
        
    } catch (error) {
        console.error('Error loading details:', error);
        closeModal(detailsModal);
        showNotification('Could not load details', 'error');
    }
}

// ========== DISPLAY DETAILS ==========
function displayDetails(item, cast, recommendations, providers, type) {
    const backdropPath = item.backdrop_path 
        ? BACKDROP_URL + item.backdrop_path 
        : 'https://via.placeholder.com/1000x400?text=No+Backdrop';
    
    const title = item.title || item.name;
    const releaseDate = item.release_date || item.first_air_date || 'Coming Soon';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    const runtime = item.runtime ? `${item.runtime} min` : 
                   item.episode_run_time && item.episode_run_time[0] ? `${item.episode_run_time[0]} min/ep` : 'N/A';
    const genres = item.genres.map(g => g.name).join(', ') || 'N/A';
    const overview = item.overview || 'No description available.';
    
    const isFavorite = favorites.some(fav => fav.id === item.id && fav.type === type);
    
    // Watch providers
    let providersHTML = '';
    if (providers && providers.US && providers.US.flatrate) {
        providersHTML = `
            <div class="details-providers">
                <h3><i class="fas fa-play-circle"></i> Where to Watch (US)</h3>
                <div class="providers-list">
                    ${providers.US.flatrate.map(provider => `
                        <img src="${IMG_URL}${provider.logo_path}" 
                             alt="${provider.provider_name}" 
                             class="provider-logo"
                             title="${provider.provider_name}">
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    detailsContainer.innerHTML = `
        <div class="details-wrapper">
            <div class="details-hero" style="background-image: url('${backdropPath}')"></div>
            <div class="details-body">
                <h2 class="details-title">${title}</h2>
                <div class="details-meta">
                    <span><i class="fas fa-calendar"></i> ${releaseDate}</span>
                    <span><i class="fas fa-star" style="color: #ffd700;"></i> ${rating}/10</span>
                    <span><i class="fas fa-clock"></i> ${runtime}</span>
                    <span><i class="fas fa-theater-masks"></i> ${genres}</span>
                </div>
                <div class="details-overview">
                    <h3><i class="fas fa-align-left"></i> Overview</h3>
                    <p>${overview}</p>
                </div>
                <div class="details-cast">
                    <h3><i class="fas fa-users"></i> Top Cast</h3>
                    <p class="cast-list">${cast || 'Cast information not available'}</p>
                </div>
                ${providersHTML}
                <div class="details-actions">
                    <button class="watch-now-btn" onclick="goToWatch(${item.id}, '${type}', '${title}')">
                        <i class="fas fa-play-circle"></i> Watch Now
                    </button>
                    <button class="trailer-btn-details" onclick="closeDetailsAndOpenTrailer(${item.id}, '${type}')">
                        <i class="fas fa-play"></i> Watch Trailer
                    </button>
                    <button class="favorite-btn-details ${isFavorite ? 'active' : ''}" 
                            onclick="toggleFavoriteFromDetails(${item.id}, '${type}')">
                        <i class="fas fa-heart"></i>
                        ${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    displayRecommendations(recommendations, type);
}

// ========== TOGGLE FAVORITE FROM DETAILS ==========
function toggleFavoriteFromDetails(id, type) {
    const event = new Event('click');
    event.stopPropagation = () => {};
    toggleFavorite(event, id, type);
    
    // Update the button
    const btn = document.querySelector('.favorite-btn-details');
    const isFavorite = favorites.some(fav => fav.id === id && fav.type === type);
    
    btn.classList.toggle('active', isFavorite);
    btn.innerHTML = `
        <i class="fas fa-heart"></i>
        ${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
    `;
}

// ========== DISPLAY RECOMMENDATIONS ==========
function displayRecommendations(items, type) {
    recommendationsGrid.innerHTML = '';
    
    if (items.length === 0) {
        recommendationsGrid.innerHTML = `
            <p style="text-align:center; grid-column: 1/-1; color:#888;">
                <i class="fas fa-info-circle"></i> No recommendations available
            </p>
        `;
        return;
    }
    
    items.forEach(item => {
        const posterPath = item.poster_path 
            ? IMG_URL + item.poster_path 
            : 'https://via.placeholder.com/180x270?text=No+Poster';
        
        const title = item.title || item.name;
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        
        const card = document.createElement('div');
        card.classList.add('recommendation-card');
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `View ${title}`);
        
        card.innerHTML = `
            <img src="${posterPath}" alt="${title} poster" loading="lazy">
            <div class="recommendation-info">
                <h4>${title}</h4>
                <p><i class="fas fa-star" style="color: #ffd700;"></i> ${rating}/10</p>
            </div>
        `;
        
        card.onclick = () => {
            detailsModal.style.display = 'none';
            setTimeout(() => openDetails(item.id), 300);
        };
        
        card.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                detailsModal.style.display = 'none';
                setTimeout(() => openDetails(item.id), 300);
            }
        });
        
        recommendationsGrid.appendChild(card);
    });
}

// ========== HELPER FUNCTIONS ==========
function closeDetailsAndOpenTrailer(id, type) {
    detailsModal.style.display = 'none';
    document.body.style.overflow = '';
    setTimeout(() => openTrailer(id, type), 300);
}

function closeModal(modal, container = null) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    if (container) {
        container.innerHTML = '';
    }
}

function showSkeletonLoader() {
    skeletonLoader.style.display = 'grid';
    moviesGrid.innerHTML = '';
    emptyState.style.display = 'none';
}

function hideSkeletonLoader() {
    skeletonLoader.style.display = 'none';
}

function showEmptyState(message = null) {
    emptyState.style.display = 'block';
    const heading = emptyState.querySelector('h3');
    if (message && heading) {
        heading.textContent = message;
    } else if (heading) {
        heading.textContent = 'No results found';
    }
}

function hideEmptyState() {
    emptyState.style.display = 'none';
}

// ========== IMAGE ERROR HANDLING ==========
document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
        e.target.src = 'https://via.placeholder.com/300x450?text=Image+Not+Available';
        e.target.style.opacity = '0.5';
    }
}, true);

// ========== SERVICE WORKER (OPTIONAL PWA) ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(() => {
            console.log('Service Worker registered');
        }).catch(() => {
            console.log('Service Worker registration failed');
        });
    });
}

// ========== GO TO WATCH PAGE ==========
function goToWatch(id, type, title) {
    // Close the details modal first
    closeModal(detailsModal);
    
    // Encode the title for URL parameter
    const encodedTitle = encodeURIComponent(title);
    
    // Redirect to the watch page with TMDB ID, type, and title
    window.location.href = `watch.html?id=${id}&type=${type}&title=${encodedTitle}`;
}

// Force Vercel cache clear: 2025-12-12-11-55-00
