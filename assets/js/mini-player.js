import { globalAudio } from './global-audio.js';

export function initializeMiniPlayer() {
    const headerContainer = document.querySelector('.slim-header-container');
    if (!headerContainer) return;

    // Check if mini player already exists
    let miniPlayer = document.getElementById('header-mini-player');
    if (!miniPlayer) {
        miniPlayer = document.createElement('div');
        miniPlayer.id = 'header-mini-player';
        miniPlayer.className = 'header-mini-player';
        miniPlayer.setAttribute('aria-label', 'Audio Mini Player');

        miniPlayer.innerHTML = `
            <button class="mini-player-btn mini-player-toggle" aria-label="Play/Pause" type="button">
                <svg class="mini-icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                <svg class="mini-icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <div class="mini-player-track-info" tabindex="0" role="button" aria-label="Open track options">
                <div class="mini-player-indicator" aria-hidden="true">
                    <span></span><span></span><span></span>
                </div>
                <span class="mini-player-title"></span>
            </div>
            <button class="mini-player-btn mini-player-close" aria-label="Stop audio and close player" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            <!-- Quick Action Popover Modal -->
            <div class="mini-player-menu" id="mini-player-menu" style="display:none;" role="dialog" aria-label="Track options">
                <div class="mini-menu-header">
                    <span class="mini-menu-title"></span>
                    <span class="mini-menu-subtitle"></span>
                </div>
                <div class="mini-menu-actions">
                    <button type="button" class="mini-menu-btn mini-menu-link">
                        <svg class="mini-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                        <span>Return to Project</span>
                    </button>
                    <button type="button" class="mini-menu-btn mini-menu-dismiss">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        <span>Close Player</span>
                    </button>
                </div>
            </div>
        `;

        // Insert between the brand logo and theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            headerContainer.insertBefore(miniPlayer, themeToggle);
        } else {
            headerContainer.appendChild(miniPlayer);
        }
    }

    const toggleBtn = miniPlayer.querySelector('.mini-player-toggle');
    const iconPlay = miniPlayer.querySelector('.mini-icon-play');
    const iconPause = miniPlayer.querySelector('.mini-icon-pause');
    const trackInfo = miniPlayer.querySelector('.mini-player-track-info');
    const titleEl = miniPlayer.querySelector('.mini-player-title');
    const closeBtn = miniPlayer.querySelector('.mini-player-close');
    const menu = miniPlayer.querySelector('.mini-player-menu');
    const menuTitle = miniPlayer.querySelector('.mini-menu-title');
    const menuSubtitle = miniPlayer.querySelector('.mini-menu-subtitle');
    const menuLinkBtn = miniPlayer.querySelector('.mini-menu-link');
    const menuDismissBtn = miniPlayer.querySelector('.mini-menu-dismiss');

    function closeMenu() {
        if (menu && menu.style.display !== 'none') {
            menu.style.display = 'none';
            miniPlayer.classList.remove('menu-open');
        }
    }

    function openMenu() {
        if (menu) {
            menu.style.display = 'flex';
            miniPlayer.classList.add('menu-open');
        }
    }

    function toggleMenu(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        if (menu.style.display === 'flex') {
            closeMenu();
        } else {
            openMenu();
        }
    }

    // Toggle Play/Pause
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        globalAudio.togglePlay();
    });

    // Track click -> open popover menu
    trackInfo.addEventListener('click', toggleMenu);
    trackInfo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleMenu(e);
        }
    });

    // Close button -> stop playback completely
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        globalAudio.stop();
    });

    // Menu Actions
    menuLinkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        const state = globalAudio.getState();
        if (state.track && state.track.projectId) {
            const onSourcePage = state.currentRouteProjectId === state.track.projectId;
            if (onSourcePage) {
                // Smoothly scroll to the in-page custom audio player
                const playerEl = document.querySelector('.custom-audio-player');
                if (playerEl) {
                    playerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            } else {
                // Trigger SPA navigation to project
                window.dispatchEvent(new CustomEvent('spa-navigate-to-project', {
                    detail: { projectId: state.track.projectId }
                }));
            }
        }
    });

    menuDismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        globalAudio.stop();
    });

    // Close menu when clicking outside
    document.addEventListener('pointerdown', (e) => {
        if (menu && menu.style.display === 'flex' && !miniPlayer.contains(e.target)) {
            closeMenu();
        }
    });

    // Close menu on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu && menu.style.display === 'flex') {
            closeMenu();
        }
    });

    let lastTrackId = null;
    let lastIsPlaying = null;
    let lastRoute = null;

    // Subscribe to Global Audio updates
    globalAudio.subscribe((state, event) => {
        // Skip purely time-based updates to eliminate unnecessary DOM churn
        if (event === 'timeupdate') return;

        const shouldShow = state.shouldShowMiniPlayer;
        const isPlaying = !state.isPaused && Boolean(state.track);

        if (shouldShow) {
            miniPlayer.classList.add('active');
            document.body.classList.add('has-mini-player');

            const trackId = state.track ? state.track.id : null;
            const trackChanged = trackId !== lastTrackId;
            if (trackChanged) {
                lastTrackId = trackId;
                if (titleEl) titleEl.textContent = state.track.title || 'Audio Track';
                if (menuTitle) menuTitle.textContent = state.track.title || 'Audio Track';
                if (menuSubtitle) menuSubtitle.textContent = state.track.subtitle || (state.track.projectId ? `Project: ${state.track.projectId}` : '');
            }

            // Update "Return to Project" / "Scroll to Player" button icon and label
            const onSourcePage = state.currentRouteProjectId === (state.track && state.track.projectId);
            if (state.currentRouteProjectId !== lastRoute || trackChanged) {
                lastRoute = state.currentRouteProjectId;
                if (menuLinkBtn) {
                    const linkSpan = menuLinkBtn.querySelector('span');
                    const linkIcon = menuLinkBtn.querySelector('.mini-menu-icon');
                    if (onSourcePage) {
                        if (linkSpan) linkSpan.textContent = 'Scroll to Player';
                        if (linkIcon) {
                            linkIcon.innerHTML = '<path d="M12 5v14M19 12l-7 7-7-7"/>';
                        }
                    } else {
                        if (linkSpan) linkSpan.textContent = 'Return to Project';
                        if (linkIcon) {
                            linkIcon.innerHTML = '<path d="M19 12H5M12 19l-7-7 7-7"/>';
                        }
                    }
                }
            }

            if (isPlaying !== lastIsPlaying) {
                lastIsPlaying = isPlaying;
                if (isPlaying) {
                    if (iconPlay) iconPlay.style.display = 'none';
                    if (iconPause) iconPause.style.display = 'block';
                    miniPlayer.classList.add('playing');
                    toggleBtn.setAttribute('aria-label', 'Pause audio');
                } else {
                    if (iconPlay) iconPlay.style.display = 'block';
                    if (iconPause) iconPause.style.display = 'none';
                    miniPlayer.classList.remove('playing');
                    toggleBtn.setAttribute('aria-label', 'Play audio');
                }
            }
        } else {
            miniPlayer.classList.remove('active');
            miniPlayer.classList.remove('playing');
            document.body.classList.remove('has-mini-player');
            closeMenu();
            lastTrackId = null;
            lastIsPlaying = null;
            lastRoute = null;
        }
    });
}
