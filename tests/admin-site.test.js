import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAdminApi, sameOrigin } from '../admin-api.js';
import { imageStem, localPath, r2KeyFromUrl, referencedStems, resolveAudioSrc, scanProjectHtml } from '../public/assets/js/admin/scan.js';
import { findProjectBlocks, reorderProjects } from '../public/assets/js/admin/project-order.js';
import { parseProjectDataSource } from '../public/assets/js/admin-project-parser.js';
import { summarizeEmbeds } from '../public/assets/js/admin/embeds.js';
import { bytes, sanitizeKey } from '../public/assets/js/admin/media.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const realSource = fs.readFileSync(path.join(here, '../public/assets/js/project-data.js'), 'utf8');

describe('scanProjectHtml', () => {
    const html = `
        <!-- <img src="commented.png"> -->
        <picture><source srcset="content/x/images/a-640.avif 640w, content/x/images/a.avif 1200w"><img src="content/x/images/a.png" alt="a"></picture>
        <img src="https://example.com/ext.png"><img src="/content/x/images/b.png?v=2">
        <div class="custom-audio-player" data-title="Song &amp; Co" data-subtitle="Me"><audio src="content/x/audio/song.mp3"></audio></div>
        <div class="custom-audio-player" data-title="Direct" data-src="https://media.ryanmarch.me/direct.mp3"></div>
        <iframe src="https://www.youtube-nocookie.com/embed/7ptQX03Idt4?controls=1"></iframe>
        <a href="https://youtu.be/7ptQX03Idt4">again</a>`;
    const r = scanProjectHtml(html);
    it('collects local images and srcset candidates, ignoring comments and external URLs', () => {
        expect(r.images.sort()).toEqual(['content/x/images/a-640.avif', 'content/x/images/a.avif', 'content/x/images/a.png', 'content/x/images/b.png']);
    });
    it('resolves audio players to the R2 CDN like the site does', () => {
        expect(r.audio.map(a => a.src)).toEqual(['https://media.ryanmarch.me/song.mp3', 'https://media.ryanmarch.me/direct.mp3']);
        expect(r.audio[0]).toMatchObject({ title: 'Song & Co', subtitle: 'Me' });
        expect(r2KeyFromUrl(r.audio[0].src)).toBe('song.mp3');
        expect(r2KeyFromUrl('https://elsewhere.com/x.mp3')).toBeNull();
    });
    it('finds each YouTube video once', () => expect(r.videos).toEqual([{ id: '7ptQX03Idt4' }]));
    it('helpers behave', () => {
        expect(localPath('data:image/png;base64,xx')).toBeNull();
        expect(localPath('./content/a.png#x')).toBe('content/a.png');
        expect(resolveAudioSrc('./content/p/audio/a b.mp3')).toBe('https://media.ryanmarch.me/a b.mp3');
    });
});

describe('image usage stems', () => {
    it('treats size and format variants as the same image', () => {
        expect(imageStem('content/x/images/card-640.avif')).toBe(imageStem('content/x/images/card.PNG'));
        expect(imageStem('content/x/images/card-360.avif')).toBe('content/x/images/card');
        expect(imageStem('content/x/images/shot-2.png')).not.toBe(imageStem('content/x/images/shot.png')); // -2 is not a size
    });
    it('collects stems from project cards, OG images and scans', () => {
        const stems = referencedStems([{ image: 'content/a/images/card.avif', ogImage: 'content/a/images/og.jpg' }], [{ images: ['content/a/images/hero.png'] }]);
        expect(stems.has('content/a/images/card')).toBe(true);
        expect(stems.has('content/a/images/og')).toBe(true);
        expect(stems.has('content/a/images/hero')).toBe(true);
        expect(stems.has('content/a/images/other')).toBe(false);
    });
});

describe('project-order', () => {
    it('finds every project block in the real project-data.js', () => {
        const blocks = findProjectBlocks(realSource);
        expect(blocks.map(b => b.id)).toEqual(parseProjectDataSource(realSource).map(p => p.id));
    });
    it('round-trips: reversing and restoring the order reproduces the file exactly', () => {
        const ids = findProjectBlocks(realSource).map(b => b.id);
        const reversed = reorderProjects(realSource, [...ids].reverse());
        expect(parseProjectDataSource(reversed).map(p => p.id)).toEqual([...ids].reverse());
        expect(reorderProjects(reversed, ids)).toBe(realSource);
    });
    it('keeps each project object byte-identical, only moving it', () => {
        const ids = findProjectBlocks(realSource).map(b => b.id);
        const moved = reorderProjects(realSource, [ids[5], ...ids.filter(i => i !== ids[5])]);
        const before = parseProjectDataSource(realSource).find(p => p.id === ids[5]);
        expect(parseProjectDataSource(moved)[0]).toEqual(before);
    });
    it('handles braces and quotes inside strings and comments', () => {
        const src = `export const myProjects = [\n  { id: "a", t: "}{ \\" ]", /* } */ n: 1 }, // { trailing\n  { id: 'b', t: 'x' }\n];\n`;
        expect(findProjectBlocks(src).map(b => b.id)).toEqual(['a', 'b']);
        expect(reorderProjects(src, ['b', 'a'])).toContain("{ id: 'b', t: 'x' },");
    });
    it('rejects incomplete or duplicate orders', () => {
        expect(() => reorderProjects(realSource, ['only-one'])).toThrow();
        const ids = findProjectBlocks(realSource).map(b => b.id);
        expect(() => reorderProjects(realSource, [ids[0], ...ids.slice(0, -1)])).toThrow();
    });
});

describe('embeds + media helpers', () => {
    it('counts embeds and problems', () => {
        expect(summarizeEmbeds([{ audio: [{ status: 200 }, { status: 404 }], videos: [{ status: 0 }, { status: 200 }] }, {}])).toEqual({ audio: 2, videos: 2, problems: 2 });
    });
    it('formats sizes and sanitizes upload names', () => {
        expect(bytes(512)).toBe('512 B');
        expect(bytes(2048)).toBe('2 KB');
        expect(bytes(5 * 1048576)).toBe('5.0 MB');
        expect(sanitizeKey('My Song (Final).MP3')).toBe('my-song-final.mp3');
        expect(sanitizeKey('---x.mp3')).toBe('x.mp3');
    });
});

/* ───────────── API handlers ───────────── */

const env0 = { ADMIN_PASSWORD: 'pw' };
const call = (p, env, { method = 'GET', headers = {}, body, ...opts } = {}) => {
    const url = new URL(`https://ryanmarch.me${p}`);
    const req = new Request(url, { method, headers: { Authorization: 'Bearer pw', ...headers }, body, ...(body ? { duplex: 'half' } : {}) });
    return handleAdminApi(req, env, url, url.pathname, opts);
};

describe('/api/admin/scan', () => {
    const projects = [{ id: 'demo', hasExtendedContent: true }, { id: 'link', hasExtendedContent: false }];
    const page = '<img src="content/demo/images/a.png"><div class="custom-audio-player" data-title="T"><audio src="content/demo/audio/t.mp3"></audio></div><iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe>';
    it('scans a write-up and checks each embed against its source', async () => {
        const assetFetch = vi.fn(async () => new Response(page));
        const fetchImpl = vi.fn(async (u, init) => String(u).includes('oembed') ? new Response(JSON.stringify({ title: 'Vid' })) : new Response(null, { status: init?.method === 'HEAD' ? 404 : 200 }));
        const body = await (await call('/api/admin/scan?project=demo', env0, { projects, assetFetch, fetchImpl })).json();
        expect(body.images).toEqual(['content/demo/images/a.png']);
        expect(body.audio[0]).toMatchObject({ key: 't.mp3', status: 404 });
        expect(body.videos[0]).toMatchObject({ id: 'abcdefghijk', status: 200, title: 'Vid' });
    });
    it('returns empty for link-only projects and 404 for unknown ones', async () => {
        expect((await (await call('/api/admin/scan?project=link', env0, { projects, assetFetch: vi.fn() })).json()).audio).toEqual([]);
        expect((await call('/api/admin/scan?project=zzz', env0, { projects })).status).toBe(404);
    });
});

describe('/api/admin/media', () => {
    it('lists repo images from the git tree and R2 objects', async () => {
        const env = { ...env0, GITHUB_REPO: 'o/r', GITHUB_PAT: 'x', MEDIA: { list: vi.fn(async () => ({ objects: [{ key: 'a.mp3', size: 10, uploaded: new Date('2026-01-01') }], truncated: false })) } };
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ tree: [
            { type: 'blob', path: 'public/content/x/images/a.avif', size: 100 },
            { type: 'blob', path: 'public/content/x/index.html', size: 5 },
            { type: 'blob', path: 'public/assets/img/b.webp', size: 7 },
            { type: 'blob', path: 'worker.js', size: 1 },
            { type: 'tree', path: 'public/content', size: 0 }
        ] })));
        const body = await (await call('/api/admin/media?branch=develop', env, { fetchImpl })).json();
        expect(body.repo.files).toEqual([{ path: 'content/x/images/a.avif', size: 100 }, { path: 'assets/img/b.webp', size: 7 }]);
        expect(body.r2).toMatchObject({ available: true, objects: [{ key: 'a.mp3', size: 10 }] });
        expect(String(fetchImpl.mock.calls[0][0])).toContain('git/trees/develop');
    });
    it('reports what is not configured', async () => {
        const body = await (await call('/api/admin/media', env0)).json();
        expect(body.repo).toBeNull();
        expect(body.r2.available).toBe(false);
    });
});

describe('/api/admin/media/r2', () => {
    const bucket = () => ({ head: vi.fn(async () => null), put: vi.fn(), delete: vi.fn() });
    const put = (qs, env, extra = {}) => call(`/api/admin/media/r2?${qs}`, env, { method: 'PUT', body: 'abc', headers: { 'content-length': '3' }, ...extra });

    it('uploads allowed types, refusing to overwrite unless asked', async () => {
        const MEDIA = bucket();
        expect((await put('key=song.mp3', { ...env0, MEDIA })).status).toBe(200);
        expect(MEDIA.put.mock.calls[0][2]).toEqual({ httpMetadata: { contentType: 'audio/mpeg' } });
        MEDIA.head.mockResolvedValue({ key: 'song.mp3' });
        expect((await put('key=song.mp3', { ...env0, MEDIA })).status).toBe(409);
        expect((await put('key=song.mp3&overwrite=1', { ...env0, MEDIA })).status).toBe(200);
    });
    it('validates key, type and size', async () => {
        const MEDIA = bucket();
        expect((await put('key=../x.mp3', { ...env0, MEDIA })).status).toBe(400);
        expect((await put('key=a.exe', { ...env0, MEDIA })).status).toBe(400);
        expect((await put('key=a.mp3', { ...env0, MEDIA }, { headers: { 'content-length': String(200 * 1024 * 1024) } })).status).toBe(413);
        expect(MEDIA.put).not.toHaveBeenCalled();
    });
    it('deletes existing objects and 404s on missing ones', async () => {
        const MEDIA = bucket();
        expect((await call('/api/admin/media/r2?key=a.mp3', { ...env0, MEDIA }, { method: 'DELETE' })).status).toBe(404);
        MEDIA.head.mockResolvedValue({});
        expect((await call('/api/admin/media/r2?key=a.mp3', { ...env0, MEDIA }, { method: 'DELETE' })).status).toBe(200);
        expect(MEDIA.delete).toHaveBeenCalledWith('a.mp3');
    });
    it('is unavailable without the binding, and blocks cross-origin writes', async () => {
        expect((await put('key=a.mp3', env0)).status).toBe(501);
        const MEDIA = bucket();
        expect((await put('key=a.mp3', { ...env0, MEDIA }, { headers: { 'content-length': '3', Origin: 'https://evil.example' } })).status).toBe(403);
        expect(MEDIA.put).not.toHaveBeenCalled();
        expect((await call('/api/admin/media/r2?key=a.mp3', { ...env0, MEDIA }, { method: 'GET' })).status).toBe(405);
    });
    it('sameOrigin allows absent and matching Origin only', () => {
        const url = new URL('https://ryanmarch.me/x');
        expect(sameOrigin(new Request(url), url)).toBe(true);
        expect(sameOrigin(new Request(url, { headers: { Origin: 'https://ryanmarch.me' } }), url)).toBe(true);
        expect(sameOrigin(new Request(url, { headers: { Origin: 'https://other.com' } }), url)).toBe(false);
    });
});

describe('/api/admin/activity and /status', () => {
    it('combines GitHub history with Cloudflare deployments, degrading per source', async () => {
        const env = { ...env0, GITHUB_REPO: 'o/r', GITHUB_PAT: 'x', CF_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' };
        const fetchImpl = vi.fn(async u => {
            const s = String(u);
            if (s.includes('/commits?')) return new Response(JSON.stringify([{ sha: 'abcdef123', html_url: 'u', commit: { message: 'admin: update x\n\nbody', author: { name: 'R', date: '2026-01-01T00:00:00Z' } } }]));
            if (s.includes('actions/runs')) return new Response(JSON.stringify({ workflow_runs: [{ name: 'CI', status: 'completed', conclusion: 'success', created_at: '2026-01-01', html_url: 'u', head_sha: 'abcdef123' }] }));
            if (s.includes('check-runs')) return new Response('nope', { status: 500 });
            return new Response(JSON.stringify({ success: false }), { status: 403 });
        });
        const body = await (await call('/api/admin/activity', env, { fetchImpl })).json();
        expect(body.commits[0]).toMatchObject({ sha: 'abcdef1', message: 'admin: update x' });
        expect(body.runs[0]).toMatchObject({ name: 'CI', conclusion: 'success' });
        expect(body.checks).toBeNull();
        expect(body.checksError).toBeTruthy();
        expect(body.deploysError).toContain('Workers Scripts');
    });
    it('reports configuration without exposing values', async () => {
        const body = await (await call('/api/admin/status', { ...env0, CF_API_TOKEN: 'secret-token', CF_ACCOUNT_ID: 'a' })).json();
        const byKey = Object.fromEntries(body.items.map(i => [i.key, i]));
        expect(byKey.analytics.ok).toBe(true);
        expect(byKey.github.ok).toBe(false);
        expect(byKey.password).toMatchObject({ ok: false, invert: true }); // ADMIN_PASSWORD is set here
        expect(JSON.stringify(body)).not.toContain('secret-token');
    });
});
