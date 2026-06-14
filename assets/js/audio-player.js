export function initializeCustomAudioPlayers(container) {
    const players = container.querySelectorAll('.custom-audio-player');

    players.forEach(player => {
        const initialAudio = player.querySelector('audio');
        if (!initialAudio) return;

        const src = initialAudio.getAttribute('src');
        const title = player.getAttribute('data-title') || 'Audio Track';
        const subtitle = player.getAttribute('data-subtitle') || 'Local File';

        // Dynamically build audio player UI inside the container.
        player.innerHTML = `
            <audio src="${src}" preload="metadata"></audio>
            
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

        const audio = player.querySelector('audio');
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

        if (!audio || !playPauseBtn) return;

        function formatTime(seconds) {
            if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }

        playPauseBtn.addEventListener('click', () => {
            document.querySelectorAll('audio').forEach(otherAudio => {
                if (otherAudio !== audio && !otherAudio.paused) {
                    otherAudio.pause();
                }
            });

            if (audio.paused) {
                audio.play().catch(e => console.error("Play failed:", e));
            } else {
                audio.pause();
            }
        });

        audio.addEventListener('play', () => {
            if (iconPlay) iconPlay.style.display = 'none';
            if (iconPause) iconPause.style.display = 'block';
            playPauseBtn.setAttribute('aria-label', 'Pause');
        });

        audio.addEventListener('pause', () => {
            if (iconPlay) iconPlay.style.display = 'block';
            if (iconPause) iconPause.style.display = 'none';
            playPauseBtn.setAttribute('aria-label', 'Play');
        });

        audio.addEventListener('ended', () => {
            if (iconPlay) iconPlay.style.display = 'block';
            if (iconPause) iconPause.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            if (progressBarKnob) progressBarKnob.style.left = '0%';
            if (progressBarContainer) {
                progressBarContainer.style.setProperty('--progress-percent', '0%');
                progressBarContainer.setAttribute('aria-valuenow', '0');
            }
            if (timeCurrent) timeCurrent.textContent = '0:00';
            playPauseBtn.setAttribute('aria-label', 'Play');
        });

        audio.addEventListener('timeupdate', () => {
            const current = audio.currentTime;
            const duration = audio.duration;
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
        });

        const setDuration = () => {
            if (timeDuration && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                timeDuration.textContent = formatTime(audio.duration);
            }
        };

        if (audio.readyState >= 1) {
            setDuration();
        } else {
            audio.addEventListener('loadedmetadata', setDuration);
        }
        audio.addEventListener('durationchange', setDuration);

        if (progressBarContainer) {
            progressBarContainer.addEventListener('click', (e) => {
                const rect = progressBarContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const percent = Math.min(Math.max(clickX / width, 0), 1);

                if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                    audio.currentTime = percent * audio.duration;
                    if (progressBar) progressBar.style.width = `${percent * 100}%`;
                    if (progressBarKnob) progressBarKnob.style.left = `${percent * 100}%`;
                }
            });

            // Keyboard accessibility for Seek Slider
            progressBarContainer.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                        audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
                    }
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    audio.currentTime = Math.max(audio.currentTime - 5, 0);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    audio.currentTime = 0;
                } else if (e.key === 'End') {
                    e.preventDefault();
                    if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                        audio.currentTime = audio.duration;
                    }
                }
            });
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                audio.muted = !audio.muted;
                if (audio.muted) {
                    if (iconVolume) iconVolume.style.display = 'none';
                    if (iconMuted) iconMuted.style.display = 'block';
                    if (volumeSliderBar) volumeSliderBar.style.width = '0%';
                    volumeSliderContainer.setAttribute('aria-valuenow', '0');
                    muteBtn.setAttribute('aria-label', 'Unmute');
                } else {
                    if (iconVolume) iconVolume.style.display = 'block';
                    if (iconMuted) iconMuted.style.display = 'none';
                    if (volumeSliderBar) volumeSliderBar.style.width = `${audio.volume * 100}%`;
                    volumeSliderContainer.setAttribute('aria-valuenow', Math.round(audio.volume * 100).toString());
                    muteBtn.setAttribute('aria-label', 'Mute');
                }
            });
        }

        if (volumeSliderContainer) {
            const updateVolumeUI = (percent) => {
                audio.volume = percent;
                if (volumeSliderBar) volumeSliderBar.style.width = `${percent * 100}%`;
                volumeSliderContainer.setAttribute('aria-valuenow', Math.round(percent * 100).toString());

                if (percent === 0) {
                    audio.muted = true;
                    if (iconVolume) iconVolume.style.display = 'none';
                    if (iconMuted) iconMuted.style.display = 'block';
                    muteBtn.setAttribute('aria-label', 'Unmute');
                } else {
                    audio.muted = false;
                    if (iconVolume) iconVolume.style.display = 'block';
                    if (iconMuted) iconMuted.style.display = 'none';
                    muteBtn.setAttribute('aria-label', 'Mute');
                }
            };

            volumeSliderContainer.addEventListener('click', (e) => {
                const rect = volumeSliderContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const percent = Math.min(Math.max(clickX / width, 0), 1);
                updateVolumeUI(percent);
            });

            // Keyboard accessibility for Volume Slider
            volumeSliderContainer.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    updateVolumeUI(Math.min(audio.volume + 0.05, 1));
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    updateVolumeUI(Math.max(audio.volume - 0.05, 0));
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    updateVolumeUI(0);
                } else if (e.key === 'End') {
                    e.preventDefault();
                    updateVolumeUI(1);
                }
            });
        }
    });
}
