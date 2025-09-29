// MCP Memory Service - Interactive Web Application
// Handles Clerk authentication and memory management

(function() {
    'use strict';

    // Application state
    let clerk = null;
    let currentUser = null;
    let memories = [];
    let searchTimeout = null;

    // DOM elements
    const elements = {
        authButton: document.getElementById('auth-button'),
        welcomeAuthButton: document.getElementById('welcome-auth-button'),
        signOutButton: document.getElementById('sign-out-button'),
        userInfo: document.getElementById('user-info'),
        userEmail: document.getElementById('user-email'),
        userAvatar: document.getElementById('user-avatar'),
        welcomeSection: document.getElementById('welcome-section'),
        memorySection: document.getElementById('memory-section'),
        searchInput: document.getElementById('search-input'),
        memoriesGrid: document.getElementById('memories-grid'),
        emptyState: document.getElementById('empty-state'),
        loadingSpinner: document.getElementById('loading-spinner'),
        errorMessage: document.getElementById('error-message'),
        successMessage: document.getElementById('success-message'),
        totalMemories: document.getElementById('total-memories'),
        recentMemories: document.getElementById('recent-memories'),
        highImportance: document.getElementById('high-importance')
    };

    // Initialize Clerk
    async function initializeClerk() {
        try {
            // First, try to get the publishable key from the API
            let publishableKey = null;

            try {
                const configResponse = await fetch('/api/config');
                if (configResponse.ok) {
                    const config = await configResponse.json();
                    publishableKey = config.clerkPublishableKey;
                }
            } catch (error) {
                console.log('Could not fetch config from API, using default key');
            }

            // Fallback to a default key if API doesn't provide one
            // This is the test key from the example - replace with your production key
            if (!publishableKey) {
                publishableKey = 'pk_test_bGl2aW5nLXBhbmdvbGluLTUxLmNsZXJrLmFjY291bnRzLmRldiQ';
            }

            // Initialize Clerk with the publishable key
            clerk = window.Clerk;
            await clerk.load({
                publishableKey: publishableKey
            });

            // Set up authentication state change listener
            clerk.addListener((resources) => {
                handleAuthStateChange(resources);
            });

            // Check initial auth state
            const user = clerk.user;
            if (user) {
                currentUser = user;
                showAuthenticatedUI();
            } else {
                showUnauthenticatedUI();
            }

        } catch (error) {
            console.error('Failed to initialize Clerk:', error);
            showError('Failed to initialize authentication. Please refresh the page.');
        }
    }

    // Handle authentication state changes
    function handleAuthStateChange(resources) {
        const user = resources.user;

        if (user && !currentUser) {
            // User just signed in
            currentUser = user;
            showAuthenticatedUI();
        } else if (!user && currentUser) {
            // User just signed out
            currentUser = null;
            showUnauthenticatedUI();
        } else if (user && currentUser && user.id !== currentUser.id) {
            // Different user signed in
            currentUser = user;
            showAuthenticatedUI();
        }
    }

    // Show UI for authenticated users
    async function showAuthenticatedUI() {
        // Update UI elements
        elements.authButton.classList.add('hidden');
        elements.welcomeAuthButton.classList.add('hidden');
        elements.signOutButton.classList.remove('hidden');
        elements.userInfo.classList.remove('hidden');
        elements.welcomeSection.classList.add('hidden');
        elements.memorySection.classList.remove('hidden');

        // Update user info
        const email = currentUser.primaryEmailAddress?.emailAddress || 'User';
        elements.userEmail.textContent = email;

        if (currentUser.imageUrl) {
            elements.userAvatar.src = currentUser.imageUrl;
            elements.userAvatar.style.display = 'block';
        } else {
            elements.userAvatar.style.display = 'none';
        }

        // Load memories
        await loadMemories();
    }

    // Show UI for unauthenticated users
    function showUnauthenticatedUI() {
        elements.authButton.classList.remove('hidden');
        elements.welcomeAuthButton.classList.remove('hidden');
        elements.signOutButton.classList.add('hidden');
        elements.userInfo.classList.add('hidden');
        elements.welcomeSection.classList.remove('hidden');
        elements.memorySection.classList.add('hidden');

        // Clear memories
        memories = [];
        elements.memoriesGrid.innerHTML = '';
    }

    // Sign in with Google
    async function signIn() {
        try {
            await clerk.openSignIn({
                redirectUrl: window.location.href
            });
        } catch (error) {
            console.error('Sign in failed:', error);
            showError('Failed to open sign in. Please try again.');
        }
    }

    // Sign out
    async function signOut() {
        try {
            await clerk.signOut();
            showUnauthenticatedUI();
        } catch (error) {
            console.error('Sign out failed:', error);
            showError('Failed to sign out. Please try again.');
        }
    }

    // Load memories from API
    async function loadMemories(query = '') {
        if (!clerk.session) {
            console.error('No active session');
            return;
        }

        showLoading(true);
        hideError();

        try {
            // Get the session token
            const token = await clerk.session.getToken();

            // Build the API URL with query parameter if provided
            let apiUrl = '/api/memories/search';
            if (query) {
                apiUrl += `?query=${encodeURIComponent(query)}`;
            }

            // Fetch memories
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch memories: ${response.statusText}`);
            }

            const data = await response.json();
            memories = data.memories || [];

            // Update statistics
            updateStatistics();

            // Display memories
            displayMemories();

        } catch (error) {
            console.error('Failed to load memories:', error);
            showError('Failed to load memories. Please try again.');
        } finally {
            showLoading(false);
        }
    }

    // Update statistics
    function updateStatistics() {
        // Total memories
        elements.totalMemories.textContent = memories.length;

        // Recent memories (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentCount = memories.filter(m => {
            const memoryDate = new Date(m.createdAt);
            return memoryDate >= sevenDaysAgo;
        }).length;
        elements.recentMemories.textContent = recentCount;

        // High importance memories
        const highImportanceCount = memories.filter(m =>
            m.importance === 'HIGH' || m.importance === 'CRITICAL'
        ).length;
        elements.highImportance.textContent = highImportanceCount;
    }

    // Display memories in the grid
    function displayMemories() {
        elements.memoriesGrid.innerHTML = '';

        if (memories.length === 0) {
            elements.emptyState.classList.remove('hidden');
            elements.memoriesGrid.classList.add('hidden');
            return;
        }

        elements.emptyState.classList.add('hidden');
        elements.memoriesGrid.classList.remove('hidden');

        memories.forEach(memory => {
            const card = createMemoryCard(memory);
            elements.memoriesGrid.appendChild(card);
        });
    }

    // Create a memory card element
    function createMemoryCard(memory) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.dataset.memoryId = memory.id;

        // Generate importance stars
        const importanceStars = getImportanceStars(memory.importance);

        // Format date
        const date = new Date(memory.createdAt);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Format time
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Build tags HTML
        let tagsHTML = '';
        if (memory.tags && memory.tags.length > 0) {
            const tags = typeof memory.tags === 'string'
                ? memory.tags.split(',').map(t => t.trim())
                : memory.tags;
            tagsHTML = `
                <div class="memory-tags">
                    ${tags.map(tag => `<span class="memory-tag">${tag}</span>`).join('')}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="memory-header">
                <span class="memory-type">${memory.type || 'MEMORY'}</span>
                <div class="memory-importance">
                    ${importanceStars}
                </div>
            </div>
            <div class="memory-content">
                ${escapeHtml(memory.content)}
            </div>
            ${tagsHTML}
            <div class="memory-footer">
                <span>${formattedDate}</span>
                <span>${formattedTime}</span>
            </div>
        `;

        return card;
    }

    // Get importance stars HTML
    function getImportanceStars(importance) {
        const levels = {
            'LOW': 1,
            'MEDIUM': 2,
            'HIGH': 3,
            'CRITICAL': 4
        };

        const starCount = levels[importance] || 1;
        let stars = '';

        for (let i = 0; i < starCount; i++) {
            stars += '<span class="importance-star">⭐</span>';
        }

        return stars;
    }

    // Escape HTML to prevent XSS
    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Handle search input
    function handleSearch() {
        const query = elements.searchInput.value.trim();

        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Debounce search - wait 500ms after user stops typing
        searchTimeout = setTimeout(() => {
            loadMemories(query);
        }, 500);
    }

    // Show loading spinner
    function showLoading(show) {
        elements.loadingSpinner.style.display = show ? 'block' : 'none';
    }

    // Show error message
    function showError(message) {
        elements.errorMessage.textContent = message;
        elements.errorMessage.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideError();
        }, 5000);
    }

    // Hide error message
    function hideError() {
        elements.errorMessage.style.display = 'none';
    }

    // Show success message
    function showSuccess(message) {
        elements.successMessage.textContent = message;
        elements.successMessage.style.display = 'block';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            elements.successMessage.style.display = 'none';
        }, 3000);
    }

    // Set up event listeners
    function setupEventListeners() {
        // Authentication buttons
        elements.authButton.addEventListener('click', signIn);
        elements.welcomeAuthButton.addEventListener('click', signIn);
        elements.signOutButton.addEventListener('click', signOut);

        // Search input
        elements.searchInput.addEventListener('input', handleSearch);

        // Enter key on search
        elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });

        // Click on memory cards (future feature - could open detail view)
        elements.memoriesGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.memory-card');
            if (card) {
                const memoryId = card.dataset.memoryId;
                console.log('Memory clicked:', memoryId);
                // Future: Open memory detail view or edit modal
            }
        });
    }

    // Initialize the application when DOM is ready
    function initialize() {
        // Check if Clerk is loaded
        if (typeof window.Clerk === 'undefined') {
            console.error('Clerk library not loaded. Please check your internet connection.');
            showError('Authentication library failed to load. Please refresh the page.');
            return;
        }

        // Set up event listeners
        setupEventListeners();

        // Initialize Clerk authentication
        initializeClerk();

        // Check API health
        fetch('/api/health')
            .then(response => response.json())
            .then(data => {
                console.log('API health check:', data);
            })
            .catch(error => {
                console.error('API health check failed:', error);
            });
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOM is already loaded
        initialize();
    }

})();