/**
 * Admin API for ryanmarch.me. Everything under /api/admin/* except the
 * GitHub file proxy (still in worker.js) lives here.
 *
 * Auth model: Cloudflare Access sits in front of /admin* and /api/admin/*.
 * By default we trust the presence of Access's headers (existing behavior).
 * If CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD are set, the Access JWT is
 * cryptographically verified instead, so a forged header is not enough.
 * ADMIN_PASSWORD (Bearer) remains the local-dev fallback.
 *
 * Secrets / bindings (all optional; endpoints degrade gracefully):
 *   CF_API_TOKEN, CF_ACCOUNT_ID   Account Analytics:Read, for /analytics
 *   CF_ANALYTICS_HOST             hostname to query (default ryanmarch.me)
 *   GITHUB_REPO, GITHUB_PAT       for /overview
 *   ADMIN_KV                      KV namespace, caches analytics responses
 */

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
};

export function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function base64UrlToBytes(str) {
    const pad = '='.repeat((4 - (str.length % 4)) % 4);
    const bin = atob((str + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, c => c.charCodeAt(0));
}

function decodeJwtPart(part) {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

/** Verifies a Cloudflare Access JWT (RS256) against the team's published keys. */
export async function verifyAccessJwt(token, env, fetchImpl = fetch) {
    try {
        const [h, p, s] = token.split('.');
        if (!h || !p || !s) return false;
        const header = decodeJwtPart(h);
        const payload = decodeJwtPart(p);
        if (header.alg !== 'RS256') return false;
        if (payload.exp && payload.exp * 1000 < Date.now()) return false;
        const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!aud.includes(env.CF_ACCESS_AUD)) return false;

        const certsRes = await fetchImpl(`https://${env.CF_ACCESS_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/certs`);
        if (!certsRes.ok) return false;
        const { keys = [] } = await certsRes.json();
        const jwk = keys.find(k => k.kid === header.kid);
        if (!jwk) return false;

        const key = await crypto.subtle.importKey(
            'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
        );
        return await crypto.subtle.verify(
            'RSASSA-PKCS1-v1_5', key, base64UrlToBytes(s), new TextEncoder().encode(`${h}.${p}`)
        );
    } catch {
        return false;
    }
}

/** True when the request comes from the signed-in admin. */
export async function isAdminRequest(request, env, fetchImpl = fetch) {
    const authHeader = request.headers.get('Authorization');
    if (env.ADMIN_PASSWORD && authHeader === `Bearer ${env.ADMIN_PASSWORD}`) return true;

    const cfJwt = request.headers.get('cf-access-jwt-assertion');
    const cfEmail = request.headers.get('cf-access-authenticated-user-email');

    if (env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) {
        return cfJwt ? verifyAccessJwt(cfJwt, env, fetchImpl) : false;
    }
    return Boolean(cfJwt || cfEmail);
}

async function cached(env, key, ttl, producer) {
    if (env.ADMIN_KV) {
        try {
            const hit = await env.ADMIN_KV.get(key, 'json');
            if (hit) return { ...hit, cached: true };
        } catch { /* cache is best-effort */ }
    }
    const fresh = await producer();
    if (env.ADMIN_KV && fresh && !fresh.error) {
        try {
            await env.ADMIN_KV.put(key, JSON.stringify(fresh), { expirationTtl: ttl });
        } catch { /* cache is best-effort */ }
    }
    return fresh;
}

const toMs = v => (v === undefined || v === null || v < 0 ? null : Math.round(v > 1000 ? v / 1000 : v));

function analyticsQuery(withVisits) {
    const sum = withVisits ? 'sum { visits }' : '';
    const f = 'datetime_geq: $since, datetime_leq: $until, requestHost: $host';
    const top = (alias, dim) => `
        ${alias}: rumPageloadEventsAdaptiveGroups(limit: 10, filter: { ${f} }, orderBy: [count_DESC]) {
            count
            dimensions { ${dim} }
        }`;
    return `
    query($accountTag: string!, $since: string!, $until: string!, $prevSince: string!, $host: string!) {
        viewer {
            accounts(filter: { accountTag: $accountTag }) {
                daily: rumPageloadEventsAdaptiveGroups(limit: 400, filter: { ${f} }, orderBy: [date_ASC]) {
                    count
                    ${sum}
                    dimensions { date }
                }
                current: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { ${f} }) {
                    count
                    ${sum}
                }
                previous: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $prevSince, datetime_lt: $since, requestHost: $host }) {
                    count
                    ${sum}
                }
                ${top('paths', 'requestPath')}
                ${top('referrers', 'refererHost')}
                ${top('countries', 'countryName')}
                ${top('devices', 'deviceType')}
                performance: rumPerformanceEventsAdaptiveGroups(limit: 1, filter: { ${f} }) {
                    count
                    avg { pageLoadTime firstContentfulPaint }
                }
                vitals: rumWebVitalsEventsAdaptiveGroups(limit: 1, filter: { ${f} }) {
                    count
                    avg { largestContentfulPaint cumulativeLayoutShift interactionToNextPaint }
                }
            }
        }
    }`;
}

async function runGraphql(env, query, variables, fetchImpl) {
    const res = await fetchImpl('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.CF_API_TOKEN}`
        },
        body: JSON.stringify({ query, variables })
    });
    const data = await res.json();
    return { ok: res.ok && !data.errors, data };
}

export function shapeAnalytics(account, { days, host }) {
    const group = g => ({ views: g?.count || 0, visits: g?.sum?.visits ?? null });
    const rows = (account.daily || []).map(g => ({
        date: g.dimensions?.date,
        views: g.count || 0,
        visits: g.sum?.visits ?? null
    }));
    const list = (arr, key, fallback) => (arr || []).map(g => ({
        label: (g.dimensions?.[key] || '').trim() || fallback,
        count: g.count || 0
    }));
    const perf = account.performance?.[0]?.avg || {};
    const vit = account.vitals?.[0]?.avg || {};
    const cls = vit.cumulativeLayoutShift;
    return {
        days,
        host,
        totals: { current: group(account.current?.[0]), previous: group(account.previous?.[0]) },
        rows,
        paths: list(account.paths, 'requestPath', '/'),
        referrers: list(account.referrers, 'refererHost', 'Direct / none'),
        countries: list(account.countries, 'countryName', 'Unknown'),
        devices: list(account.devices, 'deviceType', 'Unknown'),
        vitals: {
            samples: account.vitals?.[0]?.count || 0,
            lcp_ms: toMs(vit.largestContentfulPaint),
            cls: cls !== undefined && cls !== null && cls >= 0 ? Math.round(cls * 1000) / 1000 : null,
            inp_ms: toMs(vit.interactionToNextPaint),
            fcp_ms: toMs(perf.firstContentfulPaint),
            load_ms: toMs(perf.pageLoadTime)
        }
    };
}

async function handleAnalytics(request, env, url, fetchImpl) {
    if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) {
        return jsonResponse({
            error: 'not_configured',
            message: 'Set CF_API_TOKEN (Account Analytics: Read) and CF_ACCOUNT_ID as Worker secrets to enable analytics.'
        }, 501);
    }
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days'), 10) || 30, 1), 365);
    const host = env.CF_ANALYTICS_HOST || 'ryanmarch.me';

    const body = await cached(env, `analytics:${host}:${days}`, 300, async () => {
        const now = Date.now();
        const day = 86400 * 1000;
        const vars = {
            accountTag: env.CF_ACCOUNT_ID,
            host,
            until: new Date(now).toISOString(),
            since: new Date(now - days * day).toISOString(),
            prevSince: new Date(now - 2 * days * day).toISOString()
        };
        try {
            let result = await runGraphql(env, analyticsQuery(true), vars, fetchImpl);
            // `visits` isn't available on every plan/dataset version; retry without it.
            if (!result.ok && /visits/i.test(JSON.stringify(result.data.errors || ''))) {
                result = await runGraphql(env, analyticsQuery(false), vars, fetchImpl);
            }
            if (!result.ok) return { error: 'cloudflare_api_error', details: result.data.errors || result.data };
            const account = result.data?.data?.viewer?.accounts?.[0] || {};
            return shapeAnalytics(account, { days, host });
        } catch (err) {
            return { error: 'fetch_failed', message: err.message };
        }
    });
    return jsonResponse(body, body.error ? 502 : 200);
}

async function ghJson(env, path, fetchImpl) {
    const res = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/${path}`, {
        headers: {
            'Authorization': `token ${env.GITHUB_PAT}`,
            'User-Agent': `${env.GITHUB_REPO.split('/').pop()}-Cloudflare-Worker`,
            'Accept': 'application/vnd.github+json'
        }
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    return res.json();
}

async function handleOverview(request, env, url, fetchImpl, projects) {
    const withWriteup = projects.filter(p => p.hasExtendedContent).length;
    const out = {
        projects: { total: projects.length, withWriteup, linkOnly: projects.length - withWriteup },
        commits: null,
        pending: null
    };
    if (env.GITHUB_REPO && env.GITHUB_PAT) {
        const branch = /^[\w./-]+$/.test(url.searchParams.get('branch') || '') ? url.searchParams.get('branch') : 'main';
        try {
            const commits = await ghJson(env, `commits?sha=${encodeURIComponent(branch)}&per_page=8`, fetchImpl);
            out.branch = branch;
            out.commits = commits.map(c => ({
                sha: c.sha.slice(0, 7),
                message: (c.commit.message || '').split('\n')[0],
                author: c.commit.author?.name || '',
                date: c.commit.author?.date,
                url: c.html_url
            }));
        } catch (err) {
            out.commitsError = err.message;
        }
        try {
            const cmp = await ghJson(env, 'compare/main...develop', fetchImpl);
            out.pending = { ahead: cmp.ahead_by, behind: cmp.behind_by };
        } catch { /* develop may not exist */ }
    }
    return jsonResponse(out);
}

/**
 * Returns a Response for /api/admin/{analytics,overview}, or null if the path
 * isn't one of ours.
 */
export async function handleAdminApi(request, env, url, cleanPath, { projects = [], fetchImpl = fetch } = {}) {
    const route = { '/api/admin/analytics': handleAnalytics, '/api/admin/overview': handleOverview }[cleanPath];
    if (!route) return null;

    if (!(await isAdminRequest(request, env, fetchImpl))) return new Response('Unauthorized', { status: 401 });
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
    return route === handleOverview
        ? route(request, env, url, fetchImpl, projects)
        : route(request, env, url, fetchImpl);
}
