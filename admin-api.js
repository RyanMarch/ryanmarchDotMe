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
 *
 * /health audits the *deployed* site: the bundled project data and redirects,
 * plus files read from the static-assets binding (a few subrequests per
 * project, so the UI audits one project per call).
 */

import {
    auditProjectHtml, auditProjectMeta, auditRedirects, auditSitemap, sortFindings, summarize
} from './public/assets/js/admin/audit.js';

import { ghJson, jsonResponse, safeBranch } from './admin-http.js';
import { handleActivity, handleBuild, handleHistory, handleImageDelete, handleLinks, handleNotFound, handleTrash, handleMedia, handleR2, handleScan, handleStatus } from './admin-site.js';

export { jsonResponse };

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

// `extra` narrows every dataset: by default bots are excluded (as in Cloudflare's own dashboard), and Tor (country code T1) can be hidden too.
export function analyticsQuery(withVisits, extra = ', bot: 0') {
    const sum = withVisits ? 'sum { visits }' : '';
    const f = `datetime_geq: $since, datetime_leq: $until, requestHost: $host${extra}`;
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
                prevDaily: rumPageloadEventsAdaptiveGroups(limit: 400, filter: { datetime_geq: $prevSince, datetime_lt: $since, requestHost: $host }, orderBy: [date_ASC]) {
                    count
                    ${sum}
                    dimensions { date }
                }
                current: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { ${f} }) {
                    count
                    ${sum}
                }
                botLoads: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $since, datetime_leq: $until, requestHost: $host, bot: 1 }) {
                    count
                }
                torLoads: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $since, datetime_leq: $until, requestHost: $host, bot: 0, countryName: "T1" }) {
                    count
                }
                previous: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { datetime_geq: $prevSince, datetime_lt: $since, requestHost: $host${extra} }) {
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

export function shapeAnalytics(account, { days, host, includeBots = false, hideTor = false }) {
    const group = g => ({ views: g?.count || 0, visits: g?.sum?.visits ?? null });
    const rows = (account.daily || []).map(g => ({
        date: g.dimensions?.date,
        views: g.count || 0,
        visits: g.sum?.visits ?? null
    }));
    const prevRows = (account.prevDaily || []).map(g => ({
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
        filters: { botsExcluded: !includeBots, torHidden: hideTor },
        botLoads: account.botLoads?.[0]?.count || 0,
        torLoads: account.torLoads?.[0]?.count || 0,
        totals: { current: group(account.current?.[0]), previous: group(account.previous?.[0]) },
        rows,
        prevRows,
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
    const includeBots = url.searchParams.get('bots') === 'include';
    const hideTor = url.searchParams.get('tor') === 'exclude';
    const extra = `${includeBots ? '' : ', bot: 0'}${hideTor ? ', countryName_neq: "T1"' : ''}`;

    const body = await cached(env, `analytics:${host}:${days}:${includeBots ? 'bots' : 'nobots'}:${hideTor ? 'notor' : 'tor'}`, 300, async () => {
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
            let result = await runGraphql(env, analyticsQuery(true, extra), vars, fetchImpl);
            // `visits` isn't available on every plan/dataset version; retry without it.
            if (!result.ok && /visits/i.test(JSON.stringify(result.data.errors || ''))) {
                result = await runGraphql(env, analyticsQuery(false, extra), vars, fetchImpl);
            }
            if (!result.ok) return { error: 'cloudflare_api_error', details: result.data.errors || result.data };
            const account = result.data?.data?.viewer?.accounts?.[0] || {};
            return shapeAnalytics(account, { days, host, includeBots, hideTor });
        } catch (err) {
            return { error: 'fetch_failed', message: err.message };
        }
    });
    return jsonResponse(body, body.error ? 502 : 200);
}

async function handleOverview(request, env, url, fetchImpl, projects) {
    const unpublished = projects.filter(p => p.unpublished).length;
    projects = projects.filter(p => !p.unpublished);
    const withWriteup = projects.filter(p => p.hasExtendedContent).length;
    const out = {
        projects: { total: projects.length, withWriteup, linkOnly: projects.length - withWriteup, unpublished },
        commits: null,
        pending: null
    };
    if (env.GITHUB_REPO && env.GITHUB_PAT) {
        const branch = safeBranch(url.searchParams.get('branch'));
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

const ID_PATTERN = /^[a-z0-9_-]+$/i;

async function assetExists(assetFetch, path) {
    try {
        const res = await assetFetch(`/${String(path).replace(/^\/+/, '').split(/[?#]/)[0]}`, 'HEAD');
        return res.ok;
    } catch {
        return false;
    }
}

async function handleHealth(request, env, url, fetchImpl, ctx) {
    // Unpublished projects are hidden from the site, so they are not audited (and a redirect to one is a broken target).
    const projects = ctx.projects.filter(p => !p.unpublished);
    const { redirects = [], assetFetch } = ctx;
    const scope = url.searchParams.get('scope');
    const projectId = url.searchParams.get('project');
    const withMeta = list => list.flatMap(p => auditProjectMeta(p));

    if (projectId) {
        const project = ID_PATTERN.test(projectId) && projects.find(p => p.id === projectId);
        if (!project) return jsonResponse({ error: 'not_found', message: `No project "${projectId}".` }, 404);
        if (!assetFetch) return jsonResponse({ error: 'not_configured', message: 'Asset access unavailable.' }, 501);

        const findings = auditProjectMeta(project);
        for (const [key, check, label] of [['image', 'card-image', 'Card image'], ['ogImage', 'og-image', 'OG image']]) {
            if (project[key] && !(await assetExists(assetFetch, project[key]))) {
                findings.push({ severity: 'error', check, id: project.id, message: `${label} file is missing: ${project[key]}` });
            }
        }
        if (project.hasExtendedContent) {
            try {
                const res = await assetFetch(`/content/${project.id}/`);
                if (!res.ok) findings.push({ severity: 'error', check: 'writeup-missing', id: project.id, message: `Write-up not found at /content/${project.id}/ (${res.status}).` });
                else findings.push(...auditProjectHtml(project, await res.text()));
            } catch (err) {
                findings.push({ severity: 'error', check: 'writeup-missing', id: project.id, message: `Could not read the write-up: ${err.message}` });
            }
        }
        const sorted = sortFindings(findings);
        return jsonResponse({ project: project.id, findings: sorted, counts: summarize(sorted) });
    }

    if (scope === 'site') {
        const findings = auditRedirects(redirects, projects);
        if (assetFetch) {
            try {
                const res = await assetFetch('/sitemap.xml');
                if (res.ok) findings.push(...auditSitemap(await res.text(), projects));
                else findings.push({ severity: 'error', check: 'sitemap-missing', id: 'sitemap.xml', message: `sitemap.xml could not be read (${res.status}).` });
            } catch { /* leave sitemap unchecked */ }
        }
        const sorted = sortFindings(findings);
        return jsonResponse({ findings: sorted, counts: summarize(sorted) });
    }

    // Default / scope=summary: everything that needs no file reads.
    const findings = sortFindings([...withMeta(projects), ...auditRedirects(redirects, projects)]);
    return jsonResponse({ findings, counts: summarize(findings), projects: projects.length });
}

/**
 * Returns a Response for /api/admin/{analytics,overview,health}, or null if the path
 * isn't one of ours.
 */
export async function handleAdminApi(request, env, url, cleanPath, { projects = [], redirects = [], assetFetch, fetchImpl = fetch } = {}) {
    // path -> [handler, allowed methods]
    const routes = {
        '/api/admin/analytics': [handleAnalytics, ['GET']],
        '/api/admin/overview': [handleOverview, ['GET']],
        '/api/admin/health': [handleHealth, ['GET']],
        '/api/admin/scan': [handleScan, ['GET']],
        '/api/admin/media': [handleMedia, ['GET']],
        '/api/admin/media/r2': [handleR2, ['PUT', 'DELETE']],
        '/api/admin/media/image': [handleImageDelete, ['DELETE']],
        '/api/admin/media/trash': [handleTrash, ['GET', 'POST', 'DELETE']],
        '/api/admin/activity': [handleActivity, ['GET']],
        '/api/admin/build': [handleBuild, ['GET']],
        '/api/admin/links': [handleLinks, ['GET']],
        '/api/admin/history': [handleHistory, ['GET']],
        '/api/admin/notfound': [handleNotFound, ['GET', 'DELETE']],
        '/api/admin/status': [handleStatus, ['GET']]
    };
    const entry = routes[cleanPath];
    if (!entry) return null;

    if (!(await isAdminRequest(request, env, fetchImpl))) return new Response('Unauthorized', { status: 401 });
    if (!entry[1].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
    if (request.method !== 'GET' && !sameOrigin(request, url)) return new Response('Forbidden', { status: 403 });

    const [handler] = entry;
    if (handler === handleOverview) return handler(request, env, url, fetchImpl, projects);
    if (handler === handleHealth) return handler(request, env, url, fetchImpl, { projects, redirects, assetFetch });
    if (handler === handleScan) return handler(request, env, url, fetchImpl, { projects, assetFetch });
    if (handler === handleImageDelete) return handler(request, env, url, fetchImpl, { projects });
    if (handler === handleLinks) return handler(request, env, url, fetchImpl, { projects, assetFetch });
    if (handler === handleNotFound) return handler(request, env, url, fetchImpl, { projects, redirects });
    return handler(request, env, url, fetchImpl);
}

/** State-changing requests must come from this site (cookies alone must not be enough). */
export function sameOrigin(request, url) {
    const origin = request.headers.get('Origin');
    return !origin || origin === url.origin;
}
