// Admin core: sign-in, the selected branch and the project list.
// Loaded on every page. The editor (editor.js, projects-list.js, Prism, CodeJar) loads lazily
// the first time you open Projects, and talks to this file through window.* and events.
import { myProjects } from '/assets/js/project-data.js';
import { parseProjectDataSource } from '/assets/js/admin-project-parser.js';

window.myProjects = myProjects;

// Cloudflare Access is not in front of localhost; there the page shows a password gate instead.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
window.isLocal = isLocal;
const LOCAL_PASS_KEY = 'admin_local_pass';
let adminPasscode = '';

const $ = id => document.getElementById(id);
const showAlert = (el, message, type) => { el.className = `alert alert-${type}`; el.innerHTML = message; el.classList.remove('hidden'); };

// In production the Cloudflare Access cookie authenticates requests; locally a Bearer password does.
window.getPasscode = () => adminPasscode;
window.getAuthHeaders = () => (adminPasscode ? { Authorization: `Bearer ${adminPasscode}` } : {});

function reveal() {
    $('auth-view').classList.add('hidden');
    $('admin-view').classList.remove('hidden');
    $('logout-btn').classList.remove('hidden');
}

window.checkAuth = async function checkAuth() {
    const passcode = $('passcode-input').value.trim();
    const alertEl = $('auth-alert');
    const loginBtn = $('login-btn');
    if (!passcode) { showAlert(alertEl, 'Please enter a password.', 'error'); return; }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Validating...';
    alertEl.classList.add('hidden');
    try {
        // Test the password by reading a lightweight file.
        const res = await fetch('/api/admin/file?path=robots.txt', { headers: { Authorization: `Bearer ${passcode}` } });
        if (res.ok) {
            adminPasscode = passcode;
            if (isLocal) { try { sessionStorage.setItem(LOCAL_PASS_KEY, passcode); } catch { /* storage blocked */ } }
            reveal();
            window.syncProjectsForBranch(window.getSelectedBranch());
        } else {
            const text = await res.text();
            showAlert(alertEl, `Authentication failed: ${res.status === 401 ? 'Invalid password' : text}`, 'error');
            adminPasscode = '';
            try { sessionStorage.removeItem(LOCAL_PASS_KEY); } catch { /* storage blocked */ }
        }
    } catch (err) {
        showAlert(alertEl, `Error connecting to API: ${err.message}`, 'error');
    } finally {
        loginBtn.disabled = $('passcode-input').value.trim() === '';
        loginBtn.textContent = 'Authenticate';
    }
};

window.logout = function logout() {
    if (!isLocal) {
        // Ends the Cloudflare Access session, then returns to the homepage.
        location.href = `/cdn-cgi/access/logout?returnTo=${encodeURIComponent(`${location.origin}/`)}`;
        return;
    }
    adminPasscode = '';
    try { sessionStorage.removeItem(LOCAL_PASS_KEY); } catch { /* storage blocked */ }
    $('passcode-input').value = '';
    $('auth-view').classList.remove('hidden');
    $('admin-view').classList.add('hidden');
    $('logout-btn').classList.add('hidden');
    document.dispatchEvent(new CustomEvent('admin:logout')); // the editor clears itself when it is loaded
};

// ── Target branch ──
window.getSelectedBranch = () => {
    const select = $('branch-select');
    return select ? select.value : (localStorage.getItem('admin_selected_branch') || 'main');
};
window.changeBranch = async function changeBranch() {
    const select = $('branch-select');
    if (!select) return;
    const branch = select.value;
    localStorage.setItem('admin_selected_branch', branch);
    await window.syncProjectsForBranch(branch);
    document.dispatchEvent(new CustomEvent('admin:branch-changed', { detail: { branch } }));
};

// ── Project list: the bundled copy first, then the selected branch from GitHub ──
let projectSyncSeq = 0;
window.syncProjectsForBranch = async function syncProjectsForBranch(branch = window.getSelectedBranch()) {
    const seq = ++projectSyncSeq;
    const statusEl = $('projects-sync-status');
    if (statusEl) { statusEl.classList.remove('is-warning'); statusEl.textContent = `Syncing projects from ${branch}...`; }
    try {
        const res = await fetch(`/api/admin/file?path=assets/js/project-data.js&branch=${encodeURIComponent(branch)}`, { headers: window.getAuthHeaders(), cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const decode = str => new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0)));
        const parsed = parseProjectDataSource(decode((data.content || '').replace(/\s/g, '')));
        if (seq !== projectSyncSeq) return;
        window.myProjects = parsed;
        window.applyProjectsList?.(parsed); // the editor's file list, once it is loaded
        document.dispatchEvent(new CustomEvent('admin:projects-synced', { detail: { branch, projects: parsed } }));
        if (statusEl) { statusEl.classList.remove('is-warning'); statusEl.textContent = `Synced ${parsed.filter(p => p && p.hasExtendedContent).length} projects from ${branch}`; }
    } catch {
        if (seq !== projectSyncSeq) return;
        if (statusEl) { statusEl.classList.add('is-warning'); statusEl.textContent = `Could not refresh from ${branch} (showing bundled list)`; }
    }
};

function boot() {
    const select = $('branch-select');
    if (select) select.value = localStorage.getItem('admin_selected_branch') || 'main';

    // Password gate (local only)
    const input = $('passcode-input');
    const btn = $('login-btn');
    if (input && btn) {
        const update = () => { btn.disabled = input.value.trim() === ''; };
        input.addEventListener('input', update);
        input.addEventListener('change', update);
        input.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) window.checkAuth(); });
        update();
        setTimeout(update, 100);
    }

    if (!isLocal) {
        // Production: Cloudflare Access already authenticated this request.
        reveal();
        window.syncProjectsForBranch(window.getSelectedBranch());
    } else {
        // Local: keep the sign-in across refreshes for this tab.
        let saved = '';
        try { saved = sessionStorage.getItem(LOCAL_PASS_KEY) || ''; } catch { /* storage blocked */ }
        if (saved) { input.value = saved; window.checkAuth(); }
    }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
