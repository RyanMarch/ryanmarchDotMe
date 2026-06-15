import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../worker.js';

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
                        return Promise.resolve(new Response('<html><head><title>Home</title></head><body><div class="top-row"></div><div id="projects-grid"></div></body></html>', {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        }));
                    }
                    if (url.pathname === '/admin') {
                        return Promise.resolve(new Response('Admin HTML', {
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        }));
                    }
                    if (url.pathname === '/style.css') {
                        return Promise.resolve(new Response('body {}', {
                            headers: { 'Content-Type': 'text/css' }
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

    it('should redirect /admin and /admin/ to /admin.html with noindex headers', async () => {
        const req = new Request('https://ryanmarch.me/admin');
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(301);
        expect(res.headers.get('Location')).toBe('https://ryanmarch.me/admin.html');
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    it('should serve /admin.html with X-Robots-Tag noindex header', async () => {
        const req = new Request('https://ryanmarch.me/admin.html');
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(200);
        expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
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
});
