import { describe, it, expect, vi } from 'vitest';

// A fixture where one project is unpublished.
vi.mock('../public/assets/js/project-data.js', () => ({
    myProjects: [
        { id: 'live', title: 'Live', image: 'content/live/images/card.avif', hasExtendedContent: true, tags: [] },
        { id: 'hidden', title: 'Hidden', image: 'content/hidden/images/card.avif', hasExtendedContent: true, unpublished: true, tags: [] }
    ]
}));

import worker from '../worker.js';
import { buildSitemapXml } from '../scripts/sitemap-generator.js';
import { findLcpProject } from '../scripts/lcp-preload.js';

class MockHTMLRewriter { on() { return this; } transform(r) { return r; } }
global.HTMLRewriter = MockHTMLRewriter;

const env = {
    ASSETS: { fetch: vi.fn(async req => {
        const p = new URL(req.url).pathname;
        if (p === '/404') return new Response('Custom 404', { status: 404 });
        return new Response(`asset ${p}`, { headers: { 'Content-Type': 'text/html' } });
    }) }
};
const get = path => worker.fetch(new Request(`https://ryanmarch.me${path}`), env);

describe('unpublished projects', () => {
    it('serves a published project and hides an unpublished one (404, no redirect)', async () => {
        expect((await get('/project/live/')).status).toBe(200);
        expect((await get('/project/hidden/')).status).toBe(404);
        expect((await get('/project/hidden')).status).toBe(404);
    });
    it("does not serve an unpublished project's write-up text, however it is requested", async () => {
        for (const p of ['/content/hidden/index.html', '/content/hidden/', '/content/hidden']) expect((await get(p)).status, p).toBe(404);
        expect((await get('/content/live/index.html')).status).toBe(200);
    });
    it('leaves it out of the sitemap and never picks it as the LCP image', () => {
        const projects = [{ id: 'hidden', unpublished: true, hasExtendedContent: true, image: 'a.avif', tags: [] }, { id: 'live', hasExtendedContent: true, image: 'b.avif', tags: [] }];
        const xml = buildSitemapXml(projects, '2026-01-01', () => '2026-01-01');
        expect(xml).toContain('/project/live/');
        expect(xml).not.toContain('hidden');
        expect(findLcpProject(projects).id).toBe('live');
    });
});
