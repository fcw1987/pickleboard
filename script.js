// Pickleboard - Interactive Pickleball Court Planner

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker registration failed:', error);
            });
    });
}
class Pickleboard {
    constructor() {
        this.court = document.getElementById('court');
        this.resetBtn = document.getElementById('resetBtn');
        this.clearTracersBtn = document.getElementById('clearTracersBtn');
        this.themeToggle = document.getElementById('themeToggle');
        this.gameModeInputs = document.querySelectorAll('input[name="gameMode"]');
        this.currentGameMode = null;
        this.drawToggle = document.getElementById('drawToggle');
        this.undoBtn = document.getElementById('undoBtn');
        this.clearDrawingsBtn = document.getElementById('clearDrawingsBtn');
        this.drawingLayer = document.getElementById('drawingLayer');
        
        // New UI elements
        this.menuToggle = document.getElementById('menuToggle');
        this.menuOverlay = document.getElementById('menuOverlay');
        this.menuClose = document.getElementById('menuClose');
        this.infoToggle = document.getElementById('infoToggle');
        this.infoModal = document.getElementById('infoModal');
        this.infoClose = document.getElementById('infoClose');
        this.drawControls = document.getElementById('drawControls');
        
        // Court boundaries (SVG coordinates in feet) - expanded to allow movement outside court
        this.courtBounds = {
            left: -8,
            right: 28,
            top: -8,
            bottom: 52
        };
        
        // Default positions for different game modes
        this.positions = {
            singles: {
                player1: { cx: 5, cy: -1 },    // Top player (red) - left service box, behind baseline
                player2: { cx: 15, cy: 45 },   // Bottom player (blue) - right service box, behind baseline
                player3: { cx: 5, cy: 36 },    // Left court, front (hidden in singles)
                player4: { cx: 15, cy: 36 },   // Right court, front (hidden in singles)
                ball: { cx: 16, cy: 45 }       // Ball next to bottom player (behind baseline)
            },
            doubles: {
                player1: { cx: 5, cy: -1 },    // Top team (red) - left service box, behind baseline
                player2: { cx: 15, cy: 14 },   // Top team (red) - slightly behind NVZ line (legal position)
                player3: { cx: 5, cy: 45 },    // Bottom team (blue) - left service box, behind baseline
                player4: { cx: 15, cy: 45 },   // Bottom team (blue) - right service box, behind baseline (server)
                ball: { cx: 16, cy: 45 }       // Ball with server in lower right service box, behind baseline
            }
        };
        
        // Token state
        this.tokens = this.initializeTokens();
        this.dragState = {
            isDragging: false,
            dragElement: null,
            startX: 0,
            startY: 0,
            elementStartX: 0,
            elementStartY: 0
        };
        
        // Tracer system
        this.tracerDots = [];
        this.tracerSettings = {
            fadeTime: 10000, // 10 seconds
            maxTracers: 500, // Prevent memory issues
            minDistance: 0.5 // Minimum distance between tracer dots
        };
        
        // Drawing system
        this.drawingMode = false;
        this.isDrawing = false;
        this.currentPath = null;
        this.drawingPaths = [];
        this.drawingState = {
            startX: 0,
            startY: 0,
            pathData: []
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setDrawingMode(false);
        this.loadTheme();
        this.setGameMode('doubles'); // Start with doubles
    }
    
    initializeTokens() {
        const tokens = {};
        
        // Initialize player tokens with both touch targets and visual elements
        for (let i = 1; i <= 4; i++) {
            const visualElement = document.getElementById(`player${i}`);
            const touchElement = document.getElementById(`player${i}-touch`);
            if (visualElement && touchElement) {
                tokens[`player${i}`] = {
                    id: `player${i}`,
                    type: 'player',
                    element: visualElement,
                    touchElement: touchElement,
                    x: parseFloat(visualElement.getAttribute('cx')),
                    y: parseFloat(visualElement.getAttribute('cy'))
                };
            }
        }
        
        // Initialize ball token with both touch target and visual element
        const ballVisual = document.getElementById('ball');
        const ballTouch = document.getElementById('ball-touch');
        if (ballVisual && ballTouch) {
            tokens.ball = {
                id: 'ball',
                type: 'ball',
                element: ballVisual,
                touchElement: ballTouch,
                x: parseFloat(ballVisual.getAttribute('cx')),
                y: parseFloat(ballVisual.getAttribute('cy'))
            };
        }
        
        // Set initial player colors for doubles mode (default)
        if (tokens.player1) {
            tokens.player1.element.classList.remove('team2-player');
            tokens.player1.element.classList.add('team1-player');
        }
        if (tokens.player2) {
            tokens.player2.element.classList.remove('team2-player');
            tokens.player2.element.classList.add('team1-player');
        }
        if (tokens.player3) {
            tokens.player3.element.classList.remove('team1-player');
            tokens.player3.element.classList.add('team2-player');
        }
        if (tokens.player4) {
            tokens.player4.element.classList.remove('team1-player');
            tokens.player4.element.classList.add('team2-player');
        }
        
        return tokens;
    }
    
    setupEventListeners() {
        // Drag events for tokens
        Object.values(this.tokens).forEach(token => {
            this.setupTokenDragEvents(token);
        });
        
        // Reset button
        this.resetBtn.addEventListener('click', () => this.resetPositions());
        
        // Clear tracers button
        this.clearTracersBtn.addEventListener('click', () => this.clearAllTracers());
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Game mode selection
        this.gameModeInputs.forEach(radio => {
            radio.addEventListener('change', (event) => {
                if (event.target.checked) {
                    this.setGameMode(event.target.value);
                }
            });
        });
        
        // Prevent context menu on tokens
        Object.values(this.tokens).forEach(token => {
            token.element.addEventListener('contextmenu', (e) => e.preventDefault());
        });
        
        // Drawing mode controls
        this.drawToggle.addEventListener('click', () => this.toggleDrawingMode());
        this.undoBtn.addEventListener('click', () => this.undoLastStroke());
        this.clearDrawingsBtn.addEventListener('click', () => this.clearAllDrawings());
        
        // Set up drawing event listeners
        this.setupDrawingEvents();
        
        // New UI event listeners
        this.setupUIEventListeners();
    }
    
    setupTokenDragEvents(token) {
        // Use touch target for better touch interaction, fallback to visual element
        const touchElement = token.touchElement || token.element;
        const visualElement = token.element;
        
        // Mouse events on both touch element and visual element
        touchElement.addEventListener('mousedown', (e) => this.startDrag(e, token));
        visualElement.addEventListener('mousedown', (e) => this.startDrag(e, token));
        
        // Touch events on touch element with pointer capture
        touchElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (touchElement.setPointerCapture && e.touches[0]) {
                // Use pointer capture for smoother touch dragging
                try {
                    touchElement.setPointerCapture(e.touches[0].identifier);
                } catch (err) {
                    // Fallback if pointer capture not supported
                }
            }
            this.startDrag(e, token);
        }, { passive: false });
        
        // Touch events on visual element (for direct touches)
        visualElement.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (visualElement.setPointerCapture && e.touches[0]) {
                // Use pointer capture for smoother touch dragging
                try {
                    visualElement.setPointerCapture(e.touches[0].identifier);
                } catch (err) {
                    // Fallback if pointer capture not supported
                }
            }
            this.startDrag(e, token);
        }, { passive: false });
        
        // Prevent context menu on both elements
        touchElement.addEventListener('contextmenu', (e) => e.preventDefault());
        visualElement.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Global events (attached to document) - only set up once
        if (!this.globalEventsSetup) {
            document.addEventListener('mousemove', (e) => this.drag(e));
            document.addEventListener('mouseup', (e) => this.endDrag(e));
            document.addEventListener('touchmove', (e) => this.drag(e), { passive: false });
            document.addEventListener('touchend', (e) => this.endDrag(e));
            this.globalEventsSetup = true;
        }
    }
    
    startDrag(event, token) {
        // Don't start dragging in drawing mode
        if (this.drawingMode) return;
        
        event.preventDefault();
        
        this.dragState.isDragging = true;
        this.dragState.dragElement = token;
        
        // Get the correct coordinates based on event type
        const coords = this.getEventCoords(event);
        const svgCoords = this.screenToSVG(coords.x, coords.y);
        
        this.dragState.startX = svgCoords.x;
        this.dragState.startY = svgCoords.y;
        this.dragState.elementStartX = token.x;
        this.dragState.elementStartY = token.y;
        
        // Add visual feedback
        token.element.classList.add('dragging');
        
        // Prevent text selection during drag
        document.body.style.userSelect = 'none';
    }
    
    drag(event) {
        if (!this.dragState.isDragging || !this.dragState.dragElement) return;
        
        event.preventDefault();
        
        const coords = this.getEventCoords(event);
        const svgCoords = this.screenToSVG(coords.x, coords.y);
        
        // Calculate new position
        const deltaX = svgCoords.x - this.dragState.startX;
        const deltaY = svgCoords.y - this.dragState.startY;
        
        let newX = this.dragState.elementStartX + deltaX;
        let newY = this.dragState.elementStartY + deltaY;
        
        // Constrain to court boundaries
        const token = this.dragState.dragElement;
        const radius = token.type === 'ball' ? 0.5 : 0.8;
        
        newX = Math.max(this.courtBounds.left + radius, Math.min(this.courtBounds.right - radius, newX));
        newY = Math.max(this.courtBounds.top + radius, Math.min(this.courtBounds.bottom - radius, newY));
        
        // Update position
        this.updateTokenPosition(token, newX, newY);
    }
    
    endDrag(event) {
        if (!this.dragState.isDragging) return;
        
        // Remove visual feedback
        if (this.dragState.dragElement) {
            this.dragState.dragElement.element.classList.remove('dragging');
        }
        
        // Reset drag state
        this.dragState.isDragging = false;
        this.dragState.dragElement = null;
        
        // Restore text selection
        document.body.style.userSelect = '';
    }
    
    getEventCoords(event) {
        if (event.touches && event.touches[0]) {
            return { x: event.touches[0].clientX, y: event.touches[0].clientY };
        } else {
            return { x: event.clientX, y: event.clientY };
        }
    }
    
    screenToSVG(screenX, screenY) {
        const svg = this.court;
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        
        // Convert screen coordinates to SVG coordinates
        const x = ((screenX - rect.left) / rect.width) * viewBox.width + viewBox.x;
        const y = ((screenY - rect.top) / rect.height) * viewBox.height + viewBox.y;
        
        return { x, y };
    }
    
    updateTokenPosition(token, x, y) {
        // Check if this is a significant movement to create tracer dot
        if (this.shouldCreateTracer(token, x, y)) {
            this.createTracerDot(token, token.x, token.y);
        }
        
        token.x = x;
        token.y = y;
        token.element.setAttribute('cx', x);
        token.element.setAttribute('cy', y);
        
        // Also update touch target position if it exists
        if (token.touchElement) {
            token.touchElement.setAttribute('cx', x);
            token.touchElement.setAttribute('cy', y);
        }
    }
    
    setGameMode(mode) {
        if (!Object.hasOwn(this.positions, mode)) {
            console.warn(`Unsupported game mode: ${mode}`);
            return false;
        }

        this.currentGameMode = mode;
        this.gameModeInputs.forEach(radio => {
            radio.checked = radio.value === mode;
        });

        const positions = this.positions[mode];
        const isDoubles = mode === 'doubles';
        
        // Update positions for all tokens
        Object.keys(positions).forEach(tokenId => {
            if (this.tokens[tokenId]) {
                const pos = positions[tokenId];
                this.updateTokenPosition(this.tokens[tokenId], pos.cx, pos.cy);
            }
        });
        
        // Update player colors based on game mode
        this.updatePlayerColors(mode);
        
        // Show/hide players based on game mode
        if (this.tokens.player3 && this.tokens.player4) {
            this.tokens.player3.element.style.display = isDoubles ? 'block' : 'none';
            this.tokens.player4.element.style.display = isDoubles ? 'block' : 'none';
            
            // Also show/hide touch targets
            if (this.tokens.player3.touchElement) {
                this.tokens.player3.touchElement.style.display = isDoubles ? 'block' : 'none';
            }
            if (this.tokens.player4.touchElement) {
                this.tokens.player4.touchElement.style.display = isDoubles ? 'block' : 'none';
            }
        }
        
        console.log(`Game mode set to: ${mode}`);
        return true;
    }
    
    updatePlayerColors(mode) {
        // In doubles mode: 
        // - players 1 & 2 (back court) are team1 (red)
        // - players 3 & 4 (front court) are team2 (blue)
        //
        // In singles mode:
        // - player 1 (back court) is team1 (red) - opposing players
        // - player 2 (front court) is team2 (blue) - should be different color
        // - players 3 & 4 are hidden
        
        if (mode === 'doubles') {
            if (this.tokens.player1) {
                this.tokens.player1.element.classList.remove('team2-player');
                this.tokens.player1.element.classList.add('team1-player');
            }
            if (this.tokens.player2) {
                this.tokens.player2.element.classList.remove('team2-player');
                this.tokens.player2.element.classList.add('team1-player');
            }
            if (this.tokens.player3) {
                this.tokens.player3.element.classList.remove('team1-player');
                this.tokens.player3.element.classList.add('team2-player');
            }
            if (this.tokens.player4) {
                this.tokens.player4.element.classList.remove('team1-player');
                this.tokens.player4.element.classList.add('team2-player');
            }
        } else {
            // Singles mode - players are opponents (different teams)
            if (this.tokens.player1) {
                this.tokens.player1.element.classList.remove('team2-player');
                this.tokens.player1.element.classList.add('team1-player');
            }
            if (this.tokens.player2) {
                this.tokens.player2.element.classList.remove('team1-player');
                this.tokens.player2.element.classList.add('team2-player');
            }
        }
    }
    
    resetPositions() {
        this.setGameMode(this.currentGameMode);
        console.log('Positions reset');
    }
    
    toggleTheme() {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        
        // Update theme toggle button
        this.themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        
        // Save theme preference
        localStorage.setItem('pickleboard-theme', newTheme);
        
        console.log(`Theme switched to: ${newTheme}`);
    }
    
    loadTheme() {
        const savedTheme = localStorage.getItem('pickleboard-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        
        document.body.setAttribute('data-theme', theme);
        this.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        
        console.log(`Theme loaded: ${theme}`);
    }
    
    // Public API for external interaction
    getTokenPositions() {
        const positions = {};
        Object.entries(this.tokens).forEach(([id, token]) => {
            positions[id] = { x: token.x, y: token.y };
        });
        return positions;
    }
    
    setTokenPosition(tokenId, x, y) {
        if (this.tokens[tokenId]) {
            // Constrain to court boundaries
            const token = this.tokens[tokenId];
            const radius = token.type === 'ball' ? 0.5 : 0.8;
            
            x = Math.max(this.courtBounds.left + radius, Math.min(this.courtBounds.right - radius, x));
            y = Math.max(this.courtBounds.top + radius, Math.min(this.courtBounds.bottom - radius, y));
            
            this.updateTokenPosition(token, x, y);
        }
    }
    
    // Tracer system methods
    shouldCreateTracer(token, newX, newY) {
        // Don't create tracers during initialization or reset
        if (!this.dragState.isDragging) {
            console.log('No tracer: not dragging');
            return false;
        }
        
        // Calculate distance moved
        const dx = newX - token.x;
        const dy = newY - token.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        console.log(`Distance moved: ${distance}, min required: ${this.tracerSettings.minDistance}`);
        return distance >= this.tracerSettings.minDistance;
    }
    
    createTracerDot(token, x, y) {
        console.log('Creating tracer dot at:', x, y, 'for token:', token.type);
        
        // Limit number of tracer dots for performance
        if (this.tracerDots.length >= this.tracerSettings.maxTracers) {
            // Remove oldest tracer dots
            const toRemove = this.tracerDots.splice(0, 50);
            toRemove.forEach(tracer => {
                if (tracer.element && tracer.element.parentNode) {
                    tracer.element.parentNode.removeChild(tracer.element);
                }
                if (tracer.timeout) {
                    clearTimeout(tracer.timeout);
                }
            });
        }
        
        // Create SVG circle element for the tracer dot
        const tracerElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        tracerElement.setAttribute('cx', x);
        tracerElement.setAttribute('cy', y);
        tracerElement.classList.add('tracer-dot');
        
        // Set size based on token type - MUST set radius as attribute, not CSS
        if (token.type === 'ball') {
            tracerElement.setAttribute('r', '0.2'); // Set radius as attribute
            tracerElement.classList.add('ball');
            tracerElement.classList.add('ball-token');
        } else {
            tracerElement.setAttribute('r', '0.3'); // Set radius as attribute
            tracerElement.classList.add('player');
            // Copy the player team colors
            if (token.element.classList.contains('team1-player')) {
                tracerElement.classList.add('team1-player');
            } else if (token.element.classList.contains('team2-player')) {
                tracerElement.classList.add('team2-player');
            }
        }
        
        console.log('Tracer element classes:', tracerElement.classList.toString());
        
        // Add to SVG (insert before the touch targets so tracers appear behind interactive elements)
        const touchTarget = this.court.querySelector('.touch-target');
        if (touchTarget) {
            this.court.insertBefore(tracerElement, touchTarget);
        } else {
            this.court.appendChild(tracerElement);
        }
        
        console.log('Tracer element added to DOM');
        
        // Create tracer object
        const tracer = {
            element: tracerElement,
            createdTime: Date.now(),
            timeout: null
        };
        
        // Set up automatic removal
        tracer.timeout = setTimeout(() => {
            this.removeTracerDot(tracer);
        }, this.tracerSettings.fadeTime);
        
        // Add to tracking array
        this.tracerDots.push(tracer);
    }
    
    removeTracerDot(tracer) {
        // Remove from DOM
        if (tracer.element && tracer.element.parentNode) {
            tracer.element.parentNode.removeChild(tracer.element);
        }
        
        // Clear timeout
        if (tracer.timeout) {
            clearTimeout(tracer.timeout);
        }
        
        // Remove from tracking array
        const index = this.tracerDots.indexOf(tracer);
        if (index > -1) {
            this.tracerDots.splice(index, 1);
        }
    }
    
    clearAllTracers() {
        // Remove all tracer dots
        this.tracerDots.forEach(tracer => {
            if (tracer.element && tracer.element.parentNode) {
                tracer.element.parentNode.removeChild(tracer.element);
            }
            if (tracer.timeout) {
                clearTimeout(tracer.timeout);
            }
        });
        
        // Clear the array
        this.tracerDots = [];
        
        console.log('All tracer dots cleared');
    }
    
    // Drawing mode methods
    setupDrawingEvents() {
        // Mouse events for drawing
        this.court.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.court.addEventListener('mousemove', (e) => this.draw(e));
        this.court.addEventListener('mouseup', (e) => this.endDrawing(e));
        this.court.addEventListener('mouseleave', (e) => this.endDrawing(e));
        
        // Touch events for drawing
        this.court.addEventListener('touchstart', (e) => {
            if (this.drawingMode) {
                e.preventDefault();
                this.startDrawing(e);
            }
        }, { passive: false });
        
        this.court.addEventListener('touchmove', (e) => {
            if (this.drawingMode) {
                e.preventDefault();
                this.draw(e);
            }
        }, { passive: false });
        
        this.court.addEventListener('touchend', (e) => {
            if (this.drawingMode) {
                e.preventDefault();
                this.endDrawing(e);
            }
        }, { passive: false });
    }
    
    setDrawingMode(enabled) {
        this.drawingMode = Boolean(enabled);
        this.drawToggle.classList.toggle('active', this.drawingMode);
        this.drawToggle.setAttribute('aria-pressed', String(this.drawingMode));
        this.court.classList.toggle('drawing-mode', this.drawingMode);
        this.drawControls.hidden = !this.drawingMode;

        if (!this.drawingMode && this.isDrawing) {
            this.endDrawing();
        }
    }

    toggleDrawingMode() {
        this.setDrawingMode(!this.drawingMode);
    }
    
    startDrawing(event) {
        if (!this.drawingMode) return;
        
        event.preventDefault();
        this.isDrawing = true;
        
        const coords = this.getEventCoords(event);
        const svgCoords = this.screenToSVG(coords.x, coords.y);
        
        // Create new path element
        this.currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.currentPath.classList.add('drawing-stroke');
        
        // Start path data
        this.drawingState.pathData = [`M ${svgCoords.x} ${svgCoords.y}`];
        this.currentPath.setAttribute('d', this.drawingState.pathData.join(' '));
        
        // Add to drawing layer
        this.drawingLayer.appendChild(this.currentPath);
    }
    
    draw(event) {
        if (!this.isDrawing || !this.drawingMode || !this.currentPath) return;
        
        event.preventDefault();
        
        const coords = this.getEventCoords(event);
        const svgCoords = this.screenToSVG(coords.x, coords.y);
        
        // Add line to current point
        this.drawingState.pathData.push(`L ${svgCoords.x} ${svgCoords.y}`);
        this.currentPath.setAttribute('d', this.drawingState.pathData.join(' '));
    }
    
    endDrawing(event) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        
        // Save the completed path
        if (this.currentPath && this.drawingState.pathData.length > 1) {
            this.drawingPaths.push(this.currentPath);
        } else if (this.currentPath) {
            // Remove if it's just a point
            this.currentPath.remove();
        }
        
        this.currentPath = null;
        this.drawingState.pathData = [];
    }
    
    undoLastStroke() {
        if (this.drawingPaths.length > 0) {
            const lastPath = this.drawingPaths.pop();
            lastPath.remove();
            console.log('Undid last drawing stroke');
        }
    }
    
    clearAllDrawings() {
        // Remove all drawing paths
        this.drawingPaths.forEach(path => path.remove());
        this.drawingPaths = [];
        
        // Also clear the drawing layer
        while (this.drawingLayer.firstChild) {
            this.drawingLayer.removeChild(this.drawingLayer.firstChild);
        }
        
        console.log('All drawings cleared');
    }
    
    // New UI methods
    setupUIEventListeners() {
        // Menu toggle
        this.menuToggle.addEventListener('click', () => this.toggleMenu());
        this.menuClose.addEventListener('click', () => this.closeMenu());
        
        // Info modal
        this.infoToggle.addEventListener('click', () => this.openInfoModal());
        this.infoClose.addEventListener('click', () => this.closeInfoModal());
        
        // Close overlays on backdrop click
        this.menuOverlay.addEventListener('click', (e) => {
            if (e.target === this.menuOverlay) {
                this.closeMenu();
            }
        });
        
        this.infoModal.addEventListener('click', (e) => {
            if (e.target === this.infoModal) {
                this.closeInfoModal();
            }
        });
        
        // Close with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeMenu();
                this.closeInfoModal();
            }
        });
        
    }
    
    toggleMenu() {
        const isActive = this.menuOverlay.classList.contains('active');
        if (isActive) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }
    
    openMenu() {
        this.menuOverlay.classList.add('active');
        this.menuToggle.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    closeMenu() {
        this.menuOverlay.classList.remove('active');
        this.menuToggle.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    openInfoModal() {
        this.infoModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    closeInfoModal() {
        this.infoModal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance
    window.pickleboard = new Pickleboard();
    
    console.log('Pickleboard initialized successfully');
});

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
    if (window.pickleboard) {
        window.pickleboard.resetPositions();
    }
});

// Handle page visibility changes (pause/resume)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden - could pause animations if any
        console.log('Page hidden');
    } else {
        // Page is visible - could resume animations if any
        console.log('Page visible');
    }
});
