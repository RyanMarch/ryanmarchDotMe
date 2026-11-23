// Small pieces of the shell: the "Saving to <branch>" flag, the theme switch, and keyboard shortcuts.
import { go, href } from './router.js';
import { infoDialog } from './ui.js';

/* ── Which branch saves go to ── */
function updateBranchFlag() {
    const flag = document.getElementById('branch-flag');
    if (!flag) return;
    const branch = (typeof window.getSelectedBranch === 'function' && window.getSelectedBranch()) || 'main';
    flag.querySelector('span').textContent = `Saving to ${branch}`;
    flag.classList.toggle('is-prod', branch === 'main');
}

/* ── Theme: follow the system, or force light or dark ── */
const THEMES = ['system', 'light', 'dark'];
const readTheme = () => { try { const t = localStorage.getItem('theme'); return t === 'light' || t === 'dark' ? t : 'system'; } catch { return 'system'; } };
function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    try { if (theme === 'system') localStorage.removeItem('theme'); else localStorage.setItem('theme', theme); } catch { /* private mode */ }
    const label = document.querySelector('#theme-btn span');
    if (label) label.textContent = `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`;
}
export function cycleTheme() {
    applyTheme(THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length]);
}

/* ── Keyboard shortcuts ── */
export const SHORTCUTS = [
    ['g d', 'Dashboard'], ['g a', 'Analytics'], ['g y', 'Activity'], ['g p', 'Projects'], ['g m', 'Media'],
    ['g e', 'Embeds'], ['g h', 'Content Health'], ['g r', 'Redirects & SEO'], ['g s', 'Settings'],
    ['Ctrl K', 'Search and jump to anything'], ['/', 'Search and jump to anything'], ['?', 'This list']
];
const GO = { d: 'dashboard', a: 'analytics', y: 'activity', p: 'projects', m: 'media', e: 'embeds', h: 'health', r: 'seo', s: 'settings' };

export const showShortcuts = () => infoDialog({ title: 'Keyboard shortcuts', rows: SHORTCUTS });

export function initChrome() {
    updateBranchFlag();
    document.addEventListener('admin:branch-changed', updateBranchFlag);
    document.getElementById('branch-select')?.addEventListener('change', updateBranchFlag);

    applyTheme(readTheme());
    document.getElementById('theme-btn')?.addEventListener('click', cycleTheme);

    let gAt = 0;
    document.addEventListener('keydown', e => {
        const t = document.activeElement;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName) || t?.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
        if (document.querySelector('dialog[open]')) return;
        if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }
        if (gAt && Date.now() - gAt < 1200) {
            gAt = 0;
            const view = GO[e.key.toLowerCase()];
            if (view) { e.preventDefault(); go(href(view)); }
            return;
        }
        if (e.key === 'g') gAt = Date.now();
    });
}
