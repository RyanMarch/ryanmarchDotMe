import { globalVideo } from './global-video.js';

function extractVideoId(src) {
    const match = src.match(/embed\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

function renderPoster(slot, videoId, title) {
    slot.innerHTML = `
        <button type="button" class="video-slot-play" aria-label="Play video: ${title}">
            <img class="video-slot-thumb" src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="" loading="lazy">
            <span class="video-slot-play-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </span>
        </button>
    `;
}

// Replaces raw YouTube iframe embeds within a freshly-rendered project's
// content with click-to-load slots wired into the global video manager,
// so playback can be detected and kept alive across SPA navigation.
export function initializeVideoSlots(container, projectId) {
    if (!container) return;
    const iframes = container.querySelectorAll('iframe[src*="youtube-nocookie.com/embed/"]');

    iframes.forEach((iframe) => {
        const videoId = extractVideoId(iframe.getAttribute('src') || '');
        if (!videoId) return;

        const title = iframe.getAttribute('title') || 'Video';
        const slot = document.createElement('div');
        slot.className = 'video-slot';
        slot.style.cssText = iframe.style.cssText;
        slot.dataset.videoId = videoId;

        iframe.replaceWith(slot);

        const state = globalVideo.getState();
        if (state.video && state.video.id === videoId) {
            globalVideo.dock(slot);
            return;
        }

        renderPoster(slot, videoId, title);
        slot.addEventListener('click', (e) => {
            if (!e.target.closest('.video-slot-play')) return;
            globalVideo.open({ id: videoId, title, projectId: projectId || null }, slot);
        });
    });
}
