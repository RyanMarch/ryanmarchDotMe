// Path-based routing for the admin: /admin, /admin/media/ledger?show=missing.
// Every place you can "go" to is a history entry, so Back and swipe-back return to where you were.

export const BASE = '/admin';
export const VIEW_IDS = ['dashboard', 'analytics', 'search', 'activity', 'projects', 'media', 'embeds', 'health', 'seo', 'settings'];

/** Splits a location into { view, rest, query }. Unknown paths fall back to the dashboard. */
export function parse(loc = globalThis.location) {
    const parts = loc.pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const known = VIEW_IDS.includes(parts[0]);
    return { view: known ? parts[0] : 'dashboard', rest: known ? parts.slice(1) : [], query: new URLSearchParams(loc.search) };
}

/** Builds a URL. Empty query values are left out so default states keep a clean address. */
export function href(view, rest = [], query = {}) {
    const path = view === 'dashboard' && !rest.length ? BASE : `${BASE}/${[view, ...rest].map(encodeURIComponent).join('/')}`;
    const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)).toString();
    return q ? `${path}?${q}` : path;
}

/** Old hash links (#/media) → the equivalent path, or null. */
export function fromHash(hash) {
    const m = /^#\/([a-z]+)(?:\/([^?]*))?(?:\?(.*))?$/.exec(hash || '');
    if (!m || !VIEW_IDS.includes(m[1])) return null;
    const rest = (m[2] || '').split('/').filter(Boolean).map(decodeURIComponent);
    const q = Object.fromEntries(new URLSearchParams(m[3] || ''));
    return href(m[1], rest, q);
}

let shell = () => {};
const viewHandlers = new Set();

/** The shell (main.js) registers once: it switches views. */
export function start(onRoute) {
    shell = onRoute;
    window.addEventListener('popstate', () => shell(parse(), 'pop', false));
}

/**
 * Navigate to a path. `replace` swaps the current entry instead of adding one.
 * `quiet` means "the view already updated itself; just record the history entry".
 */
export function go(url, { replace = false, quiet = false } = {}) {
    if (url === location.pathname + location.search && !replace) return;
    // Remember where this entry was scrolled to, so Back can put it there.
    try { history.replaceState({ ...(history.state || {}), scroll: window.scrollY }, ''); } catch { /* ignore */ }
    if (replace) history.replaceState({}, '', url); else history.pushState({}, '', url);
    shell(parse(), replace ? 'replace' : 'push', quiet);
}

/** A view registers to hear about Back/forward within itself (same view, different state). */
export function onPop(fn) {
    viewHandlers.add(fn);
    return () => viewHandlers.delete(fn);
}
export function clearViewHandlers() { viewHandlers.clear(); }
export function notifyViews(route) { for (const h of [...viewHandlers]) h(route); }
