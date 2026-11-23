import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../worker.js';
import { myProjects } from '../public/assets/js/project-data.js';

// Mock HTMLRewriter since JSDOM/Node do not have it natively
class MockHTMLRewriter {
    constructor() {
        this.handlers = [];
    }
    on(selector, handler) {
        this.handlers.push({ selector, handler });
        return this;
    }
    transform(response) {
        // Add custom header to show HTMLRewriter was executed
        const newHeaders = new Headers(response.headers);
        newHeaders.set('x-htmlrewriter-applied', 'true');
        
        // Return cloned response with the custom header and attach handlers for inspection
        const clonedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
        clonedResponse.htmlRewriterHandlers = this.handlers;
        return clonedResponse;
    }
}
global.HTMLRewriter = MockHTMLRewriter;

describe('Cloudflare Worker Router & Redirect Tests', () => {
    let mockEnv;

    beforeEach(() => {
        vi.restoreAllMocks();

        // Setup mocked ASSETS binding
        mockEnv = {
            ASSETS: {
                fetch: vi.fn().mockImplementation((req) => {
                    const url = new URL(req.url);
                    if (url.pathname === '/' || url.pathname === '/index.html') {
                        return Promise.resolve(new Response('<html><head><title>Home</title></head><body><div class="top-row"></div><div id="projects-grid"></div><div id="archive-divider"></div><div id="archive-projects-grid"></div><div id="project-detail-area" style="display: none;"></div></body></html>', {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        }));
                    }
                    if (url.pathname === '/content/icon-studio/') {
                        return Promise.resolve(new Response('<h2 class="project-title">Icon Studio</h2><p>Icon Studio write-up.</p>', {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        }));
                    }
                    if (url.pathname === '/content/breaking-winter/') {
                        return Promise.resolve(new Response('<h2 class="project-title">Breaking Winter</h2><audio src="content/breaking-winter/audio/ryanMarchBreakingWinter.mp3"></audio>', {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        }));
                    }
                    if (url.pathname === '/admin') {
                        return Promise.resolve(new Response('Admin HTML', {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        }));
                    }
                    if (url.pathname === '/assets/css/style.css') {
                        return Promise.resolve(new Response('body {}', {
                            headers: { 'Content-Type': 'text/css' }
                        }));
                    }
                    if (url.pathname === '/404' || url.pathname === '/404.html') {
                        return Promise.resolve(new Response('Custom 404 Page', {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        }));
                    }
                    return Promise.resolve(new Response('Not Found', { status: 404 }));
                })
            },
            ADMIN_PASSWORD: 'test-password',
            GITHUB_REPO: 'RyanMarch/test-repo',
            GITHUB_PAT: 'test-pat'
        };

        // Mock global fetch for fetching the 404 page
        global.fetch = vi.fn().mockImplementation((urlStr) => {
            const url = new URL(urlStr);
            if (url.pathname === '/404') {
                return Promise.resolve(new Response('Custom 404 Page', {
                    status: 404,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                }));
            }
            return Promise.resolve(new Response('Not Found', { status: 404 }));
        });
    });

    it('should redirect http to https in production', async () => {
        const req = new Request('http://ryanmarch.me/some-path', {
            headers: new Headers({ 'x-forwarded-proto': 'http' })
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(301);
        expect(res.headers.get('Location')).toBe('https://ryanmarch.me/some-path');
    });

    it('should redirect www to non-www in production', async () => {
        const req = new Request('https://www.ryanmarch.me/about', {
            headers: new Headers({ 'x-forwarded-proto': 'https' })
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(301);
        expect(res.headers.get('Location')).toBe('https://ryanmarch.me/about');
    });

    it('should bypass production redirect checks for local development', async () => {
        const req = new Request('http://localhost:8787/about');
        const res = await worker.fetch(req, mockEnv);
        // Should not redirect to HTTPS, should handle normally
        // Since /about is not a valid route, it should return a 404 page
        expect(res.status).toBe(404);
    });

    it('should redirect legacy /portfolio requests to home or project page', async () => {
        // Test /portfolio redirect to root
        const req1 = new Request('https://ryanmarch.me/portfolio');
        const res1 = await worker.fetch(req1, mockEnv);
        expect(res1.status).toBe(301);
        expect(res1.headers.get('Location')).toBe('https://ryanmarch.me/');

        // Test /portfolio/icon-studio redirect to project details
        const req2 = new Request('https://ryanmarch.me/portfolio/icon-studio');
        const res2 = await worker.fetch(req2, mockEnv);
        expect(res2.status).toBe(301);
        expect(res2.headers.get('Location')).toBe('https://ryanmarch.me/project/icon-studio/');
    });

    it('should redirect mapped paths in redirects.json', async () => {
        const req = new Request('https://ryanmarch.me/resume/');
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(301);
        expect(res.headers.get('Location')).toBe('https://ryanmarch.me/');
    });

    it('should force trailing slash normalization for projects', async () => {
        const req = new Request('https://ryanmarch.me/project/icon-studio');
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(301);
        expect(res.headers.get('Location')).toBe('https://ryanmarch.me/project/icon-studio/');
    });

    it('should serve the admin at /admin with noindex and no-store headers', async () => {
        const res = await worker.fetch(new Request('https://ryanmarch.me/admin'), mockEnv);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe('Admin HTML');
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('should redirect /admin.html and /admin/ to /admin, keeping the query string', async () => {
        for (const from of ['https://ryanmarch.me/admin.html', 'https://ryanmarch.me/admin/', 'https://ryanmarch.me/admin.html?x=1']) {
            const res = await worker.fetch(new Request(from), mockEnv);
            expect(res.status, from).toBe(301);
            expect(res.headers.get('Location'), from).toBe(`https://ryanmarch.me/admin${from.includes('?') ? '?x=1' : ''}`);
            expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
        }
    });

    it('should serve the admin shell for every /admin/... path and drop trailing slashes', async () => {
        for (const p of ['/admin/media', '/admin/media/ledger', '/admin/analytics?days=7']) {
            const res = await worker.fetch(new Request(`https://ryanmarch.me${p}`), mockEnv);
            expect(res.status, p).toBe(200);
            expect(await res.text()).toBe('Admin HTML');
            expect(res.headers.get('Cache-Control')).toBe('no-store');
        }
        const slash = await worker.fetch(new Request('https://ryanmarch.me/admin/media/'), mockEnv);
        expect(slash.status).toBe(301);
        expect(slash.headers.get('Location')).toBe('https://ryanmarch.me/admin/media');
    });

    it('answers a missing asset with a real 404 instead of the SPA fallback page', async () => {
        mockEnv.ASSETS.fetch.mockImplementation(() => Promise.resolve(new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
        const res = await worker.fetch(new Request('https://ryanmarch.me/assets/img/gone.png'), mockEnv);
        expect(res.status).toBe(404);
        expect(res.headers.get('Content-Type')).toContain('text/plain');
    });

    it('should route invalid paths to the custom 404 page', async () => {
        const req = new Request('https://ryanmarch.me/random-non-existent-page');
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(404);
        const bodyText = await res.text();
        expect(bodyText).toContain('Custom 404 Page');
    });

    it('should run HTMLRewriter transformations for valid project requests', async () => {
        const req = new Request('https://ryanmarch.me/project/icon-studio/');
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(200);
        expect(res.headers.get('x-htmlrewriter-applied')).toBe('true');
        
        // Verify HTMLRewriter handlers were registered correctly
        expect(res.htmlRewriterHandlers).toBeDefined();
        const selectors = res.htmlRewriterHandlers.map(h => h.selector);
        expect(selectors).toContain('title');
        expect(selectors).toContain('meta[property="og:title"]');
        expect(selectors).toContain('.top-row');
        expect(selectors).toContain('#projects-grid');
    });
    it('should use ogImage for social tags and responsive srcset for the preload when a project defines them', async () => {
        const res = await worker.fetch(new Request('https://ryanmarch.me/project/spindex/'), mockEnv);
        const spindex = myProjects.find(p => p.id === 'spindex');
        const handlerFor = (selector) => res.htmlRewriterHandlers.find(h => h.selector === selector).handler;

        const attrs = {};
        const meta = { tagName: 'meta', getAttribute: (n) => (n === 'property' ? 'og:image' : null), setAttribute: (n, v) => { attrs[n] = v; } };
        handlerFor('meta[property="og:image"]').element(meta);
        expect(attrs.content).toBe(`https://ryanmarch.me/${spindex.ogImage}`);

        const preload = {};
        const link = { setAttribute: (n, v) => { preload[n] = v; }, removeAttribute: vi.fn(), remove: vi.fn() };
        handlerFor('link#lcp-preload').element(link);
        expect(preload.href).toBe(`/${spindex.image}`);
        expect(preload.imagesrcset).toContain(`${spindex.imageWidths[0]}w`);
    });

    it('should inline write-up HTML and rewrite R2 media URLs for projects with extended content', async () => {
        const res = await worker.fetch(new Request('https://ryanmarch.me/project/breaking-winter/'), mockEnv);
        expect(res.status).toBe(200);

        const selectors = res.htmlRewriterHandlers.map(h => h.selector);
        expect(selectors).toContain('#archive-divider');
        expect(selectors).toContain('#archive-projects-grid');
        expect(selectors).toContain('body');
        expect(selectors).toContain('#project-detail-area');

        const handlerFor = (selector) => res.htmlRewriterHandlers.find(h => h.selector === selector).handler;

        const bodyAttrs = {};
        handlerFor('body').element({
            getAttribute: () => null,
            setAttribute: (k, v) => { bodyAttrs[k] = v; }
        });
        expect(bodyAttrs.class).toBe('standalone-page');

        const existingBodyAttrs = { class: 'custom-theme' };
        handlerFor('body').element({
            getAttribute: (k) => existingBodyAttrs[k],
            setAttribute: (k, v) => { existingBodyAttrs[k] = v; }
        });
        expect(existingBodyAttrs.class).toBe('custom-theme standalone-page');

        const detailAttrs = {};
        const removed = [];
        let injected = null;
        handlerFor('#project-detail-area').element({
            setAttribute: (k, v) => { detailAttrs[k] = v; },
            removeAttribute: (k) => { removed.push(k); },
            setInnerContent: (html, opts) => { injected = { html, opts }; }
        });
        expect(detailAttrs['data-ssr-project']).toBe('breaking-winter');
        expect(removed).toContain('style');
        expect(injected.opts).toEqual({ html: true });
        expect(injected.html).toContain('https://media.ryanmarch.me/ryanMarchBreakingWinter.mp3');
    });

    it('should not fetch or inline write-up HTML for projects without extended content', async () => {
        const res = await worker.fetch(new Request('https://ryanmarch.me/project/bowserstack/'), mockEnv);
        expect(res.status).toBe(200);

        const fetchedPaths = mockEnv.ASSETS.fetch.mock.calls.map(([req]) => new URL(req.url).pathname);
        expect(fetchedPaths).not.toContain('/content/bowserstack/');

        const selectors = res.htmlRewriterHandlers.map(h => h.selector);
        expect(selectors).toContain('#archive-divider');
        expect(selectors).toContain('#archive-projects-grid');
        expect(selectors).not.toContain('body');
        expect(selectors).not.toContain('#project-detail-area');
    });

    it('should skip SSR write-up injection when the fragment is 404 or returns a full HTML document', async () => {
        const res404 = await worker.fetch(new Request('https://ryanmarch.me/project/ledger/'), mockEnv);
        expect(res404.status).toBe(200);
        expect(res404.htmlRewriterHandlers.map(h => h.selector)).not.toContain('#project-detail-area');

        const baseFetch = mockEnv.ASSETS.fetch.getMockImplementation();
        mockEnv.ASSETS.fetch.mockImplementation((req) => {
            if (new URL(req.url).pathname === '/content/ledger/') {
                return Promise.resolve(new Response('<!DOCTYPE html><html><body>Fallback</body></html>', {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                }));
            }
            return baseFetch(req);
        });

        const resFallback = await worker.fetch(new Request('https://ryanmarch.me/project/ledger/'), mockEnv);
        expect(resFallback.status).toBe(200);
        expect(resFallback.htmlRewriterHandlers.map(h => h.selector)).not.toContain('#project-detail-area');
    });
});
