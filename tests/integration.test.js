// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RyanMarchDotMe Full Page Integration Tests', () => {
    let htmlContent;
    let beforeunloadHandler = null;

    beforeEach(async () => {
        beforeunloadHandler = null;
        // Clear body and set up mocks
        document.body.innerHTML = '';
        window.scrollTo = vi.fn();

        const originalAddEventListener = window.addEventListener.bind(window);
        vi.spyOn(window, 'addEventListener').mockImplementation((event, handler, options) => {
            if (event === 'beforeunload') {
                beforeunloadHandler = handler;
            }
            return originalAddEventListener(event, handler, options);
        });
        
        // Reset location to root before initializing scripts
        window.history.replaceState(null, '', '/');

        // Mock sessionStorage to avoid JSDOM origin/security restrictions
        const mockSessionStorage = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        };
        Object.defineProperty(window, 'sessionStorage', {
            value: mockSessionStorage,
            writable: true,
            configurable: true
        });
        
        // Mock IntersectionObserver
        global.IntersectionObserver = vi.fn().mockImplementation(() => ({
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn()
        }));

        // Mock matchMedia
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        // Mock HTMLMediaElement play/pause for the audio player inside projects
        window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
        window.HTMLMediaElement.prototype.pause = vi.fn();

        // Spy on History API
        vi.spyOn(window.history, 'pushState');
        vi.spyOn(window.history, 'replaceState');

        // Read index.html contents
        const indexPath = path.resolve(__dirname, '../index.html');
        htmlContent = fs.readFileSync(indexPath, 'utf8');

        // Extract body element content
        const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        const bodyHTML = bodyMatch ? bodyMatch[1] : htmlContent;
        document.body.innerHTML = bodyHTML;

        // Mock fetch to load actual HTML fragments from the local content folder on disk
        global.fetch = vi.fn().mockImplementation((url) => {
            const cleanUrl = url.split('?')[0]; // strip version/cache query parameters
            const relativePath = cleanUrl.replace(/^\//, ''); // remove leading slash
            const absolutePath = path.resolve(__dirname, '../', relativePath, 'index.html');

            if (fs.existsSync(absolutePath)) {
                const fileData = fs.readFileSync(absolutePath, 'utf8');
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(fileData)
                });
            }
            return Promise.resolve({
                ok: false,
                status: 404,
                statusText: 'Not Found'
            });
        });

        // Dynamically import projects.js to trigger DOMContentLoaded event binding
        // Clean cache to allow re-importing in each test case
        const modulePath = '../assets/js/projects.js';
        await import(`${modulePath}?t=${Date.now()}`);

        // Fire DOMContentLoaded to trigger projects.js initialization
        document.dispatchEvent(new Event('DOMContentLoaded'));

        // Wait for initial routing timeouts to settle
        await new Promise(resolve => setTimeout(resolve, 200));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('should render the homepage projects grid and category filters from project-data.js', () => {
        const grid = document.getElementById('projects-grid');
        const cards = grid.querySelectorAll('.destination-card');
        const pills = document.querySelectorAll('.filter-pill');

        expect(cards.length).toBeGreaterThan(0);
        expect(pills.length).toBeGreaterThan(0);

        // Check if first pill is "All" and active
        const allPill = document.querySelector('.filter-pill[data-category="all"]');
        expect(allPill).not.toBeNull();
        expect(allPill.classList.contains('active')).toBe(true);
    });

    it('should filter projects when category pills are clicked', async () => {
        // Find the "Audio & Music" category pill (usually data-category="audio-music")
        const audioPill = document.querySelector('.filter-pill[data-category="audio-music"]');
        expect(audioPill).not.toBeNull();

        // Click it
        audioPill.click();

        // JSDOM has synchronous layout updates. We wait a microtask or brief frame.
        await new Promise(resolve => requestAnimationFrame(resolve));

        const grid = document.getElementById('projects-grid');
        const cards = Array.from(grid.querySelectorAll('.destination-card'));

        // Some cards matching category must NOT have 'filtered-out', others MUST
        const matchesCount = cards.filter(c => c.getAttribute('data-categories').includes('audio-music')).length;
        const visibleCards = cards.filter(c => !c.classList.contains('filtered-out'));

        expect(visibleCards.length).toBe(matchesCount);
    });

    it('should navigate to project detail view via SPA routing when Read More is clicked', async () => {
        const grid = document.getElementById('projects-grid');
        // Find a card that has extended content (Read More button exists)
        const readMoreBtn = grid.querySelector('.read-more-btn');
        expect(readMoreBtn).not.toBeNull();
        
        // Click the card
        readMoreBtn.click();

        // Wait for async fetch and DOM rendering inside loadProject
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check SPA state
        expect(document.body.classList.contains('standalone-page')).toBe(true);
        expect(window.history.pushState).toHaveBeenCalled();
        expect(document.title).toContain('Ryan March');

        // Check contents in detail area
        const detailArea = document.getElementById('project-detail-area');
        expect(detailArea.style.display).toBe('block');
        expect(detailArea.innerHTML).toContain('project-title');
    });

    it('should navigate back to home grid from project details', async () => {
        const grid = document.getElementById('projects-grid');
        const readMoreBtn = grid.querySelector('.read-more-btn');
        readMoreBtn.click();

        await new Promise(resolve => setTimeout(resolve, 300));

        const detailArea = document.getElementById('project-detail-area');
        const backBtn = detailArea.querySelector('.project-detail-back-btn');
        expect(backBtn).not.toBeNull();

        // Click Back to Home
        backBtn.click();

        // Wait for animation timeouts
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(document.body.classList.contains('standalone-page')).toBe(false);
        expect(detailArea.style.display).toBe('none');
    });

    it('should navigate home when header brand is clicked on a standalone page', async () => {
        // Mock standalone page class on body
        document.body.classList.add('standalone-page');

        const headerBrand = document.querySelector('.slim-header-brand');
        expect(headerBrand).not.toBeNull();

        // Click the slim header brand link
        headerBrand.click();

        // Wait for animations/navigation home
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(document.body.classList.contains('standalone-page')).toBe(false);
    });

    it('should save scroll position on beforeunload', () => {
        expect(beforeunloadHandler).not.toBeNull();
        beforeunloadHandler();
        expect(window.sessionStorage.setItem).toHaveBeenCalledWith('live_reload_scroll_x', expect.any(Number));
        expect(window.sessionStorage.setItem).toHaveBeenCalledWith('live_reload_scroll_y', expect.any(Number));
    });
});
