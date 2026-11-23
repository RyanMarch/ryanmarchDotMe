// Admin shell: hash routing, mobile drawer, lazy-loaded views.

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

function currentView() {
    const name = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
    return VIEWS[name] ? name : DEFAULT_VIEW;
}

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

async function route() {
    if (app.classList.contains('hidden')) return; // not signed in yet
    const name = currentView();
    const view = VIEWS[name];
    const token = ++renderToken;

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
        await mod.render(root);
    }

    if (!firstRender) {
        window.scrollTo(0, 0);
        main.focus({ preventScroll: true });
    }
    firstRender = false;
}

window.addEventListener('hashchange', route);

// The editor script reveals #admin-view after sign-in (production reveals it on load).
let wasHidden = app.classList.contains('hidden');
new MutationObserver(() => {
    const hidden = app.classList.contains('hidden');
    if (wasHidden && !hidden) route();
    wasHidden = hidden;
}).observe(app, { attributes: true, attributeFilter: ['class'] });
route();

// Environment label: local dev vs the deployed site.
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const env = document.getElementById('env-label');
if (env) { env.classList.toggle('is-local', local); env.querySelector('span').textContent = local ? 'Local' : 'Production'; }

import('./palette.js').then(m => m.initPalette(NAV));
