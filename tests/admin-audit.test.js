import { describe, it, expect, vi } from 'vitest';
import { auditProjectHtml, auditProjectMeta, auditRedirects, auditSitemap, summarize } from '../public/assets/js/admin/audit.js';
import { handleAdminApi } from '../admin-api.js';
import { b64ToText, textToB64 } from '../public/assets/js/admin/seo.js';

const checks = list => list.map(f => f.check);
const page = (over = {}) => ({ id: 'demo', title: 'Demo', subtitle: 's', image: 'content/demo/card.avif', ogImage: 'content/demo/og.jpg', hasExtendedContent: true,
    seoTitle: 'Demo - A Perfectly Reasonable Title', seoDescription: 'x'.repeat(120), ...over });

describe('auditProjectMeta', () => {
    it('passes a well-formed project', () => expect(auditProjectMeta(page())).toEqual([]));
    it('flags missing and out-of-range SEO text, and a missing share image', () => {
        const f = auditProjectMeta(page({ seoTitle: 'x'.repeat(75), seoDescription: '', ogImage: '' }));
        expect(checks(f)).toEqual(expect.arrayContaining(['seo-title', 'seo-description', 'og-image']));
        expect(f.find(x => x.check === 'seo-title').severity).toBe('warning');
    });
    it('treats a missing card image as an error and skips SEO for link-only projects', () => {
        const f = auditProjectMeta({ id: 'l', title: 'L', subtitle: 's', hasExtendedContent: false });
        expect(f).toHaveLength(1);
        expect(f[0]).toMatchObject({ severity: 'error', check: 'card-image' });
    });
});

describe('auditProjectHtml', () => {
    const words = 'word '.repeat(200);
    it('flags images without alt, placeholder alt, h1 and unsafe external links', () => {
        const html = `<img src="a.png"><img src="b.png" alt="b.png"><img src="c.png" alt=""><h1>x</h1><a href="https://e.com" target="_blank">e</a><p>${words}</p>`;
        const f = auditProjectHtml({ id: 'd' }, html);
        expect(f.filter(x => x.check === 'img-alt').map(x => x.severity)).toEqual(['warning', 'info']);
        expect(checks(f)).toEqual(expect.arrayContaining(['heading', 'link-rel']));
        expect(checks(f)).not.toContain('thin-content');
    });
    it('ignores commented-out markup and counts words', () => {
        const f = auditProjectHtml({ id: 'd' }, '<!-- <img src="x.png"> --><p>too short</p>');
        expect(checks(f)).toEqual(['thin-content']);
    });
    it('accepts rel=noopener noreferrer', () => {
        expect(checks(auditProjectHtml({ id: 'd' }, `<a href="x" target="_blank" rel="noopener noreferrer">x</a><p>${words}</p>`))).toEqual([]);
    });
});

describe('auditRedirects', () => {
    const projects = [{ id: 'ledger' }, { id: 'spindex' }];
    const run = r => auditRedirects(r, projects);
    it('accepts a clean list', () => {
        expect(run([{ source: '/old', destination: '/', permanent: true }, { source: '/x', destination: 'https://e.com/', permanent: false }])).toEqual([]);
    });
    it('catches duplicates, self-redirects, missing targets and hijacked projects', () => {
        const f = run([
            { source: '/a', destination: '/b' }, { source: '/a/', destination: '/c' },
            { source: '/self', destination: '/self/' },
            { source: '/gone', destination: '/project/nope/' },
            { source: '/project/ledger', destination: '/' }
        ]);
        expect(checks(f)).toEqual(expect.arrayContaining(['redirect-duplicate', 'redirect-loop', 'redirect-target', 'redirect-hijack']));
    });
    it('distinguishes chains from loops', () => {
        expect(checks(run([{ source: '/a', destination: '/b' }, { source: '/b', destination: '/c' }]))).toContain('redirect-chain');
        const loop = run([{ source: '/a', destination: '/b' }, { source: '/b', destination: '/a' }]);
        expect(loop.filter(f => f.check === 'redirect-loop')).toHaveLength(2);
    });
    it('requires both fields and a leading slash', () => {
        expect(checks(run([{ source: '', destination: '/' }]))).toContain('redirect-incomplete');
        expect(checks(run([{ source: 'old', destination: '/' }]))).toContain('redirect-source');
    });
});

describe('auditSitemap', () => {
    const projects = [{ id: 'a', hasExtendedContent: true }, { id: 'b', hasExtendedContent: false }];
    it('finds missing and extra project URLs', () => {
        const xml = '<loc>https://ryanmarch.me/</loc><loc>https://ryanmarch.me/project/b/</loc>';
        const f = auditSitemap(xml, projects);
        expect(checks(f).sort()).toEqual(['sitemap-extra', 'sitemap-missing']);
    });
});

describe('summarize + base64 helpers', () => {
    it('counts by severity', () => expect(summarize([{ severity: 'error' }, { severity: 'info' }, { severity: 'info' }])).toEqual({ error: 1, warning: 0, info: 2 }));
    it('round-trips unicode', () => expect(b64ToText(textToB64('café → ✓'))).toBe('café → ✓'));
});

describe('/api/admin/health', () => {
    const env = { ADMIN_PASSWORD: 'pw' };
    const projects = [page({ id: 'demo' }), { id: 'bad', title: 'Bad', hasExtendedContent: false }];
    const call = (qs, opts) => {
        const url = new URL(`https://ryanmarch.me/api/admin/health${qs}`);
        return handleAdminApi(new Request(url, { headers: { Authorization: 'Bearer pw' } }), env, url, url.pathname, { projects, ...opts });
    };

    it('summary needs no file reads', async () => {
        const assetFetch = vi.fn();
        const body = await (await call('', { assetFetch, redirects: [{ source: '/a', destination: '/project/zzz/' }] })).json();
        expect(assetFetch).not.toHaveBeenCalled();
        expect(body.counts.error).toBeGreaterThanOrEqual(2); // bad has no image; redirect target missing
    });

    it('audits one project against the deployed files', async () => {
        const assetFetch = vi.fn(async (path, method) => {
            if (method === 'HEAD') return new Response(null, { status: path.includes('og.jpg') ? 404 : 200 });
            return new Response('<p>short</p><img src="a.png">');
        });
        const body = await (await call('?project=demo', { assetFetch })).json();
        expect(body.findings.map(f => f.check)).toEqual(expect.arrayContaining(['og-image', 'img-alt', 'thin-content']));
        expect(body.findings.find(f => f.check === 'og-image' && f.severity === 'error').message).toContain('og.jpg');
        expect(assetFetch).toHaveBeenCalledWith('/content/demo/');
    });

    it('reports a missing write-up and rejects unknown or malformed ids', async () => {
        const assetFetch = vi.fn(async () => new Response('nope', { status: 404 }));
        const body = await (await call('?project=demo', { assetFetch })).json();
        expect(body.findings.some(f => f.check === 'writeup-missing')).toBe(true);
        expect((await call('?project=nope', { assetFetch })).status).toBe(404);
        expect((await call('?project=../etc', { assetFetch })).status).toBe(404);
    });

    it('site scope checks the sitemap', async () => {
        const assetFetch = vi.fn(async () => new Response('<loc>https://ryanmarch.me/</loc>'));
        const body = await (await call('?scope=site', { assetFetch })).json();
        expect(body.findings.some(f => f.check === 'sitemap-missing')).toBe(true);
    });

    it('requires auth', async () => {
        const url = new URL('https://ryanmarch.me/api/admin/health');
        expect((await handleAdminApi(new Request(url), env, url, url.pathname, { projects })).status).toBe(401);
    });
});
