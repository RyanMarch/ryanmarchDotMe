// Admin shell: path routing (see router.js), mobile drawer, lazy-loaded views.
import { clearViewHandlers, fromHash, go, href, notifyViews, parse, start } from './router.js';

const VIEWS = {
    dashboard: { group: 'Site', title: 'Dashboard', load: () => import('./dashboard.js') },
    analytics: { group: 'Site', title: 'Analytics', load: () => import('./analytics.js') },
    activity: { group: 'Site', title: 'Activity', load: () => import('./activity.js') },
    media: { group: 'Content', title: 'Media', load: () => import('./media.js') },
    embeds: { group: 'Content', title: 'Embeds', load: () => import('./embeds.js') },
    settings: { group: 'System', title: 'Settings', load: () => import('./settings.js') },
    health: { group: 'Content', title: 'Content Health', load: () => import('./health.js') },
    seo: { group: 'Content', title: 'Redirects & SEO', load: () => import('./seo.js') },
    projects: { group: 'Content', title: 'Projects', load: null } // markup + logic live in admin.html / editor.js
};
const DEFAULT_VIEW = 'dashboard';
export const NAV = Object.entries(VIEWS).map(([id, v]) => ({ id, title: v.title, group: v.group }));

const app = document.getElementById('admin-view');
const menuBtn = document.getElementById('menu-btn');
const scrim = document.getElementById('scrim');
const main = document.getElementById('main');
const mobile = window.matchMedia('(max-width: 900px)');

function setDrawer(open) {
    app.classList.toggle('nav-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open && mobile.matches ? 'hidden' : '';
    if (open) document.querySelector('.nav-link[aria-current="page"]')?.focus();
}

menuBtn.addEventListener('click', () => setDrawer(!app.classList.contains('nav-open')));
scrim.addEventListener('click', () => { setDrawer(false); menuBtn.focus(); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && app.classList.contains('nav-open')) { setDrawer(false); menuBtn.focus(); }
});
mobile.addEventListener('change', () => setDrawer(false));

let renderToken = 0;
let firstRender = true;
let shown = ''; // the view currently on screen

async function route(r = parse(), kind = 'push', quiet = false) {
    if (app.classList.contains('hidden')) return; // not signed in yet
    const name = VIEWS[r.view] ? r.view : DEFAULT_VIEW;
    const view = VIEWS[name];

    // Same view, new in-view state (a Media folder, a filter): the view repaints itself on Back/forward.
    if (name === shown) {
        if (kind === 'pop') restoreScroll();
        if (!quiet) {
            notifyViews(r);
            if (kind !== 'pop') window.scrollTo(0, 0);
            if (name === 'projects') openProjectFile(r);
        }
        return;
    }

    const token = ++renderToken;
    shown = name;
    clearViewHandlers();

    document.querySelectorAll('[data-nav]').forEach(a => {
        if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
    document.getElementById('topbar-title').textContent = view.title;
    document.getElementById('topbar-group').textContent = view.group;
    document.title = `${view.title} | Admin | Ryan March`;
    setDrawer(false);

    document.querySelectorAll('[data-view]').forEach(section => { section.hidden = section.dataset.view !== name; });

    if (view.load) {
        const root = document.getElementById(`view-${name}`);
        const mod = await view.load();
        if (token !== renderToken) return;
        await mod.render(root, r);
    } else if (name === 'projects') {
        openProjectFile(r);
    }

    if (kind === 'pop') restoreScroll();
    else if (!firstRender) {
        window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
    }
    firstRender = false;
}

function restoreScroll() {
    const y = history.state?.scroll;
    requestAnimationFrame(() => window.scrollTo(0, typeof y === 'number' ? y : 0));
}

// ── Projects: the open file lives in the URL (?file=content/ledger/index.html) ──
let applyingRoute = false;
function openProjectFile(r) {
    const file = r.query.get('file');
    if (!file) return;
    applyingRoute = true;
    setTimeout(async () => {
        try { if (typeof window.loadFile === 'function') await window.loadFile(file); } finally { applyingRoute = false; }
    }, 80);
}
if (typeof window.loadFile === 'function') {
    const originalLoad = window.loadFile;
    window.loadFile = async function (path, ...rest) {
        const result = await originalLoad.call(this, path, ...rest);
        if (!applyingRoute && shown === 'projects' && parse().query.get('file') !== path) go(href('projects', [], { file: path }), { quiet: true });
        return result;
    };
}

start(route);

// Links to admin pages navigate without a page load.
document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.target || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^\/admin(\/|$|\?)/.test(url.pathname + url.search)) return;
    e.preventDefault();
    go(url.pathname + url.search);
});

// Older links and code that set location.hash (#/media) are rewritten to the real path.
const fixHash = () => {
    const target = fromHash(location.hash);
    if (target) { history.replaceState({}, '', target); route(parse(), 'push'); }
};
window.addEventListener('hashchange', fixHash);
fixHash();
history.scrollRestoration = 'manual';

// The editor script reveals #admin-view after sign-in (production reveals it on load).
let wasHidden = app.classList.contains('hidden');
new MutationObserver(() => {
    const hidden = app.classList.contains('hidden');
    if (wasHidden && !hidden) route(parse(), 'push');
    wasHidden = hidden;
}).observe(app, { attributes: true, attributeFilter: ['class'] });
route();
window.adminGo = go;
window.adminHref = href;

// Environment label: local dev vs the deployed site.
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const env = document.getElementById('env-label');
if (env) { env.classList.toggle('is-local', local); env.querySelector('span').textContent = local ? 'Local' : 'Production'; }

import('./palette.js').then(m => m.initPalette(NAV));
