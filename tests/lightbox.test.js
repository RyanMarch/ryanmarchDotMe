// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    initializeLightbox,
    openLightbox,
    openDiagramLightbox,
    closeLightbox,
    setupContentClicks
} from '../assets/js/lightbox.js';

describe('Lightbox Overlay Behavior', () => {
    let container;

    beforeEach(() => {
        // Clear DOM
        document.body.innerHTML = '';
        
        // Setup container for content click tests
        container = document.createElement('div');
        container.innerHTML = `
            <div class="gallery-item">
                <img src="test-image.jpg" alt="A nice image" class="test-img" />
                <div class="gallery-caption">Image description text</div>
            </div>
            <div class="diagram-section">
                <iframe src="test-diagram.html"></iframe>
            </div>
            <div class="gallery-caption">Diagram description text</div>
            <a href="#test-section" id="hash-link">Go to Section</a>
            <div id="test-section">Target Section</div>
        `;
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should initialize and create lightbox overlay if not present', () => {
        expect(document.getElementById('lightbox-overlay')).toBeNull();
        initializeLightbox();
        
        const overlay = document.getElementById('lightbox-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.getAttribute('role')).toBe('dialog');
        expect(overlay.querySelector('#lightbox-image')).not.toBeNull();
    });

    it('should open lightbox with correct image properties', () => {
        initializeLightbox();
        openLightbox('test-image.jpg', 'A nice image', 'Image description text');

        const overlay = document.getElementById('lightbox-overlay');
        const img = document.getElementById('lightbox-image');
        const caption = document.getElementById('lightbox-caption');

        expect(overlay.classList.contains('open')).toBe(true);
        expect(img.getAttribute('src')).toBe('test-image.jpg');
        expect(img.getAttribute('alt')).toBe('A nice image');
        expect(caption.textContent).toBe('Image description text');
        expect(caption.style.display).toBe('block');
    });

    it('should open diagram lightbox with iframe', () => {
        initializeLightbox();
        openDiagramLightbox('test-diagram.html', 'Diagram description text');

        const overlay = document.getElementById('lightbox-overlay');
        const iframe = overlay.querySelector('.lightbox-iframe');
        const caption = document.getElementById('lightbox-caption');

        expect(overlay.classList.contains('open')).toBe(true);
        expect(iframe.getAttribute('src')).toBe('test-diagram.html?lightbox=true');
        expect(caption.textContent).toBe('Diagram description text');
    });

    it('should close lightbox and clear fields', async () => {
        initializeLightbox();
        openLightbox('test-image.jpg', 'A nice image', 'Image description text');

        closeLightbox();
        const overlay = document.getElementById('lightbox-overlay');
        expect(overlay.classList.contains('open')).toBe(false);
        expect(overlay.getAttribute('aria-hidden')).toBe('true');

        // Allow close timeout animation to execute
        await new Promise(resolve => setTimeout(resolve, 450));

        const img = document.getElementById('lightbox-image');
        expect(img.getAttribute('src')).toBe('');
    });

    it('should setup click delegation for images', () => {
        initializeLightbox();
        setupContentClicks(container, container);

        const img = container.querySelector('.test-img');
        
        // Mock scrollIntoView since jsdom doesn't support layout
        window.HTMLElement.prototype.scrollIntoView = vi.fn();

        // Click the image
        img.click();

        const overlay = document.getElementById('lightbox-overlay');
        const lightboxImg = document.getElementById('lightbox-image');
        const caption = document.getElementById('lightbox-caption');

        expect(overlay.classList.contains('open')).toBe(true);
        expect(lightboxImg.getAttribute('src')).toBe('http://localhost:3000/test-image.jpg'); // jsdom base url prepends
        expect(caption.textContent).toBe('Image description text');
    });

    it('should trap focus on Tab press inside lightbox', () => {
        initializeLightbox();
        openLightbox('test-image.jpg', 'A nice image', 'Image description text');

        const overlay = document.getElementById('lightbox-overlay');
        const closeBtn = overlay.querySelector('.lightbox-close');
        
        // Mock querySelectorAll for focusable elements
        const button = document.createElement('button');
        button.focus = vi.fn();
        closeBtn.focus = vi.fn();

        // Spy on querySelectorAll to control what's returned
        vi.spyOn(overlay, 'querySelectorAll').mockImplementation((selector) => {
            if (selector.includes('button')) {
                return [closeBtn, button];
            }
            return [];
        });

        // Tab to next (from last to first)
        Object.defineProperty(document, 'activeElement', { value: button, configurable: true });
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false });
        overlay.dispatchEvent(tabEvent);
        expect(closeBtn.focus).toHaveBeenCalled();

        // Shift+Tab to previous (from first to last)
        Object.defineProperty(document, 'activeElement', { value: closeBtn, configurable: true });
        const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
        overlay.dispatchEvent(shiftTabEvent);
        expect(button.focus).toHaveBeenCalled();
    });

    it('should close on Escape keydown', () => {
        initializeLightbox();
        openLightbox('test-image.jpg', 'A nice image', 'Image description text');

        const overlay = document.getElementById('lightbox-overlay');
        expect(overlay.classList.contains('open')).toBe(true);

        const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
        document.dispatchEvent(escapeEvent);

        expect(overlay.classList.contains('open')).toBe(false);
    });

    it('should return early when missing lightbox or elements', () => {
        // We test close/open early returns by not initializing or clearing variables
        expect(() => closeLightbox()).not.toThrow();
        expect(() => openLightbox('img.png', 'alt', 'caption')).not.toThrow();
        expect(() => openDiagramLightbox('diagram.html', 'caption')).not.toThrow();
    });

    it('should setup click delegation for diagrams and hash links', () => {
        initializeLightbox();
        setupContentClicks(container, container);

        // Click a diagram section
        const diagramSec = container.querySelector('.diagram-section');
        
        // Trigger click on diagram section (or mock click bubble)
        diagramSec.click();
        const overlay = document.getElementById('lightbox-overlay');
        expect(overlay.classList.contains('open')).toBe(true);
        expect(overlay.querySelector('.lightbox-iframe').getAttribute('src')).toBe('test-diagram.html?lightbox=true');

        // Click a hash link
        const hashLink = container.querySelector('#hash-link');
        const targetSection = container.querySelector('#test-section');
        targetSection.scrollIntoView = vi.fn();

        hashLink.click();
        expect(targetSection.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('should close diagram lightbox and clear iframe source', async () => {
        initializeLightbox();
        openDiagramLightbox('test-diagram.html', 'Diagram description text');

        closeLightbox();
        
        // Allow close timeout animation to execute
        await new Promise(resolve => setTimeout(resolve, 450));

        const overlay = document.getElementById('lightbox-overlay');
        const iframe = overlay.querySelector('.lightbox-iframe');
        expect(iframe.getAttribute('src')).toBe('');
        expect(iframe.style.display).toBe('none');
    });
});
