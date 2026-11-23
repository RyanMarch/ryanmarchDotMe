/**
 * Google Search Console (read-only) for the admin's Search page.
 *
 * Secrets: GSC_SERVICE_ACCOUNT  the service account's JSON key, as one string
 *          GSC_SITE             the property, e.g. "sc-domain:ryanmarch.me" (default) or "https://ryanmarch.me/"
 * The service account's e-mail must be added as a (restricted) user on the property in Search Console.
 */

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DAY = 86400000;

const b64url = input => {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function parseServiceAccount(raw) {
    try {
        const k = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return k && k.client_email && k.private_key ? k : null;
    } catch { return null; }
}

async function signJwt(key, now) {
    const pem = key.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(`${head}.${claims}`));
    return `${head}.${claims}.${b64url(sig)}`;
}

let tokenCache = null;
async function accessToken(key, fetchImpl) {
    const now = Math.floor(Date.now() / 1000);
    if (tokenCache && tokenCache.email === key.client_email && tokenCache.exp > now + 60) return tokenCache.token;
    const res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signJwt(key, now) })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
    tokenCache = { email: key.client_email, token: body.access_token, exp: now + (body.expires_in || 3600) };
    return tokenCache.token;
}

const iso = ms => new Date(ms).toISOString().slice(0, 10);

/** Search Console data lags about two days, so the window ends then. */
export function windows(days, now = Date.now()) {
    const end = now - 2 * DAY;
    const start = end - (days - 1) * DAY;
    const prevEnd = start - DAY;
    return { start: iso(start), end: iso(end), prevStart: iso(prevEnd - (days - 1) * DAY), prevEnd: iso(prevEnd) };
}

/** Google reports http://, www and https:// variants of one page separately; fold them into one path. */
export function pathOf(url) {
    try { const u = new URL(url); return u.pathname || '/'; } catch { return url; }
}

/** Merge rows that share a key, summing clicks and impressions and averaging position by impressions. */
export function mergeRows(rows, keyOf) {
    const by = new Map();
    for (const r of rows) {
        const k = keyOf(r);
        const m = by.get(k) || { ...r, clicks: 0, impressions: 0, weighted: 0 };
        m.clicks += r.clicks; m.impressions += r.impressions; m.weighted += r.position * r.impressions;
        by.set(k, m);
    }
    return [...by.values()].map(({ weighted, ...m }) => ({ ...m, ctr: m.impressions ? m.clicks / m.impressions : 0, position: m.impressions ? weighted / m.impressions : 0 }));
}

const row = r => ({ keys: r.keys, clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position || 0 });

/**
 * Queries that already show on page 1-2 of Google with plenty of impressions but few clicks: the cheapest
 * wins, usually fixed by a better title or description.
 */
export function nearMisses(rows, { minImpressions = 20, limit = 12 } = {}) {
    return rows
        .filter(r => r.position >= 5 && r.position <= 20 && r.impressions >= minImpressions)
        .map(r => ({ query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
        .sort((a, b) => b.impressions * (1 - b.ctr) - a.impressions * (1 - a.ctr))
        .slice(0, limit);
}

export async function fetchSearchData(env, days, fetchImpl = fetch) {
    const key = parseServiceAccount(env.GSC_SERVICE_ACCOUNT);
    if (!key) return { configured: false };
    const site = env.GSC_SITE || 'sc-domain:ryanmarch.me';
    const token = await accessToken(key, fetchImpl);
    const w = windows(days);
    const query = async (startDate, endDate, dimensions, rowLimit = 250) => {
        const res = await fetchImpl(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, dimensions, rowLimit })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = body.error?.message || `HTTP ${res.status}`;
            throw new Error(res.status === 403 ? `${msg} Add the service account's e-mail as a user on ${site} in Search Console.` : msg);
        }
        return (body.rows || []).map(row);
    };
    const [daily, queries, pages, pairs, prev] = await Promise.all([
        query(w.start, w.end, ['date'], 1000),
        query(w.start, w.end, ['query']),
        query(w.start, w.end, ['page']),
        query(w.start, w.end, ['query', 'page'], 1000),
        query(w.prevStart, w.prevEnd, ['date'], 1000)
    ]);
    const total = rows => {
        const clicks = rows.reduce((n, r) => n + r.clicks, 0);
        const impressions = rows.reduce((n, r) => n + r.impressions, 0);
        const position = impressions ? rows.reduce((n, r) => n + r.position * r.impressions, 0) / impressions : 0;
        return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position };
    };
    return {
        configured: true, site, days, range: { start: w.start, end: w.end },
        totals: { current: total(daily), previous: total(prev) },
        daily: daily.map(r => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
        queries: queries.map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
        pages: mergeRows(pages.map(r => ({ page: pathOf(r.keys[0]), clicks: r.clicks, impressions: r.impressions, position: r.position })), r => r.page)
            .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions),
        pairs: mergeRows(pairs.map(r => ({ query: r.keys[0], page: pathOf(r.keys[1]), clicks: r.clicks, impressions: r.impressions, position: r.position })), r => `${r.query}\n${r.page}`),
        nearMisses: nearMisses(mergeRows(pairs.map(r => ({ keys: [r.keys[0], pathOf(r.keys[1])], clicks: r.clicks, impressions: r.impressions, position: r.position })), r => r.keys.join('\n')))
    };
}

/**
 * Asks Google whether one address is indexed (URL Inspection API; about 2,000 a day).
 * Returns { state: 'indexed' | 'not-indexed' | 'unknown', ... } with the details worth showing.
 */
export async function inspectUrl(env, pageUrl, fetchImpl = fetch) {
    const key = parseServiceAccount(env.GSC_SERVICE_ACCOUNT);
    if (!key) return { configured: false };
    const token = await accessToken(key, fetchImpl);
    const res = await fetchImpl('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionUrl: pageUrl, siteUrl: env.GSC_SITE || 'sc-domain:ryanmarch.me' })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error?.message || `HTTP ${res.status}`);
    return summarizeInspection(pageUrl, body.inspectionResult);
}

export function summarizeInspection(url, r = {}) {
    const ix = r.indexStatusResult || {};
    const state = ix.verdict === 'PASS' ? 'indexed' : ix.verdict === 'FAIL' || ix.verdict === 'NEUTRAL' ? 'not-indexed' : 'unknown';
    return {
        url, state, checked: Date.now(),
        coverage: ix.coverageState || '',
        lastCrawl: ix.lastCrawlTime || null,
        crawledAs: ix.crawledAs || null,
        googleCanonical: ix.googleCanonical || null,
        userCanonical: ix.userCanonical || null,
        canonicalMismatch: Boolean(ix.googleCanonical && ix.userCanonical && ix.googleCanonical !== ix.userCanonical),
        robots: ix.robotsTxtState || null,
        pageFetch: ix.pageFetchState || null,
        mobile: r.mobileUsabilityResult?.verdict || null
    };
}
