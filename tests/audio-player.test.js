// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initializeCustomAudioPlayers } from '../assets/js/audio-player.js';
import { globalAudio } from '../assets/js/global-audio.js';

describe('Custom Audio Player Behavior', () => {
    let container;

    beforeEach(() => {
        // Mock HTMLMediaElement play/pause
        window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
        window.HTMLMediaElement.prototype.pause = vi.fn();
        window.HTMLMediaElement.prototype.load = vi.fn();

        // Setup a mock container with an audio player element
        container = document.createElement('div');
        container.innerHTML = `
            <div class="custom-audio-player" data-title="Test Song" data-subtitle="Test Artist">
                <audio src="content/my-awesome-project/audio/test.mp3" preload="metadata"></audio>
            </div>
        `;
        document.body.appendChild(container);
    });

    afterEach(() => {
        globalAudio.stop();
        if (container && container.parentNode) {
            document.body.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should initialize player structure and UI', () => {
        initializeCustomAudioPlayers(container);

        const title = container.querySelector('.player-title');
        const subtitle = container.querySelector('.player-subtitle');
        const playPauseBtn = container.querySelector('.player-play-pause');
        const volumeKnob = container.querySelector('.player-volume-knob');

        expect(title.textContent).toBe('Test Song');
        expect(subtitle.textContent).toBe('Test Artist');
        expect(playPauseBtn).not.toBeNull();
        expect(volumeKnob).not.toBeNull();
    });

    it('should toggle play/pause state when play button is clicked', () => {
        initializeCustomAudioPlayers(container);

        const playPauseBtn = container.querySelector('.player-play-pause');

        // Initial state
        expect(globalAudio.getState().isPaused).toBe(true);

        // Click play
        playPauseBtn.click();
        expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();

        // Simulate play event on global audio
        Object.defineProperty(globalAudio.audio, 'paused', { value: false, writable: true, configurable: true });
        globalAudio.audio.dispatchEvent(new Event('play'));
        expect(playPauseBtn.getAttribute('aria-label')).toBe('Pause');

        // Click pause
        playPauseBtn.click();
        expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();

        // Simulate pause event on global audio
        Object.defineProperty(globalAudio.audio, 'paused', { value: true, writable: true, configurable: true });
        globalAudio.audio.dispatchEvent(new Event('pause'));
        expect(playPauseBtn.getAttribute('aria-label')).toBe('Play');
    });

    it('should update progress UI when timeupdate is fired', () => {
        initializeCustomAudioPlayers(container);

        const playPauseBtn = container.querySelector('.player-play-pause');
        playPauseBtn.click();

        const progressBar = container.querySelector('.player-progress-bar');
        const timeCurrent = container.querySelector('.player-time-current');
        const timeDuration = container.querySelector('.player-time-duration');

        // Mock global audio element properties
        Object.defineProperty(globalAudio.audio, 'duration', { value: 200, writable: true, configurable: true });
        Object.defineProperty(globalAudio.audio, 'currentTime', { value: 50, writable: true, configurable: true });

        // Trigger durationchange/timeupdate
        globalAudio.audio.dispatchEvent(new Event('durationchange'));
        globalAudio.audio.dispatchEvent(new Event('timeupdate'));

        expect(timeDuration.textContent).toBe('3:20');
        expect(timeCurrent.textContent).toBe('0:50');
        expect(progressBar.style.width).toBe('25%');
    });

    it('should support volume controls and mute toggle', () => {
        initializeCustomAudioPlayers(container);

        const muteBtn = container.querySelector('.player-mute');
        const volumeSliderBar = container.querySelector('.player-volume-slider-bar');
        const volumeKnob = container.querySelector('.player-volume-knob');

        // Verify default slider display
        expect(volumeSliderBar.style.width).toBe('100%');
        expect(volumeKnob.style.left).toBe('100%');

        // Click mute
        muteBtn.click();
        expect(globalAudio.getState().muted).toBe(true);
        expect(muteBtn.getAttribute('aria-label')).toBe('Unmute');
        expect(volumeSliderBar.style.width).toBe('0%');

        // Click unmute
        muteBtn.click();
        expect(globalAudio.getState().muted).toBe(false);
        expect(muteBtn.getAttribute('aria-label')).toBe('Mute');
    });

    it('should return early if container is empty or has no audio', () => {
        const badContainer = document.createElement('div');
        badContainer.innerHTML = `<div class="custom-audio-player"></div>`;
        expect(() => initializeCustomAudioPlayers(badContainer)).not.toThrow();

        const emptyContainer = document.createElement('div');
        expect(() => initializeCustomAudioPlayers(emptyContainer)).not.toThrow();
    });

    it('should handle ended event correctly', () => {
        initializeCustomAudioPlayers(container);
        const playPauseBtn = container.querySelector('.player-play-pause');
        playPauseBtn.click();

        const progressBar = container.querySelector('.player-progress-bar');
        const timeCurrent = container.querySelector('.player-time-current');

        // Fire ended event
        Object.defineProperty(globalAudio.audio, 'ended', { value: true, writable: true, configurable: true });
        Object.defineProperty(globalAudio.audio, 'paused', { value: true, writable: true, configurable: true });
        globalAudio.audio.dispatchEvent(new Event('ended'));

        expect(progressBar.style.width).toBe('0%');
        expect(timeCurrent.textContent).toBe('0:00');
        expect(playPauseBtn.getAttribute('aria-label')).toBe('Play');
    });

    it('should seek audio on progress bar click and pointer drag', () => {
        initializeCustomAudioPlayers(container);
        const progressBarContainer = container.querySelector('.player-progress-container');
        const progressBar = container.querySelector('.player-progress-bar');

        Object.defineProperty(globalAudio.audio, 'duration', { value: 100, writable: true, configurable: true });
        Object.defineProperty(globalAudio.audio, 'currentTime', { value: 0, writable: true, configurable: true });

        progressBarContainer.getBoundingClientRect = () => ({
            left: 10,
            width: 100,
            top: 0,
            bottom: 0,
            right: 110,
            height: 10
        });

        // Pointerdown at clientX = 60 (50% progress)
        const pointerEvent = new MouseEvent('pointerdown', {
            clientX: 60,
            bubbles: true
        });
        pointerEvent.pointerId = 1;
        progressBarContainer.setPointerCapture = vi.fn();
        progressBarContainer.releasePointerCapture = vi.fn();

        progressBarContainer.dispatchEvent(pointerEvent);

        expect(globalAudio.audio.currentTime).toBe(50);
    });

    it('should support seek controls via keyboard on progress bar container', () => {
        initializeCustomAudioPlayers(container);
        const playPauseBtn = container.querySelector('.player-play-pause');
        playPauseBtn.click();

        const progressBarContainer = container.querySelector('.player-progress-container');

        Object.defineProperty(globalAudio.audio, 'duration', { value: 100, writable: true, configurable: true });
        Object.defineProperty(globalAudio.audio, 'currentTime', { value: 50, writable: true, configurable: true });

        // ArrowRight
        const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
        progressBarContainer.dispatchEvent(rightEvent);
        expect(globalAudio.audio.currentTime).toBe(55);

        // ArrowLeft
        const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
        progressBarContainer.dispatchEvent(leftEvent);
        expect(globalAudio.audio.currentTime).toBe(50);

        // Home
        const homeEvent = new KeyboardEvent('keydown', { key: 'Home' });
        progressBarContainer.dispatchEvent(homeEvent);
        expect(globalAudio.audio.currentTime).toBe(0);

        // End
        const endEvent = new KeyboardEvent('keydown', { key: 'End' });
        progressBarContainer.dispatchEvent(endEvent);
        expect(globalAudio.audio.currentTime).toBe(100);
    });

    it('should update volume on pointer drag & click', () => {
        initializeCustomAudioPlayers(container);
        const volumeSliderContainer = container.querySelector('.player-volume-slider-container');
        const volumeSliderBar = container.querySelector('.player-volume-slider-bar');
        const volumeKnob = container.querySelector('.player-volume-knob');

        volumeSliderContainer.getBoundingClientRect = () => ({
            left: 10,
            width: 100,
            top: 0,
            bottom: 0,
            right: 110,
            height: 10
        });
        volumeSliderContainer.setPointerCapture = vi.fn();
        volumeSliderContainer.releasePointerCapture = vi.fn();

        // Pointerdown at clientX = 60 (50% volume)
        const pointerEvent = new MouseEvent('pointerdown', {
            clientX: 60,
            bubbles: true
        });
        pointerEvent.pointerId = 1;
        volumeSliderContainer.dispatchEvent(pointerEvent);

        expect(globalAudio.getState().volume).toBe(0.5);
        expect(volumeSliderBar.style.width).toBe('50%');
        expect(volumeKnob.style.left).toBe('50%');
    });

    it('should support volume controls via keyboard', () => {
        initializeCustomAudioPlayers(container);
        const volumeSliderContainer = container.querySelector('.player-volume-slider-container');

        globalAudio.setVolume(0.5);

        // ArrowUp
        const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        volumeSliderContainer.dispatchEvent(upEvent);
        expect(globalAudio.getState().volume).toBeCloseTo(0.55);

        // ArrowDown
        const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        volumeSliderContainer.dispatchEvent(downEvent);
        expect(globalAudio.getState().volume).toBeCloseTo(0.5);

        // Home
        const homeEvent = new KeyboardEvent('keydown', { key: 'Home' });
        volumeSliderContainer.dispatchEvent(homeEvent);
        expect(globalAudio.getState().volume).toBe(0);

        // End
        const endEvent = new KeyboardEvent('keydown', { key: 'End' });
        volumeSliderContainer.dispatchEvent(endEvent);
        expect(globalAudio.getState().volume).toBe(1);
    });
});
