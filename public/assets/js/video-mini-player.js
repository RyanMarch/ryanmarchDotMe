import { globalVideo } from './global-video.js';

// The floating/docked chrome itself (topbar, return/close buttons, stage
// positioning) is built and wired by global-video.js, since it owns the
// permanently-mounted stage element. This just keeps the title text in sync.
export function initializeVideoMiniPlayer() {
    const titleEl = document.querySelector('#global-video-stage .floating-video-title');
    if (!titleEl) return;

    globalVideo.subscribe((state) => {
        if (state.isActive) {
            titleEl.textContent = (state.video && state.video.title) || 'Video';
        }
    });
}
