// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let beforeunloadHandler = null;

async function initIntegrationPage({ route = '/', ssrProjectId = null } = {}) {
    beforeunloadHandler = null;
    document.body.innerHTML = /*html*/ '';
    document.body.className = '';
    window.scrollTo = vi.fn();

    const originalAddEventListener = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler, options) => {
        if (event === 'beforeunload') {
            beforeunloadHandler = handler;
        }
        return originalAddEventListener(event, handler, options);
    });

    window.history.replaceState(null, '', route);

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

    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
    }));

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

    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn();

    vi.spyOn(window.history, 'pushState');
    vi.spyOn(window.history, 'replaceState');

    const indexPath = path.resolve(__dirname, '../public/index.html');
    const htmlContent = fs.readFileSync(indexPath, 'utf8');

    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyHTML = bodyMatch ? bodyMatch[1] : htmlContent;
    document.body.innerHTML = /*html*/ bodyHTML;

    if (ssrProjectId) {
        ['.top-row', '.filter-container', '#projects-grid', '#archive-divider', '#archive-projects-grid']
            .forEach(sel => document.querySelector(sel)?.remove());
        document.body.classList.add('standalone-page');
        const detailArea = document.getElementById('project-detail-area');
        detailArea.setAttribute('data-ssr-project', ssrProjectId);
        detailArea.removeAttribute('style');
        const fragPath = path.resolve(__dirname, '../public/content', ssrProjectId, 'index.html');
        detailArea.innerHTML = /*html*/ fs.readFileSync(fragPath, 'utf8');
    }

    global.fetch = vi.fn().mockImplementation((url) => {
        const cleanUrl = url.split('?')[0];
        const relativePath = cleanUrl.replace(/^\//, '');
        const absolutePath = path.resolve(__dirname, '../public', relativePath, 'index.html');

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

    const modulePath = '../public/assets/js/projects.js';
    await import(`${modulePath}?t=${Date.now()}`);

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 200));
}

function resetIntegrationDom() {
    vi.restoreAllMocks();
    document.body.innerHTML = /*html*/ '';
    document.body.className = '';
}

describe('RyanMarchDotMe Full Page Integration Tests', () => {
    beforeEach(async () => {
        await initIntegrationPage();
    });

    afterEach(resetIntegrationDom);

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

describe('Worker SSR Project Hydration Tests', () => {
    afterEach(resetIntegrationDom);

    it('should hydrate a Worker-SSR project page without re-fetching or blinking', async () => {
        await initIntegrationPage({ route: '/project/ledger/', ssrProjectId: 'ledger' });

        expect(global.fetch).not.toHaveBeenCalled();

        const detailArea = document.getElementById('project-detail-area');
        expect(detailArea.dataset.ssrProject).toBeUndefined();
        expect(detailArea.style.display).toBe('block');
        expect(detailArea.style.opacity).not.toBe('0');
        expect(detailArea.querySelector('.project-nav')).not.toBeNull();
        expect(detailArea.querySelector('.project-detail-tags')).not.toBeNull();
        expect(detailArea.querySelector('.project-detail-footer-actions')).not.toBeNull();
        expect(document.body.classList.contains('standalone-page')).toBe(true);
        expect(document.title).toContain('Ledger - Private, Local-First Personal Finance Tracker');
        expect(document.title).toContain('Ryan March');
    });
});
