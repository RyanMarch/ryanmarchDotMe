import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeIndex, normalizeNotFound, recordNotFound, shouldRecord } from '../not-found.js';
import { distance, suggestDestination } from '../public/assets/js/admin/notfound-suggest.js';
import { handleAdminApi } from '../admin-api.js';

describe('shouldRecord', () => {
    const ok = path => shouldRecord({ method: 'GET', path, userAgent: 'Mozilla/5.0 (Macintosh)' });
    it('keeps page-like addresses a person could have followed', () => {
        for (const p of ['/project/ledgr', '/old-resume', '/about/me', '/project/ledger.html']) expect(ok(p), p).toBe(true);
    });
    it('drops scanner probes and missing assets', () => {
        for (const p of ['/wp-login.php', '/wp-admin/setup', '/.env', '/phpmyadmin', '/cgi-bin/x', '/backup.zip', '/assets/img/gone.png', '/favicon.ico', '/robots.txt', '/a/../b']) expect(ok(p), p).toBe(false);
    });
    it('drops bots, non-GET requests and silly paths', () => {
        expect(shouldRecord({ method: 'GET', path: '/x', userAgent: 'Googlebot/2.1' })).toBe(false);
        expect(shouldRecord({ method: 'GET', path: '/x', userAgent: 'curl/8.1' })).toBe(false);
        expect(shouldRecord({ method: 'POST', path: '/x', userAgent: 'Mozilla' })).toBe(false);
        expect(shouldRecord({ method: 'GET', path: `/${'a'.repeat(200)}`, userAgent: 'Mozilla' })).toBe(false);
    });
});

describe('normalizeNotFound / mergeIndex', () => {
    it('lowercases and drops trailing slashes', () => {
        expect(normalizeNotFound('/Old-Page/')).toBe('/old-page');
        expect(normalizeNotFound('')).toBe('/');
    });
    it('adds counts, remembers first/last seen and the latest referrer', () => {
        const a = mergeIndex(null, new Map([['/x', { n: 2, ref: 'news.example' }]]), 1000);
        expect(a).toEqual({ since: 1000, items: { '/x': { n: 2, first: 1000, last: 1000, ref: 'news.example' } } });
        const b = mergeIndex(a, new Map([['/x', { n: 3, ref: '' }], ['/y', { n: 1, ref: '' }]]), 2000);
        expect(b.items['/x']).toEqual({ n: 5, first: 1000, last: 2000, ref: 'news.example' });
        expect(b.since).toBe(1000);
    });
    it('keeps only the busiest addresses when the cap is reached', () => {
        const pending = new Map([['/a', { n: 5 }], ['/b', { n: 1 }], ['/c', { n: 9 }]]);
        expect(Object.keys(mergeIndex(null, pending, 1, 2).items).sort()).toEqual(['/a', '/c']);
    });
});

describe('recordNotFound', () => {
    let kv; let ctx;
    beforeEach(() => {
        const store = new Map();
        kv = { store, get: vi.fn(async k => (store.has(k) ? JSON.parse(store.get(k)) : null)), put: vi.fn(async (k, v) => { store.set(k, v); }) };
        ctx = { waitUntil: vi.fn(p => p) };
    });
    const req = (path, headers = {}) => new Request(`https://ryanmarch.me${path}`, { headers: { 'user-agent': 'Mozilla/5.0', ...headers } });

    it('saves a new address straight away, with the outside site that linked to it', async () => {
        recordNotFound({ ADMIN_KV: kv }, ctx, req('/unique-test-path-one', { referer: 'https://news.example/story' }));
        await Promise.all(ctx.waitUntil.mock.calls.map(c => c[0]));
        const saved = JSON.parse(kv.store.get('notfound:v1'));
        expect(saved.items['/unique-test-path-one']).toMatchObject({ n: 1, ref: 'news.example' });
    });
    it('ignores probes and works without a KV binding', () => {
        recordNotFound({ ADMIN_KV: kv }, ctx, req('/wp-login.php'));
        recordNotFound({}, ctx, req('/anything'));
        expect(ctx.waitUntil).not.toHaveBeenCalled();
    });
});

describe('suggestDestination', () => {
    const projects = [{ id: 'ledger', hasExtendedContent: true }, { id: 'spindex', hasExtendedContent: true }, { id: 'old-one', hasExtendedContent: true, unpublished: true }, { id: 'linkonly', hasExtendedContent: false }];
    it('catches typos and old spellings of a project', () => {
        expect(suggestDestination('/project/ledgr', projects)).toBe('/project/ledger/');
        expect(suggestDestination('/portfolio/Spindx', projects)).toBe('/project/spindex/');
        expect(suggestDestination('/ledger.html', projects)).toBe('/project/ledger/');
    });
    it('says nothing when there is no good guess, or the match is unpublished or link-only', () => {
        expect(suggestDestination('/project/zzzzzz', projects)).toBe('');
        expect(suggestDestination('/project/old-one', projects)).toBe('');
        expect(suggestDestination('/project/linkonly', projects)).toBe('');
    });
    it('measures edit distance', () => {
        expect(distance('ledger', 'ledgr')).toBe(1);
        expect(distance('abc', 'xyz')).toBe(3);
    });
});

describe('/api/admin/notfound', () => {
    const items = { '/old-page': { n: 4, first: 1, last: 9, ref: '' }, '/project/ledger': { n: 2, first: 1, last: 2, ref: '' }, '/already': { n: 7, first: 1, last: 5, ref: '' } };
    const kv = () => { const s = new Map([['notfound:v1', JSON.stringify({ since: 1, items })]]); return { get: async k => (s.has(k) ? JSON.parse(s.get(k)) : null), put: async (k, v) => s.set(k, v), s }; };
    const call = (method, search, env) => {
        const url = new URL(`https://ryanmarch.me/api/admin/notfound${search}`);
        const req = new Request(url, { method, headers: { Authorization: 'Bearer pw' } });
        return handleAdminApi(req, { ADMIN_PASSWORD: 'pw', ...env }, url, url.pathname, { projects: [{ id: 'ledger', hasExtendedContent: true }], redirects: [{ source: '/already/', destination: '/' }] });
    };
    it('lists addresses, leaving out ones that already redirect or are live pages', async () => {
        const body = await (await call('GET', '', { ADMIN_KV: kv() })).json();
        expect(body.items.map(i => i.path)).toEqual(['/old-page']);
        expect(body.items[0]).toMatchObject({ count: 4 });
    });
    it('can ignore an address, and says so when KV is not bound', async () => {
        const store = kv();
        expect((await call('DELETE', '?path=/old-page', { ADMIN_KV: store })).status).toBe(200);
        expect(JSON.parse(store.s.get('notfound:v1')).items['/old-page']).toBeUndefined();
        expect((await call('DELETE', '?path=/nope', { ADMIN_KV: store })).status).toBe(404);
        expect((await (await call('GET', '', {})).json()).available).toBe(false);
    });
});
