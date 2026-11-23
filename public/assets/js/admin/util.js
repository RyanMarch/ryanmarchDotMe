// Small helpers shared by the admin views.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape untrusted text (referrers, commit messages, paths) for innerHTML. */
export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);

const nf = new Intl.NumberFormat('en-US');
export const fmt = n => (n === null || n === undefined ? '–' : nf.format(n));

/** "+12%" / "−5%" / "no prior data" relative to a previous-period value. */
export function deltaText(current, previous, label) {
    if (!previous) return previous === 0 && current > 0 ? `new vs ${label}` : `no data for ${label}`;
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return `flat vs ${label}`;
    return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% vs ${label}`;
}

export function relativeTime(iso) {
    const t = Date.parse(iso);
    if (!t) return '';
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** GET an admin API route using whatever auth the editor script holds. */
export async function api(path, { signal } = {}) {
    const headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
    let res;
    try {
        res = await fetch(path, { headers, signal, credentials: 'same-origin' });
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        return { ok: false, status: 0, body: { error: 'network', message: err.message } };
    }
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON error body */ }
    return { ok: res.ok, status: res.status, body };
}

/** One-line explanation for a failed api() result. */
export function apiProblem(result) {
    const { status, body } = result;
    if (status === 401) return 'Not authorized. Sign in again.';
    if (status === 404) return 'This endpoint is not available here. The local Python server only serves the editor; run npm run dev to see analytics and dashboard data.';
    if (body && body.message) return body.message;
    if (body && body.error === 'cloudflare_api_error') return 'Cloudflare returned an error for the analytics query. Check the API token scope (Account Analytics: Read).';
    return `Request failed (${status || 'network'}).`;
}

export const SETUP_COMMANDS = `npx wrangler secret put CF_API_TOKEN
npx wrangler secret put CF_ACCOUNT_ID`;

/** The "analytics not configured" notice, shared by dashboard and analytics. */
export function setupNotice() {
    return `<div class="notice">
        <strong>Analytics needs two Worker secrets.</strong>
        Create an API token with <code>Account Analytics: Read</code>, then add it and your account ID:
        <pre>${esc(SETUP_COMMANDS)}</pre>
    </div>`;
}

/** Ranked table: label, count and share of the total, with a hairline share bar. */
export function dataTable(items, { render = item => esc(item.label), head = 'Item', unit = 'Views', total } = {}) {
    if (!items || !items.length) return '<p class="empty-note">No data in this range.</p>';
    const sum = total || items.reduce((n, i) => n + i.count, 0) || 1;
    const max = Math.max(...items.map(i => i.count), 1);
    return `<table class="dt"><thead><tr><th scope="col">${esc(head)}</th><th scope="col" class="n">${esc(unit)}</th><th scope="col" class="n share-col">Share</th></tr></thead><tbody>${items.map(item => {
        const pct = (item.count / sum) * 100;
        return `<tr><td class="lbl"><div class="lbl-text">${render(item)}</div><div class="track"><span style="width:${Math.max(1, Math.round((item.count / max) * 100))}%"></span></div></td><td class="n">${fmt(item.count)}</td><td class="n share-col">${pct < 1 ? '<1' : Math.round(pct)}%</td></tr>`;
    }).join('')}</tbody></table>`;
}

/* ───────────── Instant revisits: show the last answer now, refresh it in the background ───────────── */

const CACHE = new Map(); // path -> { at, result }
const INFLIGHT = new Map(); // path -> Promise
const KEEP_MS = 30 * 60 * 1000;

// Any change made through the admin API (save, upload, delete, publish) makes every cached answer suspect.
if (typeof window !== 'undefined' && !window.__adminFetchPatched) {
    window.__adminFetchPatched = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
        const method = String(init?.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();
        const url = typeof input === 'string' ? input : input?.url || '';
        if (method !== 'GET' && url.includes('/api/admin/')) CACHE.clear();
        return nativeFetch(input, init);
    };
}

export const hasCached = path => { const e = CACHE.get(path); return Boolean(e && Date.now() - e.at < KEEP_MS); };
export const clearApiCache = () => CACHE.clear();

function fetchAndStore(path) {
    if (INFLIGHT.has(path)) return INFLIGHT.get(path);
    const p = api(path).then(result => {
        if (result.ok) CACHE.set(path, { at: Date.now(), result });
        return result;
    }).finally(() => INFLIGHT.delete(path));
    INFLIGHT.set(path, p);
    return p;
}

/** Start loading a path ahead of time (for a hover or focus on a link). Does nothing if it is fresh. */
export function warm(path) {
    const e = CACHE.get(path);
    if (e && Date.now() - e.at < 20000) return;
    fetchAndStore(path).catch(() => {});
}

/**
 * Loads one or more API paths and calls render(results). If every path was loaded before, render runs
 * straight away with the old answers and this call returns; the refresh then runs in the background and
 * calls render again only if the fresh answers differ.
 * `signal.aborted` (a newer request replaced this one) silences any late render.
 */
export async function swr(paths, render, { signal } = {}) {
    const cached = paths.map(p => { const e = CACHE.get(p); return e && Date.now() - e.at < KEEP_MS ? e.result : null; });
    if (cached.every(Boolean)) {
        render(cached, { stale: true });
        // Refresh in the background; this call has already returned the old answer.
        Promise.all(paths.map(fetchAndStore)).then(fresh => {
            if (signal?.aborted || !fresh.every(r => r.ok)) return;
            if (JSON.stringify(fresh.map(r => r.body)) !== JSON.stringify(cached.map(r => r.body))) render(fresh, { stale: false });
        }).catch(() => {});
        return;
    }
    let results;
    try { results = await Promise.all(paths.map(fetchAndStore)); } catch { return; }
    if (signal?.aborted) return;
    render(results, { stale: false });
}

/**
 * Counts the big numbers in `.stat .v` up from zero over about a third of a second. Only plain whole numbers
 * (with thousands separators) are touched. Off for reduced motion, and the final text is always the exact value.
 */
export function countUp(scope, ms = 380) {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const node of scope.querySelectorAll('.stat .v')) {
        const text = node.textContent.trim();
        if (!/^\d{1,3}(,\d{3})*$/.test(text)) continue;
        const target = Number(text.replace(/,/g, ''));
        if (target < 2) continue;
        const start = performance.now();
        const step = now => {
            const t = Math.min(1, (now - start) / ms);
            node.textContent = t === 1 ? text : fmt(Math.round(target * (1 - (1 - t) ** 3)));
            if (t < 1 && node.isConnected) requestAnimationFrame(step);
            else node.textContent = text;
        };
        node.textContent = '0';
        requestAnimationFrame(step);
    }
}
