import { globalAudio } from './global-audio.js';

export function initializeCustomAudioPlayers(container, projectId) {
    const players = container.querySelectorAll('.custom-audio-player');

    players.forEach((player, index) => {
        // Prevent duplicate initializations
        if (player.dataset.initialized === 'true') return;
        player.dataset.initialized = 'true';

        const initialAudio = player.querySelector('audio');
        const rawSrc = initialAudio ? initialAudio.getAttribute('src') : player.getAttribute('data-src');
        if (!rawSrc) return;

        // Auto-resolve CDN URL if relative path
        const src = rawSrc.replace(/(?:\.\/)?content\/[^/]+\/audio\/([^"]+\.mp3)/g, 'https://media.ryanmarch.me/$1');
        const title = player.getAttribute('data-title') || 'Audio Track';
        const subtitle = player.getAttribute('data-subtitle') || 'Local File';
        const trackId = `${projectId || 'page'}-${index}-${title.replace(/\s+/g, '-').toLowerCase()}`;

        const trackData = {
            id: trackId,
            src: src,
            title: title,
            subtitle: subtitle,
            projectId: projectId || null
        };

        // Dynamically build audio player UI inside the container.
        player.innerHTML = `
            <!-- Top Row: Title & Info -->
            <div class="player-header">
                <span class="player-title">${title}</span>
                <span class="player-subtitle">${subtitle}</span>
            </div>
            
            <!-- Middle Row: Timeline Scrubber -->
            <div class="player-timeline">
                <span class="player-time-current">0:00</span>
                <div class="player-progress-container" aria-label="Seek track" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <div class="player-progress-bar"></div>
                    <div class="player-progress-knob"></div>
                </div>
                <span class="player-time-duration">0:00</span>
            </div>
            
            <!-- Bottom Row: Controls -->
            <div class="player-controls">
                <!-- Volume Control -->
                <div class="player-volume-group">
                    <button class="player-mute" aria-label="Mute">
                        <svg class="icon-volume" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        <svg class="icon-muted" viewBox="0 0 24 24" style="display:none;"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                    </button>
                    <div class="player-volume-slider-container" aria-label="Volume slider" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
                        <div class="player-volume-slider-bar" style="width: 100%;"></div>
                        <div class="player-volume-knob" style="left: 100%;"></div>
                    </div>
                </div>

                <!-- Play/Pause Button -->
                <button class="player-play-pause" aria-label="Play">
                    <svg class="icon-play" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                    <svg class="icon-pause" viewBox="0 0 24 24" style="display:none;"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>

                <!-- Right spacer to balance symmetry -->
                <div class="player-right-spacer"></div>
            </div>
        `;

        const playPauseBtn = player.querySelector('.player-play-pause');
        const iconPlay = player.querySelector('.icon-play');
        const iconPause = player.querySelector('.icon-pause');
        const progressBarContainer = player.querySelector('.player-progress-container');
        const progressBar = player.querySelector('.player-progress-bar');
        const progressBarKnob = player.querySelector('.player-progress-knob');
        const timeCurrent = player.querySelector('.player-time-current');
        const timeDuration = player.querySelector('.player-time-duration');
        const muteBtn = player.querySelector('.player-mute');
        const iconVolume = player.querySelector('.icon-volume');
        const iconMuted = player.querySelector('.icon-muted');
        const volumeSliderContainer = player.querySelector('.player-volume-slider-container');
        const volumeSliderBar = player.querySelector('.player-volume-slider-bar');
        const volumeKnob = player.querySelector('.player-volume-knob');

        function formatTime(seconds) {
            if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }

        function isThisTrackActive(state) {
            return state.track && (state.track.id === trackData.id || state.track.src === trackData.src);
        }

        // Sync UI with Global Audio Manager State
        const unsubscribe = globalAudio.subscribe((state) => {
            // Check if player element is still connected to DOM
            if (!player.isConnected) {
                unsubscribe();
                return;
            }

            const active = isThisTrackActive(state);

            // Play / Pause Icon
            if (active && !state.isPaused) {
                if (iconPlay) iconPlay.style.display = 'none';
                if (iconPause) iconPause.style.display = 'block';
                playPauseBtn.setAttribute('aria-label', 'Pause');
            } else {
                if (iconPlay) iconPlay.style.display = 'block';
                if (iconPause) iconPause.style.display = 'none';
                playPauseBtn.setAttribute('aria-label', 'Play');
            }

            // Progress / Time Scrubber
            if (active && !state.audioEnded) {
                const current = state.currentTime;
                const duration = state.duration;
                if (duration && !isNaN(duration) && isFinite(duration)) {
                    const percent = (current / duration) * 100;
                    if (progressBar) progressBar.style.width = `${percent}%`;
                    if (progressBarKnob) progressBarKnob.style.left = `${percent}%`;
                    if (progressBarContainer) {
                        progressBarContainer.style.setProperty('--progress-percent', `${percent}%`);
                        progressBarContainer.setAttribute('aria-valuenow', Math.round(percent).toString());
                    }
                    if (timeDuration) timeDuration.textContent = formatTime(duration);
                }
                if (timeCurrent) timeCurrent.textContent = formatTime(current);
            } else {
                // Reset player progress if track ended, stopped, or another track is active
                if (progressBar) progressBar.style.width = '0%';
                if (progressBarKnob) progressBarKnob.style.left = '0%';
                if (progressBarContainer) {
                    progressBarContainer.style.setProperty('--progress-percent', '0%');
                    progressBarContainer.setAttribute('aria-valuenow', '0');
                }
                if (timeCurrent) timeCurrent.textContent = '0:00';
            }

            // Volume & Mute UI
            const vol = state.volume;
            const isMuted = state.muted || vol === 0;
            const displayPercent = isMuted ? 0 : vol * 100;
            if (iconVolume) iconVolume.style.display = isMuted ? 'none' : 'block';
            if (iconMuted) iconMuted.style.display = isMuted ? 'block' : 'none';
            if (muteBtn) muteBtn.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
            if (volumeSliderBar) volumeSliderBar.style.width = `${displayPercent}%`;
            if (volumeKnob) volumeKnob.style.left = `${displayPercent}%`;
            if (volumeSliderContainer) volumeSliderContainer.setAttribute('aria-valuenow', Math.round(displayPercent).toString());
        });

        // Click Play / Pause
        playPauseBtn.addEventListener('click', () => {
            const state = globalAudio.getState();
            if (isThisTrackActive(state)) {
                globalAudio.togglePlay();
            } else {
                globalAudio.loadAndPlay(trackData);
            }
        });

        // Scrubber / Seek
        if (progressBarContainer) {
            let isSeeking = false;

            const updateSeekFromPointer = (e) => {
                const rect = progressBarContainer.getBoundingClientRect();
                if (rect.width <= 0) return;
                const clickX = e.clientX - rect.left;
                const percent = Math.min(Math.max(clickX / rect.width, 0), 1);

                const state = globalAudio.getState();
                if (!isThisTrackActive(state)) {
                    globalAudio.loadAndPlay(trackData);
                }
                globalAudio.seekPercent(percent);
            };

            progressBarContainer.addEventListener('pointerdown', (e) => {
                isSeeking = true;
                progressBarContainer.setPointerCapture(e.pointerId);
                updateSeekFromPointer(e);
            });

            progressBarContainer.addEventListener('pointermove', (e) => {
                if (!isSeeking) return;
                updateSeekFromPointer(e);
            });

            const stopSeek = (e) => {
                if (!isSeeking) return;
                isSeeking = false;
                try {
                    progressBarContainer.releasePointerCapture(e.pointerId);
                } catch (_) {}
            };

            progressBarContainer.addEventListener('pointerup', stopSeek);
            progressBarContainer.addEventListener('pointercancel', stopSeek);

            progressBarContainer.addEventListener('keydown', (e) => {
                const state = globalAudio.getState();
                if (!isThisTrackActive(state)) return;

                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    globalAudio.seek(state.currentTime + 5);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    globalAudio.seek(state.currentTime - 5);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    globalAudio.seek(0);
                } else if (e.key === 'End') {
                    e.preventDefault();
                    if (state.duration) globalAudio.seek(state.duration);
                }
            });
        }

        // Mute / Unmute
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                globalAudio.toggleMute();
            });
        }

        // Volume Slider with Drag & Pointer Capture Support
        if (volumeSliderContainer) {
            let isDraggingVol = false;

            const updateVolumeFromPointer = (e) => {
                const rect = volumeSliderContainer.getBoundingClientRect();
                if (rect.width <= 0) return;
                const clickX = e.clientX - rect.left;
                const percent = Math.min(Math.max(clickX / rect.width, 0), 1);
                globalAudio.setVolume(percent);
            };

            volumeSliderContainer.addEventListener('pointerdown', (e) => {
                isDraggingVol = true;
                volumeSliderContainer.classList.add('is-dragging');
                volumeSliderContainer.setPointerCapture(e.pointerId);
                updateVolumeFromPointer(e);
            });

            volumeSliderContainer.addEventListener('pointermove', (e) => {
                if (!isDraggingVol) return;
                updateVolumeFromPointer(e);
            });

            const stopVolDrag = (e) => {
                if (!isDraggingVol) return;
                isDraggingVol = false;
                volumeSliderContainer.classList.remove('is-dragging');
                try {
                    volumeSliderContainer.releasePointerCapture(e.pointerId);
                } catch (_) {}
            };

            volumeSliderContainer.addEventListener('pointerup', stopVolDrag);
            volumeSliderContainer.addEventListener('pointercancel', stopVolDrag);

            volumeSliderContainer.addEventListener('keydown', (e) => {
                const state = globalAudio.getState();
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    globalAudio.setVolume(state.volume + 0.05);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    globalAudio.setVolume(state.volume - 0.05);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    globalAudio.setVolume(0);
                } else if (e.key === 'End') {
                    e.preventDefault();
                    globalAudio.setVolume(1);
                }
            });
        }
    });
}
