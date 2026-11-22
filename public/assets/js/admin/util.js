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
    if (status === 404) return 'This endpoint is not available here. The local Python server only serves the editor; run npm run dev:worker to see analytics and dashboard data.';
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

/** Lists of {label, count} as bar rows. `render` may return custom label HTML. */
export function barRows(items, render = item => esc(item.label)) {
    if (!items || !items.length) return '<ul class="rows"><li class="empty">No data in this range.</li></ul>';
    const max = Math.max(...items.map(i => i.count), 1);
    return `<ul class="rows">${items.map(item => `
        <li><span class="bar" style="width:${Math.max(2, Math.round((item.count / max) * 100))}%"></span>
            <span class="label">${render(item)}</span><span class="value">${fmt(item.count)}</span></li>`).join('')}</ul>`;
}
