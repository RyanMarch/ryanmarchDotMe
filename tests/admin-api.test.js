import { describe, it, expect, vi } from 'vitest';
import { handleAdminApi, isAdminRequest, shapeAnalytics, verifyAccessJwt } from '../admin-api.js';
import { fillDays, chartSvg, pageLabel } from '../public/assets/js/admin/analytics.js';
import { esc, deltaText } from '../public/assets/js/admin/util.js';
import { myProjects } from '../public/assets/js/project-data.js';

const URL_BASE = 'https://ryanmarch.me';
const req = (path, headers = {}, method = 'GET') => new Request(`${URL_BASE}${path}`, { method, headers });
const call = (path, env, opts = {}, headers = { Authorization: 'Bearer pw' }) => {
    const url = new URL(`${URL_BASE}${path}`);
    return handleAdminApi(req(path, headers), env, url, url.pathname, opts);
};
const baseEnv = { ADMIN_PASSWORD: 'pw' };

describe('admin API auth', () => {
    it('ignores paths it does not own', async () => {
        expect(await call('/api/admin/file', baseEnv)).toBeNull();
    });

    it('rejects unauthenticated and non-GET requests', async () => {
        expect((await call('/api/admin/analytics', baseEnv, {}, {})).status).toBe(401);
        expect((await call('/api/admin/analytics', baseEnv, {}, { Authorization: 'Bearer nope' })).status).toBe(401);
        const url = new URL(`${URL_BASE}/api/admin/overview`);
        const post = await handleAdminApi(req('/api/admin/overview', { Authorization: 'Bearer pw' }, 'POST'), baseEnv, url, url.pathname);
        expect(post.status).toBe(405);
    });

    it('accepts Access headers by default and the password fallback', async () => {
        expect(await isAdminRequest(req('/', { 'cf-access-authenticated-user-email': 'a@b.c' }), {})).toBe(true);
        expect(await isAdminRequest(req('/', { Authorization: 'Bearer pw' }), baseEnv)).toBe(true);
        expect(await isAdminRequest(req('/'), baseEnv)).toBe(false);
    });

    it('requires a verifiable JWT once Access verification is configured', async () => {
        const env = { CF_ACCESS_TEAM_DOMAIN: 'team', CF_ACCESS_AUD: 'aud123' };
        // A forged header with an email alone is no longer enough.
        expect(await isAdminRequest(req('/', { 'cf-access-authenticated-user-email': 'a@b.c' }), env)).toBe(false);
        expect(await isAdminRequest(req('/', { 'cf-access-jwt-assertion': 'not.a.jwt' }), env)).toBe(false);
    });
});

describe('verifyAccessJwt', () => {
    const b64u = buf => Buffer.from(buf).toString('base64url');
    async function makeJwt({ aud = 'aud123', exp = Math.floor(Date.now() / 1000) + 600, kid = 'k1', tamper = false } = {}) {
        const pair = await crypto.subtle.generateKey(
            { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
        const h = b64u(JSON.stringify({ alg: 'RS256', kid }));
        const p = b64u(JSON.stringify({ aud: [aud], exp }));
        const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`));
        const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid };
        const token = `${h}.${p}.${b64u(tamper ? new Uint8Array(256) : sig)}`;
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ keys: [jwk] })));
        return { token, fetchImpl };
    }
    const env = { CF_ACCESS_TEAM_DOMAIN: 'team', CF_ACCESS_AUD: 'aud123' };

    it('accepts a valid signature, audience and expiry', async () => {
        const { token, fetchImpl } = await makeJwt();
        expect(await verifyAccessJwt(token, env, fetchImpl)).toBe(true);
    });
    it('rejects wrong audience, expired, and tampered tokens', async () => {
        for (const opts of [{ aud: 'other' }, { exp: 1 }, { tamper: true }]) {
            const { token, fetchImpl } = await makeJwt(opts);
            expect(await verifyAccessJwt(token, env, fetchImpl)).toBe(false);
        }
    });
});

describe('/api/admin/analytics', () => {
    it('returns 501 with guidance when secrets are missing', async () => {
        const res = await call('/api/admin/analytics', baseEnv);
        expect(res.status).toBe(501);
        expect((await res.json()).error).toBe('not_configured');
    });

    it('queries Cloudflare, shapes the response, and caches in KV', async () => {
        const store = new Map();
        const env = {
            ...baseEnv, CF_API_TOKEN: 't', CF_ACCOUNT_ID: 'acct',
            ADMIN_KV: { get: async k => (store.has(k) ? JSON.parse(store.get(k)) : null), put: async (k, v) => store.set(k, v) }
        };
        const account = {
            daily: [{ count: 5, sum: { visits: 3 }, dimensions: { date: '2026-11-20' } }],
            current: [{ count: 5, sum: { visits: 3 } }],
            previous: [{ count: 2, sum: { visits: 1 } }],
            paths: [{ count: 4, dimensions: { requestPath: '/project/ledger/' } }],
            referrers: [{ count: 2, dimensions: { refererHost: '' } }],
            countries: [], devices: [],
            performance: [{ count: 1, avg: { firstContentfulPaint: 900000, pageLoadTime: 1500000 } }],
            vitals: [{ count: 9, avg: { largestContentfulPaint: 2100000, cumulativeLayoutShift: 0.0123, interactionToNextPaint: 120000 } }]
        };
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { viewer: { accounts: [account] } } })));

        const res = await call('/api/admin/analytics?days=7', env, { fetchImpl });
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.totals.current).toEqual({ views: 5, visits: 3 });
        expect(body.referrers[0].label).toBe('Direct / none');
        expect(body.vitals).toMatchObject({ lcp_ms: 2100, inp_ms: 120, cls: 0.012, fcp_ms: 900 });

        const sent = JSON.parse(fetchImpl.mock.calls[0][1].body);
        expect(sent.variables).toMatchObject({ accountTag: 'acct', host: 'ryanmarch.me' });
        expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer t');

        const again = await (await call('/api/admin/analytics?days=7', env, { fetchImpl })).json();
        expect(again.cached).toBe(true);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('retries without the visits field when Cloudflare rejects it', async () => {
        const env = { ...baseEnv, CF_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' };
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ errors: [{ message: 'unknown field "visits"' }] })))
            .mockResolvedValueOnce(new Response(JSON.stringify({ data: { viewer: { accounts: [{ daily: [], current: [{ count: 1 }], previous: [] }] } } })));
        const res = await call('/api/admin/analytics', env, { fetchImpl });
        expect(res.status).toBe(200);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(JSON.parse(fetchImpl.mock.calls[1][1].body).query).not.toContain('visits');
        expect((await res.json()).totals.current.visits).toBeNull();
    });

    it('surfaces Cloudflare errors as 502', async () => {
        const env = { ...baseEnv, CF_API_TOKEN: 't', CF_ACCOUNT_ID: 'a' };
        const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'denied' }] }), { status: 403 }));
        expect((await call('/api/admin/analytics', env, { fetchImpl })).status).toBe(502);
    });
});

describe('/api/admin/overview', () => {
    it('counts projects without needing GitHub', async () => {
        const projects = [{ hasExtendedContent: true }, { hasExtendedContent: false }, { hasExtendedContent: true }];
        const body = await (await call('/api/admin/overview', baseEnv, { projects })).json();
        expect(body.projects).toEqual({ total: 3, withWriteup: 2, linkOnly: 1 });
        expect(body.commits).toBeNull();
    });

    it('returns recent commits and the develop-vs-main gap', async () => {
        const env = { ...baseEnv, GITHUB_REPO: 'o/r', GITHUB_PAT: 'x' };
        const fetchImpl = vi.fn(async url => String(url).includes('/compare/')
            ? new Response(JSON.stringify({ ahead_by: 3, behind_by: 0 }))
            : new Response(JSON.stringify([{ sha: 'abcdef123456', html_url: 'https://gh/c', commit: { message: 'Add thing\n\nbody', author: { name: 'R', date: '2026-11-20T00:00:00Z' } } }])));
        const body = await (await call('/api/admin/overview?branch=develop', env, { fetchImpl })).json();
        expect(body.commits[0]).toMatchObject({ sha: 'abcdef1', message: 'Add thing', author: 'R' });
        expect(body.pending).toEqual({ ahead: 3, behind: 0 });
        expect(String(fetchImpl.mock.calls[0][0])).toContain('sha=develop');
    });

    it('ignores a malformed branch parameter', async () => {
        const env = { ...baseEnv, GITHUB_REPO: 'o/r', GITHUB_PAT: 'x' };
        const fetchImpl = vi.fn(async () => new Response('[]'));
        await call('/api/admin/overview?branch=a%20b;rm', env, { fetchImpl });
        expect(String(fetchImpl.mock.calls[0][0])).toContain('sha=main');
    });
});

describe('admin frontend helpers', () => {
    it('escapes untrusted strings', () => {
        expect(esc('<img src=x onerror="a">&\'')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
    });
    it('describes period-over-period change', () => {
        expect(deltaText(150, 100, 'prior')).toBe('+50% vs prior');
        expect(deltaText(50, 100, 'prior')).toBe('−50% vs prior');
        expect(deltaText(5, 0, 'prior')).toBe('new vs prior');
    });
    it('fills missing days with zero and renders one bar per day', () => {
        const series = fillDays([], 7);
        expect(series).toHaveLength(7);
        expect(series.every(s => s.views === 0)).toBe(true);
        expect(chartSvg(series).match(/class="hit"/g)).toHaveLength(7);
    });
    it('labels project pages with their titles and escapes unknown paths', () => {
        globalThis.myProjects = myProjects;
        expect(pageLabel('/project/ledger/')).toContain('Ledger');
        expect(pageLabel('/<script>')).not.toContain('<script>');
    });
    it('shapeAnalytics tolerates an empty account', () => {
        expect(shapeAnalytics({}, { days: 7, host: 'h' }).rows).toEqual([]);
    });
});
