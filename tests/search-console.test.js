import { describe, it, expect, vi } from 'vitest';
import { nearMisses, parseServiceAccount, windows, fetchSearchData } from '../search-console.js';
import { handleAdminApi } from '../admin-api.js';
import { hint } from '../public/assets/js/admin/search.js';

describe('search console helpers', () => {
    it('windows end two days back and the previous window sits right before', () => {
        const w = windows(7, Date.UTC(2026, 5, 10));
        expect(w).toEqual({ start: '2026-06-02', end: '2026-06-08', prevStart: '2026-05-26', prevEnd: '2026-06-01' });
    });
    it('parses a service account only when it has an email and key', () => {
        expect(parseServiceAccount('{"client_email":"a@b","private_key":"k"}')).toMatchObject({ client_email: 'a@b' });
        expect(parseServiceAccount('{"client_email":"a@b"}')).toBeNull();
        expect(parseServiceAccount('nope')).toBeNull();
    });
    it('near misses keep page 1-2 phrases with impressions, biggest missed clicks first', () => {
        const r = (q, impressions, clicks, position) => ({ keys: [q, '/p'], impressions, clicks, ctr: clicks / impressions, position });
        const out = nearMisses([r('top', 500, 400, 1.2), r('few', 5, 0, 9), r('small', 40, 1, 12), r('big', 400, 4, 8), r('far', 900, 0, 40)]);
        expect(out.map(x => x.query)).toEqual(['big', 'small']);
    });
    it('hint depends on the page', () => {
        expect(hint({ position: 7 })).toMatch(/title/);
        expect(hint({ position: 14 })).toMatch(/write-up/);
    });
});

describe('fetchSearchData', () => {
    it('is not configured without a key', async () => {
        expect(await fetchSearchData({}, 28, vi.fn())).toEqual({ configured: false });
    });
    it('signs in, queries five ways and totals', async () => {
        const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign']);
        const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
        const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der))}\n-----END PRIVATE KEY-----`;
        const fetchImpl = vi.fn(async (url, init) => {
            if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }));
            const dims = JSON.parse(init.body).dimensions.join();
            const rows = dims === 'date' ? [{ keys: ['2026-06-01'], clicks: 2, impressions: 100, ctr: 0.02, position: 5 }] : [{ keys: dims === 'query,page' ? ['q', '/p'] : ['x'], clicks: 1, impressions: 50, ctr: 0.02, position: 9 }];
            return new Response(JSON.stringify({ rows }));
        });
        const d = await fetchSearchData({ GSC_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@x', private_key: pem }), GSC_SITE: 'sc-domain:x.me' }, 28, fetchImpl);
        expect(d.totals.current).toMatchObject({ clicks: 2, impressions: 100 });
        expect(d.nearMisses[0]).toMatchObject({ query: 'q', page: '/p' });
        expect(fetchImpl).toHaveBeenCalledTimes(6);
        expect(fetchImpl.mock.calls[1][0]).toContain(encodeURIComponent('sc-domain:x.me'));
    });
});

describe('/api/admin/search', () => {
    const call = env => {
        const url = new URL('https://ryanmarch.me/api/admin/search');
        return handleAdminApi(new Request(url, { headers: { Authorization: 'Bearer pw' } }), { ADMIN_PASSWORD: 'pw', ...env }, url, url.pathname, {});
    };
    it('answers 501 until configured', async () => expect((await call({})).status).toBe(501));
    it('answers 501 for a malformed key', async () => expect((await call({ GSC_SERVICE_ACCOUNT: 'junk' })).status).toBe(501));
});

import { todayItems, todayHtml } from '../public/assets/js/admin/today.js';
describe('todayItems', () => {
    it('is empty when everything is fine', () => {
        expect(todayItems({ health: { counts: { error: 0, warning: 0, info: 3 } }, overview: { pending: { ahead: 0 }, projects: { total: 3, withWriteup: 3 } } })).toEqual([]);
        expect(todayHtml([])).toContain('Nothing needs attention');
    });
    it('puts errors first and caps the list', () => {
        const items = todayItems({
            health: { counts: { error: 2, warning: 1, info: 0 } },
            notfound: { available: true, items: [{ path: '/old', count: 5 }, { path: '/rare', count: 1 }, { path: '/b', count: 4 }, { path: '/c', count: 3 }] },
            overview: { pending: { ahead: 1 }, projects: { total: 5, withWriteup: 3 } },
            search: { nearMisses: [{ query: 'a', position: 8, impressions: 100, clicks: 0 }, { query: 'b', position: 9, impressions: 90, clicks: 1 }, { query: 'c', position: 9, impressions: 90, clicks: 1 }] },
            analytics: { totals: { current: { views: 10 }, previous: { views: 100 } } }
        });
        expect(items[0].level).toBe('error');
        expect(items).toHaveLength(6);
        expect(items.some(i => i.text.includes('/rare'))).toBe(false);
        expect(items.filter(i => i.level === 'warning').length).toBeGreaterThan(0);
    });
    it('escapes text', () => expect(todayHtml([{ level: 'info', text: '<b>x</b>', href: '/a', action: 'Go' }])).not.toContain('<b>x'));
});

import { mergeRows, pathOf, summarizeInspection } from '../search-console.js';
import { indexCell, projectRows } from '../public/assets/js/admin/search.js';

describe('page variants and per-project rows', () => {
    it('folds http, www and https into one path', () => {
        expect(pathOf('https://www.ryanmarch.me/project/a/')).toBe('/project/a/');
        const rows = ['http://ryanmarch.me/', 'https://ryanmarch.me/', 'https://www.ryanmarch.me/'].map((u, i) => ({ page: pathOf(u), clicks: i, impressions: 10, position: 10 * (i + 1) }));
        const [one, ...rest] = mergeRows(rows, r => r.page);
        expect(rest).toEqual([]);
        expect(one).toMatchObject({ page: '/', clicks: 3, impressions: 30, position: 20 });
    });
    it('rows list only published projects with a page, best first', () => {
        const rows = projectRows(
            [{ id: 'a', title: 'A', hasExtendedContent: true }, { id: 'b', title: 'B', hasExtendedContent: true }, { id: 'c', title: 'C', hasExtendedContent: false }, { id: 'd', title: 'D', hasExtendedContent: true, unpublished: true }],
            [{ page: '/project/b/', clicks: 5, impressions: 50, ctr: 0.1, position: 4 }]);
        expect(rows.map(r => r.id)).toEqual(['b', 'a']);
        expect(rows[0]).toMatchObject({ clicks: 5, position: 4 });
    });
    it('summarizes an inspection', () => {
        const r = summarizeInspection('u', { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', googleCanonical: 'g', userCanonical: 'u2' } });
        expect(r).toMatchObject({ state: 'indexed', canonicalMismatch: true });
        expect(summarizeInspection('u', { indexStatusResult: { verdict: 'NEUTRAL' } }).state).toBe('not-indexed');
        expect(summarizeInspection('u', {}).state).toBe('unknown');
        expect(indexCell(undefined)).toContain('Not checked');
    });
});

describe('/api/admin/search/index', () => {
    const projects = [{ id: 'ok', hasExtendedContent: true }, { id: 'hidden', hasExtendedContent: true, unpublished: true }];
    const call = (qs, env = {}) => {
        const url = new URL(`https://ryanmarch.me/api/admin/search/index${qs}`);
        return handleAdminApi(new Request(url, { headers: { Authorization: 'Bearer pw' } }), { ADMIN_PASSWORD: 'pw', GSC_SERVICE_ACCOUNT: '{"client_email":"a@b","private_key":"k"}', ...env }, url, url.pathname, { projects });
    };
    it('501 without a key, saved results without a project', async () => {
        expect((await call('', { GSC_SERVICE_ACCOUNT: '' })).status).toBe(501);
        const kv = { get: async () => ({ ok: { state: 'indexed' } }) };
        expect(await (await call('', { ADMIN_KV: kv })).json()).toEqual({ results: { ok: { state: 'indexed' } }, persistent: true });
    });
    it('refuses unknown and unpublished projects', async () => {
        expect((await call('?project=nope')).status).toBe(404);
        expect((await call('?project=hidden')).status).toBe(404);
    });
});
