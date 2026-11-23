/* global __ADMIN_EDITOR_URL__ */
// Loads the editor stack on demand: Prism and CodeJar from their CDNs, then editor.js and projects-list.js.
// Every other admin page skips all of it.

const PRISM = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0';
const CODEJAR = 'https://cdn.jsdelivr.net/npm/codejar/+esm';
// The production build swaps in the hashed, minified file name (see scripts/build.js).
const EDITOR_URL = typeof __ADMIN_EDITOR_URL__ !== 'undefined' ? __ADMIN_EDITOR_URL__ : '/assets/js/admin/editor.js';

const classic = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(s);
});

let loading = null;

/** Resolves once the editor is ready. Safe to call many times. */
export function ensureEditor() {
    if (loading) return loading;
    loading = (async () => {
        fetch(EDITOR_URL).catch(() => {}); // warm the cache while the CDN scripts download
        await Promise.all([
            classic(`${PRISM}/prism.min.js`).then(() => Promise.all(['markup', 'json', 'javascript'].map(l => classic(`${PRISM}/components/prism-${l}.min.js`)))),
            import(/* @vite-ignore */ CODEJAR).then(m => { window.CodeJar = m.CodeJar; })
        ]);
        await classic(EDITOR_URL);
        await import('./projects-list.js');
    })().catch(err => { loading = null; throw err; });
    return loading;
}

/** Start downloading without waiting (for hover/focus on a link to Projects). */
export function prefetchEditor() { ensureEditor().catch(() => {}); }
