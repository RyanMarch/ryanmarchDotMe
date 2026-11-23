import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleAdminApi, sameOrigin } from '../admin-api.js';
import { normalizeCheck, normalizeRestCheck, probeAudio } from '../admin-site.js';
import { adminEmail, withEditor } from '../admin-http.js';
import { checksState, flag } from '../public/assets/js/admin/activity.js';
import { audioSignature, imageStem, localPath, r2KeyFromUrl, referencedStems, resolveAudioSrc, scanProjectHtml } from '../public/assets/js/admin/scan.js';
import { findProjectBlocks, reorderProjects, setUnpublished } from '../public/assets/js/admin/project-order.js';
import { parseProjectDataSource } from '../public/assets/js/admin-project-parser.js';
import { audioState, summarizeEmbeds, videoState } from '../public/assets/js/admin/embeds.js';
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
        const fetchImpl = vi.fn(async u => String(u).includes('oembed') ? new Response(JSON.stringify({ title: 'Vid' })) : new Response('nope', { status: 404 }));
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
    const bucket = () => ({ head: vi.fn(async () => null), get: vi.fn(async () => null), put: vi.fn(), delete: vi.fn() });
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
    it('deletes existing objects and 404s on missing ones (no trash bucket: gone for good)', async () => {
        const MEDIA = bucket();
        expect((await call('/api/admin/media/r2?key=a.mp3', { ...env0, MEDIA }, { method: 'DELETE' })).status).toBe(404);
        MEDIA.get.mockResolvedValue({ body: null });
        const res = await call('/api/admin/media/r2?key=a.mp3', { ...env0, MEDIA }, { method: 'DELETE' });
        expect(await res.json()).toEqual({ deleted: 'a.mp3', trashed: false });
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
    const env = { ...env0, GITHUB_REPO: 'o/r', GITHUB_PAT: 'x', CF_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' };
    const history = nodes => ({ data: { repository: { ref: { target: { history: { nodes } } } } } });
    const node = (oid, msg, rollup) => ({ oid: oid.padEnd(40, '0'), message: `${msg}\n\nlong body`, committedDate: '2026-01-01T10:00:00Z', url: `https://g/${oid}`, author: { name: 'R' }, statusCheckRollup: rollup });
    const run = (name, status, conclusion, app = 'GitHub Actions') => ({ __typename: 'CheckRun', name, status, conclusion, detailsUrl: 'u', checkSuite: { app: { name: app } } });
    const fake = routes => vi.fn(async (u, init = {}) => {
        const s = String(u);
        for (const [match, reply] of routes) if (s.includes(match)) return reply(init);
        return new Response(JSON.stringify({ success: false }), { status: 403 });
    });

    it('returns commits with their check status in one request, and a develop-ahead count on main', async () => {
        const fetchImpl = fake([
            ['/graphql', () => new Response(JSON.stringify(history([
                node('aaaaaaa', 'Fix thing', { contexts: { nodes: [run('test', 'COMPLETED', 'SUCCESS'), run('Workers Builds: site', 'COMPLETED', 'SUCCESS', 'Cloudflare Workers and Pages')] } }),
                node('bbbbbbb', 'Break thing', { contexts: { nodes: [run('test', 'COMPLETED', 'FAILURE')] } }),
                node('ccccccc', 'Old commit', null)
            ])))],
            ['compare/main...develop', () => new Response(JSON.stringify({ ahead_by: 3 }))]
        ]);
        const body = await (await call('/api/admin/activity?branch=main', env, { fetchImpl })).json();
        expect(body.commits.map(c => c.sha)).toEqual(['aaaaaaa', 'bbbbbbb', 'ccccccc']);
        expect(body.commits[0].checks).toEqual([{ name: 'Tests', state: 'ok', url: 'u' }, { name: 'Build', state: 'ok', url: 'u' }]);
        expect(body.commits[1].checks[0]).toMatchObject({ name: 'Tests', state: 'failed' });
        expect(body.commits[2].checks).toBeNull();
        expect(body.checksAvailable).toBe(true);
        expect(body.pending).toEqual({ ahead: 3 });
        expect(body.deploysError).toContain('Workers Scripts');
    });
    it('falls back to plain commits when GraphQL is not available for the token', async () => {
        const fetchImpl = fake([
            ['/graphql', () => new Response('nope', { status: 403 })],
            ['/commits?', () => new Response(JSON.stringify([{ sha: 'abcdef123', html_url: 'u', commit: { message: 'admin: update x\n\nbody', author: { name: 'R', date: '2026-01-01T00:00:00Z' } } }]))]
        ]);
        const body = await (await call('/api/admin/activity?branch=develop', env, { fetchImpl })).json();
        expect(body.commits[0]).toMatchObject({ sha: 'abcdef1', message: 'admin: update x', checks: null });
        expect(body.checksAvailable).toBe(false);
        expect(body.pending).toBeNull(); // only asked for on main
    });
    it('treats pending and unfinished runs, and old-style statuses, correctly', () => {
        expect(normalizeCheck(run('test', 'IN_PROGRESS', null)).state).toBe('pending');
        expect(normalizeCheck(run('test', 'COMPLETED', 'SKIPPED')).state).toBe('ok');
        expect(normalizeCheck(run('test', 'COMPLETED', 'CANCELLED')).state).toBe('failed');
        expect(normalizeCheck({ __typename: 'StatusContext', context: 'ci/x', state: 'PENDING' })).toMatchObject({ name: 'ci/x', state: 'pending' });
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

describe('/api/admin/media/image (delete)', () => {
    const env = { ...env0, GITHUB_REPO: 'o/r', GITHUB_PAT: 't' };
    const projects = [{ id: 'demo', title: 'Demo', image: 'content/demo/images/card.avif', ogImage: 'content/demo/images/og.jpg' }];
    const gh = (calls = []) => vi.fn(async (u, init = {}) => {
        calls.push([String(u), init.method || 'GET']);
        if ((init.method || 'GET') === 'GET') return new Response(JSON.stringify({ sha: 'abc123' }));
        return new Response(JSON.stringify({ commit: {} }));
    });
    const del = (p, opts = {}) => call(`/api/admin/media/image?path=${encodeURIComponent(p)}&branch=develop`, env, { method: 'DELETE', projects, ...opts });

    it('deletes an image on the chosen branch through GitHub', async () => {
        const calls = [];
        const res = await del('content/demo/images/extra.png', { fetchImpl: gh(calls) });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ deleted: 'content/demo/images/extra.png', branch: 'develop', commit: null });
        expect(calls[0][0]).toContain('/contents/public/content/demo/images/extra.png?ref=develop');
        expect(calls[1][1]).toBe('DELETE');
    });
    it.each([
        'content/demo/index.html', 'assets/js/project-data.js', 'config/redirects.json', 'redirects.json',
        'content/demo/images/../index.html', 'content/demo/images/sub/x.png', 'index.html', 'content/demo/images/notes.txt'
    ])('refuses anything that is not a plain image: %s', async p => {
        const fetchImpl = vi.fn();
        expect((await del(p, { fetchImpl })).status).toBe(400);
        expect(fetchImpl).not.toHaveBeenCalled();
    });
    it("refuses a project's card or share image, including its size variants", async () => {
        for (const p of ['content/demo/images/card.avif', 'content/demo/images/card-640.avif', 'content/demo/images/card.png', 'content/demo/images/og.jpg']) {
            const fetchImpl = vi.fn();
            const res = await del(p, { fetchImpl });
            expect(res.status, p).toBe(409);
            expect(fetchImpl).not.toHaveBeenCalled();
        }
    });
    it('reports a missing file, requires GitHub config, and needs a same-origin request', async () => {
        expect((await del('content/demo/images/gone.png', { fetchImpl: vi.fn(async () => new Response('{}', { status: 404 })) })).status).toBe(404);
        expect((await call('/api/admin/media/image?path=assets/img/a.png', env0, { method: 'DELETE', projects })).status).toBe(501);
        expect((await del('content/demo/images/x.png', { headers: { Origin: 'https://evil.example' }, fetchImpl: gh() })).status).toBe(403);
        expect((await call('/api/admin/media/image?path=assets/img/a.png', env, { method: 'GET', projects })).status).toBe(405);
    });
});

describe('setUnpublished', () => {
    const src = realSource;
    const idOf = i => findProjectBlocks(src)[i].id;
    it('adds the flag to one project without touching anything else', () => {
        const id = idOf(2);
        const next = setUnpublished(src, id, true);
        const before = parseProjectDataSource(src), after = parseProjectDataSource(next);
        expect(after.find(p => p.id === id).unpublished).toBe(true);
        expect(after.filter(p => p.unpublished)).toHaveLength(1);
        expect(after.map(p => ({ ...p, unpublished: undefined }))).toEqual(before.map(p => ({ ...p, unpublished: undefined })));
        expect(next.length - src.length).toBeLessThan(40);
    });
    it('removes the flag again and restores the original text exactly', () => {
        const id = idOf(5);
        expect(setUnpublished(setUnpublished(src, id, true), id, false)).toBe(src);
    });
    it('is idempotent and survives reordering', () => {
        const id = idOf(1);
        const once = setUnpublished(src, id, true);
        expect(setUnpublished(once, id, true)).toBe(once);
        const order = findProjectBlocks(once).map(b => b.id).reverse();
        const re = parseProjectDataSource(reorderProjects(once, order));
        expect(re.find(p => p.id === id).unpublished).toBe(true);
    });
    it('rejects an unknown project', () => expect(() => setUnpublished(src, 'nope', true)).toThrow(/No project/));
});

describe('embed status labels', () => {
    it('names audio and video results', () => {
        expect(audioState(200)).toEqual(['ok', 'Found']);
        expect(audioState(404)).toEqual(['error', 'Missing (404)']);
        expect(audioState(0)[1]).toBe('Unreachable');
        const good = { status: 206, type: 'audio/mpeg', ranges: true, bytes: 5000, signature: 'mp3' };
        expect(audioState(good)).toEqual(['ok', 'Found']);
        expect(audioState({ ...good, bytes: 0 })[1]).toBe('Empty file');
        expect(audioState({ ...good, type: 'text/html' })[1]).toBe('Not audio (text/html)');
        expect(audioState({ ...good, type: 'application/octet-stream' })[0]).toBe('ok');
        expect(audioState({ ...good, signature: null })[1]).toBe('Not a valid audio file');
        expect(audioState({ ...good, ranges: false })).toEqual(['warning', "Plays, but can't seek"]);
        expect(audioState({ status: 200 })[0]).toBe('ok'); // an older cached scan result
        expect(videoState(200)).toEqual(['ok', 'Available']);
        expect(videoState(401)).toEqual(['error', 'Embedding disabled or private']);
        expect(videoState(404)).toEqual(['error', 'Removed']);
        expect(videoState(400)[1]).toBe('Invalid video ID');
        expect(videoState(500)[1]).toBe('Unavailable (500)');
    });
});

describe('audioSignature', () => {
    const bytes = (...b) => Uint8Array.from(b);
    it('recognises common audio headers', () => {
        expect(audioSignature(bytes(0x49, 0x44, 0x33, 4, 0))).toBe('mp3');
        expect(audioSignature(bytes(0xFF, 0xFB, 0x90, 0x00))).toBe('mp3');
        expect(audioSignature(bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41, 0x20))).toBe('m4a');
        expect(audioSignature(bytes(0x4F, 0x67, 0x67, 0x53))).toBe('ogg');
        expect(audioSignature(bytes(0x66, 0x4C, 0x61, 0x43))).toBe('flac');
    });
    it('rejects HTML error pages and short reads', () => {
        expect(audioSignature(new TextEncoder().encode('<!DOCTYPE html>'))).toBeNull();
        expect(audioSignature(bytes(1, 2))).toBeNull();
    });
});

describe('probeAudio', () => {
    const reply = (body, init) => vi.fn(async () => new Response(body, init));
    const mp3 = Uint8Array.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0, 0, 0]);
    it('reports a healthy file: format, size, byte ranges', async () => {
        const r = await probeAudio(reply(mp3.slice(0, 1) , { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-0/29690573' } }), 'https://m/x.mp3');
        expect(r).toMatchObject({ status: 206, type: 'audio/mpeg', ranges: true, bytes: 29690573 });
    });
    it('reads the format from the first bytes', async () => {
        const r = await probeAudio(reply(mp3, { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-11/500' } }), 'https://m/x.mp3');
        expect(r.signature).toBe('mp3');
    });
    it('flags a server that ignores ranges', async () => {
        const r = await probeAudio(reply(mp3, { status: 200, headers: { 'content-type': 'audio/mpeg', 'content-length': '500' } }), 'https://m/x.mp3');
        expect(r).toMatchObject({ status: 200, ranges: false, bytes: 500, signature: 'mp3' });
    });
    it('reports a missing file, a network error, and an HTML page served as audio', async () => {
        expect((await probeAudio(reply('nf', { status: 404 }), 'https://m/x.mp3')).status).toBe(404);
        expect(await probeAudio(vi.fn(async () => { throw new Error('down'); }), 'https://m/x.mp3')).toEqual({ status: 0 });
        const html = await probeAudio(reply('<html>oops</html>', { status: 200, headers: { 'content-type': 'text/html' } }), 'https://m/x.mp3');
        expect(html).toMatchObject({ type: 'text/html', signature: null });
    });
});

describe('activity row flags', () => {
    const ok = { name: 'Tests', state: 'ok' }, bad = { name: 'Tests', state: 'failed' }, wait = { name: 'Build', state: 'pending' };
    it('summarises a commit\'s checks', () => {
        expect(checksState(null)).toBeNull();
        expect(checksState([ok, ok])).toBe('ok');
        expect(checksState([ok, wait])).toBe('pending');
        expect(checksState([ok, wait, bad])).toBe('failed');
    });
    it('stays quiet for a passing commit and names what failed or is running', () => {
        expect(flag([ok, ok])).toBe('');
        expect(flag(null)).toBe('');
        expect(flag([ok, bad])).toContain('Tests failed');
        expect(flag([ok, wait])).toContain('Build running');
    });
});

describe('commit attribution', () => {
    const jwt = payload => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.y`;
    const req = headers => new Request('https://ryanmarch.me/api/admin/file', { headers });
    it('reads the email from the Access token, then from the Access header', () => {
        expect(adminEmail(req({ 'cf-access-jwt-assertion': jwt({ email: 'me@example.com' }) }))).toBe('me@example.com');
        expect(adminEmail(req({ 'cf-access-authenticated-user-email': 'you@example.com' }))).toBe('you@example.com');
    });
    it('returns null for the local password or anything malformed', () => {
        expect(adminEmail(req({ Authorization: 'Bearer pw' }))).toBeNull();
        expect(adminEmail(req({ 'cf-access-jwt-assertion': 'garbage' }))).toBeNull();
        expect(adminEmail(req({ 'cf-access-authenticated-user-email': 'not an email' }))).toBeNull();
        expect(adminEmail(req({ 'cf-access-jwt-assertion': jwt({ email: '<b>x</b>' }) }))).toBeNull();
    });
    it('adds a trailer below the first line, so the "admin:" prefix still leads', () => {
        expect(withEditor('admin: update x', 'me@example.com')).toBe('admin: update x\n\nEdited-by: me@example.com');
        expect(withEditor('admin: update x', null)).toBe('admin: update x');
        expect(withEditor('admin: update x', 'me@example.com').split('\n')[0]).toBe('admin: update x');
    });
});

describe('/api/admin/build', () => {
    const env = { ...env0, GITHUB_REPO: 'o/r', GITHUB_PAT: 't' };
    const run = (name, status, conclusion, app = 'GitHub Actions') => ({ name, status, conclusion, html_url: 'https://g/r', app: { name: app } });
    const reply = runs => vi.fn(async () => new Response(JSON.stringify({ check_runs: runs })));
    const get = (sha, fetchImpl) => call(`/api/admin/build?sha=${sha}`, env, { fetchImpl });

    it('summarises a commit\'s checks: pending, ok, failed, none', async () => {
        const ok = await (await get('abc1234', reply([run('test', 'completed', 'success'), run('Workers Builds: x', 'completed', 'success', 'Cloudflare Workers and Pages')]))).json();
        expect(ok).toMatchObject({ state: 'ok', sha: 'abc1234' });
        expect(ok.checks.map(c => c.name)).toEqual(['Tests', 'Build']);
        expect((await (await get('abc1234', reply([run('test', 'completed', 'success'), run('Workers Builds: x', 'in_progress', null, 'Cloudflare Workers and Pages')]))).json()).state).toBe('pending');
        expect((await (await get('abc1234', reply([run('Workers Builds: x', 'completed', 'failure', 'Cloudflare Workers and Pages')]))).json()).state).toBe('failed');
        expect((await (await get('abc1234', reply([]))).json()).state).toBe('none');
    });
    it('rejects a malformed commit id and reports a token that cannot read checks', async () => {
        expect((await get('not-a-sha', reply([]))).status).toBe(400);
        const denied = await get('abc1234', vi.fn(async () => new Response('no', { status: 403 })));
        expect(denied.status).toBe(403);
        expect((await denied.json()).error).toBe('needs_checks_permission');
    });
    it('maps REST check runs like GraphQL ones', () => {
        expect(normalizeRestCheck(run('test', 'completed', 'cancelled')).state).toBe('failed');
        expect(normalizeRestCheck(run('test', 'queued', null)).state).toBe('pending');
    });
});

describe('R2 trash', () => {
    const store = (initial = {}) => {
        const m = new Map(Object.entries(initial));
        return {
            m,
            head: vi.fn(async k => (m.has(k) ? { key: k } : null)),
            get: vi.fn(async k => (m.has(k) ? { body: m.get(k).body, httpMetadata: m.get(k).httpMetadata, customMetadata: m.get(k).customMetadata } : null)),
            put: vi.fn(async (k, body, opts = {}) => { m.set(k, { body, ...opts }); }),
            delete: vi.fn(async k => { m.delete(k); }),
            list: vi.fn(async () => ({ objects: [...m].map(([key, v]) => ({ key, size: 3, uploaded: '2026-01-01', customMetadata: v.customMetadata })) }))
        };
    };
    const api = (p, env, method = 'GET', headers = {}) => call(p, env, { method, headers });

    it('moves a deleted file to the trash bucket with who and when, instead of destroying it', async () => {
        const MEDIA = store({ 'a.mp3': { body: 'DATA', httpMetadata: { contentType: 'audio/mpeg' } } });
        const MEDIA_TRASH = store();
        const res = await api('/api/admin/media/r2?key=a.mp3', { ...env0, MEDIA, MEDIA_TRASH }, 'DELETE', { 'cf-access-authenticated-user-email': 'me@example.com' });
        const body = await res.json();
        expect(body).toMatchObject({ deleted: 'a.mp3', trashed: true });
        expect(MEDIA.m.has('a.mp3')).toBe(false);
        const kept = MEDIA_TRASH.m.get(body.trashKey);
        expect(kept.body).toBe('DATA');
        expect(kept.customMetadata).toMatchObject({ originalKey: 'a.mp3', deletedBy: 'me@example.com' });
    });
    it('lists the trash, newest first', async () => {
        const MEDIA_TRASH = store({ '1-old.mp3': { customMetadata: { originalKey: 'old.mp3', deletedAt: '2026-01-01T00:00:00Z' } }, '2-new.mp3': { customMetadata: { originalKey: 'new.mp3', deletedAt: '2026-02-01T00:00:00Z' } } });
        const body = await (await api('/api/admin/media/trash', { ...env0, MEDIA_TRASH })).json();
        expect(body.objects.map(o => o.key)).toEqual(['new.mp3', 'old.mp3']);
        expect(body.objects[0].trashKey).toBe('2-new.mp3');
    });
    it('restores a file under its original name, and will not overwrite one that exists', async () => {
        const MEDIA = store();
        const MEDIA_TRASH = store({ '5-a.mp3': { body: 'DATA', customMetadata: { originalKey: 'a.mp3' } } });
        expect((await (await api('/api/admin/media/trash?key=5-a.mp3', { ...env0, MEDIA, MEDIA_TRASH }, 'POST')).json())).toEqual({ restored: 'a.mp3' });
        expect(MEDIA.m.get('a.mp3').body).toBe('DATA');
        expect(MEDIA_TRASH.m.has('5-a.mp3')).toBe(false);

        const taken = store({ 'a.mp3': { body: 'NEW' } });
        const trash2 = store({ '6-a.mp3': { body: 'OLD', customMetadata: { originalKey: 'a.mp3' } } });
        const res = await api('/api/admin/media/trash?key=6-a.mp3', { ...env0, MEDIA: taken, MEDIA_TRASH: trash2 }, 'POST');
        expect(res.status).toBe(409);
        expect(trash2.m.has('6-a.mp3')).toBe(true);
        expect(taken.m.get('a.mp3').body).toBe('NEW');
    });
    it('deletes for good only on request, rejects odd keys, and is optional', async () => {
        const MEDIA_TRASH = store({ '7-b.mp3': { body: 'X' } });
        expect((await api('/api/admin/media/trash?key=../x', { ...env0, MEDIA_TRASH }, 'DELETE')).status).toBe(400);
        expect((await api('/api/admin/media/trash?key=9-missing.mp3', { ...env0, MEDIA_TRASH }, 'DELETE')).status).toBe(404);
        expect((await api('/api/admin/media/trash?key=7-b.mp3', { ...env0, MEDIA_TRASH }, 'DELETE')).status).toBe(200);
        expect(MEDIA_TRASH.m.size).toBe(0);
        expect((await (await api('/api/admin/media/trash', env0)).json()).available).toBe(false);
    });
});
