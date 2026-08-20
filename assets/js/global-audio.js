// Global Audio Manager for persistent playback across SPA navigation

class GlobalAudioManager {
    constructor() {
        this.audio = new Audio();
        this.audio.preload = 'metadata';
        this.currentTrack = null; // { id, src, title, subtitle, projectId }
        this.currentRouteProjectId = null;
        this.listeners = new Set();
        this.idleTimer = null;

        this._bindAudioEvents();
    }

    _bindAudioEvents() {
        this.audio.addEventListener('play', () => {
            this._clearIdleTimer();
            this._updateMediaSession();
            this._emit('play', this.getState());
        });

        this.audio.addEventListener('pause', () => {
            this._startIdleTimer();
            this._emit('pause', this.getState());
        });

        this.audio.addEventListener('timeupdate', () => {
            this._emit('timeupdate', this.getState());
        });

        this.audio.addEventListener('durationchange', () => {
            this._emit('durationchange', this.getState());
        });

        this.audio.addEventListener('ended', () => {
            this._clearIdleTimer();
            this._emit('ended', this.getState());
        });

        this.audio.addEventListener('error', (e) => {
            console.error("Global audio error:", e);
            this._emit('error', { error: e, state: this.getState() });
        });
    }

    _startIdleTimer() {
        this._clearIdleTimer();
        // Dismiss after 5 minutes of paused inactivity
        this.idleTimer = setTimeout(() => {
            if (this.audio.paused && this.currentTrack) {
                this.stop();
            }
        }, 5 * 60 * 1000);
    }

    _clearIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }

    _updateMediaSession() {
        if (!('mediaSession' in navigator) || !this.currentTrack) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: this.currentTrack.title || 'Audio Track',
            artist: this.currentTrack.subtitle || 'Ryan March',
            album: 'ryanmarch.me'
        });

        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined && this.audio.duration) {
                this.seek(details.seekTime);
            }
        });
    }

    subscribe(callback) {
        this.listeners.add(callback);
        // Immediately invoke with current state
        callback(this.getState(), 'init');
        return () => this.listeners.delete(callback);
    }

    _emit(event, data) {
        for (const cb of this.listeners) {
            try {
                cb(data, event);
            } catch (err) {
                console.error("Audio subscriber error:", err);
            }
        }
    }

    getState() {
        return {
            track: this.currentTrack,
            isPlaying: !this.audio.paused && !this.audio.ended && this.audio.readyState > 2,
            isPaused: this.audio.paused,
            audioEnded: this.audio.ended,
            currentTime: this.audio.currentTime || 0,
            duration: this.audio.duration || 0,
            volume: this.audio.volume,
            muted: this.audio.muted,
            currentRouteProjectId: this.currentRouteProjectId,
            shouldShowMiniPlayer: Boolean(this.currentTrack)
        };
    }

    loadAndPlay(track) {
        // track: { id, src, title, subtitle, projectId }
        if (this.currentTrack && this.currentTrack.src === track.src) {
            if (this.audio.paused) {
                this.audio.play().catch(e => console.error("Play failed:", e));
            }
            return;
        }

        this.currentTrack = track;
        this.audio.src = track.src;
        this.audio.load();
        this.audio.play().catch(e => console.error("Audio autoplay prevented or failed:", e));
        this._emit('trackchange', this.getState());
    }

    play() {
        if (!this.currentTrack) return;
        return this.audio.play().catch(e => console.error("Play failed:", e));
    }

    pause() {
        this.audio.pause();
    }

    togglePlay() {
        if (this.audio.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    seek(timeInSeconds) {
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            this.audio.currentTime = Math.min(Math.max(timeInSeconds, 0), this.audio.duration);
        }
    }

    seekPercent(percent) {
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            const clamped = Math.min(Math.max(percent, 0), 1);
            this.audio.currentTime = clamped * this.audio.duration;
        }
    }

    setVolume(volume) {
        this.audio.volume = Math.min(Math.max(volume, 0), 1);
        if (this.audio.volume > 0 && this.audio.muted) {
            this.audio.muted = false;
        }
        this._emit('volumechange', this.getState());
    }

    toggleMute() {
        this.audio.muted = !this.audio.muted;
        this._emit('volumechange', this.getState());
    }

    stop() {
        this._clearIdleTimer();
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        const prevTrack = this.currentTrack;
        this.currentTrack = null;
        this._emit('stop', { prevTrack, ...this.getState() });
    }

    setCurrentRoute(projectId) {
        this.currentRouteProjectId = projectId || null;
        this._emit('routechange', this.getState());
    }
}

export const globalAudio = new GlobalAudioManager();
