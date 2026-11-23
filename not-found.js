/**
 * Remembers which page addresses visitors asked for that don't exist, so the admin can offer to redirect them.
 * Stored as one small JSON index in the ADMIN_KV namespace. Writes are rationed: a brand-new address is saved
 * right away (within a budget), repeats are counted in memory and saved at most every few minutes.
 */

export const KEY = 'notfound:v1';
export const CAP = 150; // addresses kept
const FLUSH_MS = 10 * 60 * 1000;
const NEW_PATH_BUDGET_PER_HOUR = 20;
const MAX_PATH = 160;

// Scanners probing for software the site doesn't run; not worth a redirect.
const PROBE = /(^|\/)(wp-[^/]*|xmlrpc[^/]*|phpmyadmin|cgi-bin|administrator|\.env|\.git|\.well-known|vendor|node_modules|actuator|boaform)(\/|$)|\.(php\d?|asp|aspx|jsp|cgi|env|ini|bak|sql|zip|tar|gz|rar|7z|exe|log|yml|yaml|json|xml|txt)$/i;
// Anything with a file extension other than .html is an asset (an image, a script), not a page.
const ASSET_LIKE = /\.(?!html?$)[a-z0-9]{1,6}$/i;
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl\/|wget|python|go-http|scrapy|headless|scan/i;

/** "/Old-Page/" → "/old-page" (redirects are matched case-insensitively, without a trailing slash). */
export function normalizeNotFound(path) {
    const clean = String(path || '').trim().toLowerCase().replace(/\/+$/, '');
    return clean === '' ? '/' : clean;
}

/** Is this 404 a person following a broken link (worth showing), rather than a scanner or a missing asset? */
export function shouldRecord({ method, path, userAgent }) {
    if (method !== 'GET') return false;
    if (!path || path.length > MAX_PATH || !path.startsWith('/') || path.includes('..')) return false;
    if (PROBE.test(path) || ASSET_LIKE.test(path)) return false;
    if (userAgent && BOT_UA.test(userAgent)) return false;
    return true;
}

/** Folds counts gathered in memory into the saved index, keeping the busiest CAP addresses. */
export function mergeIndex(index, pending, now, cap = CAP) {
    const items = { ...(index?.items || {}) };
    for (const [path, add] of pending) {
        const cur = items[path];
        items[path] = { n: (cur?.n || 0) + add.n, first: cur?.first || now, last: now, ref: add.ref || cur?.ref || '' };
    }
    const keep = Object.entries(items)
        .sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)
        .slice(0, cap);
    return { since: index?.since || now, items: Object.fromEntries(keep) };
}

// Per-isolate state (it resets whenever the Worker restarts, which only loses a few counts).
const pending = new Map();
const seen = new Set();
let lastFlush = 0;
let budgetWindowStart = 0;
let budgetUsed = 0;

async function flush(env) {
    if (!pending.size) return;
    const batch = new Map(pending);
    pending.clear();
    try {
        const current = await env.ADMIN_KV.get(KEY, 'json');
        await env.ADMIN_KV.put(KEY, JSON.stringify(mergeIndex(current, batch, Date.now())), { expirationTtl: 60 * 60 * 24 * 60 });
    } catch {
        // Best effort: a failed save just loses this batch of counts.
    }
}

/** Call when the Worker is about to answer 404. Never delays or breaks the response. */
export function recordNotFound(env, ctx, request) {
    try {
        if (!env.ADMIN_KV) return;
        const url = new URL(request.url);
        if (!shouldRecord({ method: request.method, path: url.pathname, userAgent: request.headers.get('user-agent') || '' })) return;
        const path = normalizeNotFound(url.pathname);
        let ref = '';
        try {
            const host = new URL(request.headers.get('referer') || '').host;
            if (host && host !== url.host) ref = host;
        } catch { /* no referrer */ }

        const entry = pending.get(path) || { n: 0, ref: '' };
        entry.n += 1;
        if (ref) entry.ref = ref;
        pending.set(path, entry);

        const now = Date.now();
        if (now - budgetWindowStart > 3600 * 1000) { budgetWindowStart = now; budgetUsed = 0; }
        const isNew = !seen.has(path);
        seen.add(path);
        if (seen.size > 500) seen.clear();
        if (isNew && budgetUsed < NEW_PATH_BUDGET_PER_HOUR) { budgetUsed += 1; lastFlush = now; ctx?.waitUntil(flush(env)); return; }
        if (now - lastFlush > FLUSH_MS) { lastFlush = now; ctx?.waitUntil(flush(env)); }
    } catch {
        // Recording is optional.
    }
}
