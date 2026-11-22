// Admin shell: hash routing, mobile drawer, lazy-loaded views.

const VIEWS = {
    dashboard: { title: 'Dashboard', load: () => import('./dashboard.js') },
    analytics: { title: 'Analytics', load: () => import('./analytics.js') },
    health: { title: 'Content health', load: () => import('./health.js') },
    seo: { title: 'Redirects & SEO', load: () => import('./seo.js') },
    projects: { title: 'Projects', load: null } // markup + logic live in admin.html / editor.js
};
const DEFAULT_VIEW = 'dashboard';

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
