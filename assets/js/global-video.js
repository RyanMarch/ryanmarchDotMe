// Global Video Manager for persistent playback across SPA navigation.
//
// Cross-origin (YouTube) iframes reload when moved to a different DOM
// parent — even via appendChild, not just innerHTML — so unlike the
// audio manager's detached <audio> element, this can't rely on
// reparenting. Instead one iframe is created once and never moved: it
// lives inside a permanently-mounted, position:fixed "stage" element.
// "Docking" it into a project's in-page slot means continuously
// resizing/repositioning the fixed stage to sit exactly over that
// slot's bounding rect (tracked every frame so it follows scroll);
// "floating" it means snapping the stage to a fixed corner position.
// Either way the iframe itself never detaches, so playback never resets.

import { globalAudio } from './global-audio.js';

const TRANSITION_MS = 320;

class GlobalVideoManager {
    constructor() {
        this.currentVideo = null; // { id, title, projectId }
        this.iframe = null;
        this.mode = null; // 'docked' | 'floating' | null
        this.trackedSlot = null;
        this.rafId = null;
        this.listeners = new Set();

        this.stage = document.createElement('div');
        this.stage.id = 'global-video-stage';
        this.stage.setAttribute('aria-label', 'Video player');

        this.topbar = document.createElement('div');
        this.topbar.className = 'floating-video-topbar';
        this.topbar.innerHTML = `
            <span class="floating-video-title"></span>
            <div class="floating-video-actions">
                <button type="button" class="floating-video-btn floating-video-return" aria-label="Return to project" title="Return to Project">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <button type="button" class="floating-video-btn floating-video-close" aria-label="Close video" title="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `;

        this.iframeWrap = document.createElement('div');
        this.iframeWrap.className = 'global-video-iframe-wrap';

        this.stage.appendChild(this.topbar);
        this.stage.appendChild(this.iframeWrap);
        document.body.appendChild(this.stage);

        this.topbar.querySelector('.floating-video-return').addEventListener('click', () => {
            if (this.currentVideo && this.currentVideo.projectId) {
                window.dispatchEvent(new CustomEvent('spa-navigate-to-project', {
                    detail: { projectId: this.currentVideo.projectId }
                }));
            }
        });

        this.topbar.querySelector('.floating-video-close').addEventListener('click', () => {
            this.close();
        });

        // Mutual exclusivity: starting audio playback fully stops any active video.
        globalAudio.subscribe((state, event) => {
            if (event === 'play') this.close();
        });
    }

    subscribe(callback) {
        this.listeners.add(callback);
        callback(this.getState(), 'init');
        return () => this.listeners.delete(callback);
    }

    _emit(event) {
        const state = this.getState();
        for (const cb of this.listeners) {
            try {
                cb(state, event);
            } catch (err) {
                console.error('Video subscriber error:', err);
            }
        }
    }

    getState() {
        return {
            video: this.currentVideo,
            isFloating: this.mode === 'floating',
            isActive: Boolean(this.currentVideo)
        };
    }

    _buildIframe(videoId) {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`;
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        return iframe;
    }

    _animateTransition() {
        this.stage.classList.add('transitioning');
        clearTimeout(this._transitionTimer);
        this._transitionTimer = setTimeout(() => {
            this.stage.classList.remove('transitioning');
        }, TRANSITION_MS);
    }

    // video: { id, title, projectId }
    open(video, slotEl) {
        if (this.currentVideo && this.currentVideo.id !== video.id) {
            this.close();
        }

        if (!this.currentVideo) {
            this.currentVideo = video;
            this.iframe = this._buildIframe(video.id);
            this.iframeWrap.appendChild(this.iframe);
            this.stage.classList.add('active');
        } else {
            this.currentVideo = { ...this.currentVideo, ...video };
        }

        globalAudio.pause();
        this.dock(slotEl);
        this._emit('open');
    }

    // Continuously position the fixed stage over an in-page placeholder,
    // so the iframe visually appears embedded without ever being moved.
    dock(slotEl) {
        if (!this.iframe) return;
        const changingMode = this.mode !== 'docked';
        this.trackedSlot = slotEl;
        this.mode = 'docked';
        this.stage.classList.remove('floating');
        this.stage.classList.add('docked');
        if (changingMode) this._animateTransition();
        this._syncDockedPosition();
        this._startTracking();
        this._emit('dock');
    }

    _startTracking() {
        if (this.rafId) return;
        const loop = () => {
            if (this.mode !== 'docked') {
                this.rafId = null;
                return;
            }
            this._syncDockedPosition();
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    _syncDockedPosition() {
        if (!this.trackedSlot || !this.trackedSlot.isConnected) {
            this.float();
            return;
        }
        const rect = this.trackedSlot.getBoundingClientRect();
        const radius = getComputedStyle(this.trackedSlot).borderRadius;
        this.stage.style.top = `${rect.top}px`;
        this.stage.style.left = `${rect.left}px`;
        this.stage.style.width = `${rect.width}px`;
        this.stage.style.height = `${rect.height}px`;
        this.stage.style.borderRadius = radius;
    }

    // Snap the fixed stage to the floating corner dock.
    float() {
        if (!this.iframe || this.mode === 'floating') return;
        this.trackedSlot = null;
        this.mode = 'floating';
        this.stage.classList.remove('docked');
        this.stage.classList.add('floating');
        this._animateTransition();
        this.stage.style.top = '';
        this.stage.style.left = '';
        this.stage.style.width = '';
        this.stage.style.height = '';
        this.stage.style.borderRadius = '';
        this._emit('float');
    }

    close() {
        if (!this.currentVideo) return;
        this.mode = null;
        this.trackedSlot = null;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.iframe) {
            this.iframe.src = 'about:blank';
            this.iframe.remove();
        }
        this.iframe = null;
        this.currentVideo = null;
        this.stage.classList.remove('active', 'docked', 'floating', 'transitioning');
        this.stage.style.top = '';
        this.stage.style.left = '';
        this.stage.style.width = '';
        this.stage.style.height = '';
        this.stage.style.borderRadius = '';
        this._emit('close');
    }
}

export const globalVideo = new GlobalVideoManager();
