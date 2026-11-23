import { api, esc, fmt } from './util.js';
import { cachedScan, scanAll } from './scan-client.js';
import { imageStem, referencedStems } from './scan.js';
import { buildFolders, folderTitle, groupSets } from './media-sets.js';

const authHeaders = () => (typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {});
const branch = () => (typeof window.getSelectedBranch === 'function' && window.getSelectedBranch()) || 'main';

export const bytes = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
const LARGE = 500 * 1024;

export function sanitizeKey(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '').slice(0, 120);
}

/* ───────────── Images (repo) ───────────── */

const FOLDER_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5a2 2 0 0 1 2-2H10l2 2.5h6.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>';
const STATUS = {
    'paired': ['ok', 'Has AVIF'],
    'missing-avif': ['warning', 'Missing AVIF'],
    'resized-only': ['info', 'AVIF: resized copies only'],
    'avif-only': ['info', 'AVIF only, no fallback']
};

function imagesTab(panel, media, projects, reload) {
    if (!media.repo) {
        panel.innerHTML = `<div class="notice"><strong>Images unavailable.</strong>${esc(media.repoError ? `GitHub: ${media.repoError}` : 'GitHub access is not configured for this environment.')}</div>`;
        return;
    }
    const files = media.repo.files;
    const folders = buildFolders(files, projects);
    const allSets = groupSets(files);
    const byDir = new Map();
    for (const set of allSets) { if (!byDir.has(set.dir)) byDir.set(set.dir, []); byDir.get(set.dir).push(set); }

    let folder = '';
    try { folder = sessionStorage.getItem('admin_media_folder') || ''; } catch { /* private mode */ }
    if (folder && !byDir.has(folder)) folder = '';
    let query = '';
    let only = 'all'; // all | missing | large
    let stems = null; // set after a usage scan
    const LIMIT = 150;

    const total = files.reduce((n, f) => n + f.size, 0);
    const missingTotal = allSets.filter(s => s.status === 'missing-avif').length;
    const remember = () => { try { sessionStorage.setItem('admin_media_folder', folder); } catch { /* private mode */ } };

    const statusLabel = set => {
        const st = STATUS[set.status];
        if (!st) return '';
        const extra = set.status === 'paired' && set.savings !== null && set.savings > 0 ? `<span class="muted"> · ${set.savings}% smaller</span>` : '';
        return `<span class="sev sev-${st[0]}">${st[1]}</span>${extra}`;
    };
    const setRow = (set, showDir) => {
        const unused = stems && set.dir.startsWith('content/') && !stems.has(imageStem(set.files[0].path));
        return `<li class="mset">
            <img class="thumb" loading="lazy" decoding="async" src="/${esc(set.preview)}" alt="" width="48" height="48">
            <div class="mset-body">
                <div class="mset-head"><strong class="mset-name">${esc(set.name)}</strong>${statusLabel(set)}${unused ? ' <span class="sev sev-info">Possibly unused</span>' : ''}</div>
                ${showDir ? `<div class="sub">${esc(folderTitle(set.dir, projects))} · ${esc(set.dir)}</div>` : ''}
                <ul class="mfiles">${set.files.map(f => `<li>
                    <span class="fmt">${esc(f.ext.toUpperCase())}${f.variant ? ` ${esc(f.variant)}` : ''}</span>
                    <span class="fname">${esc(f.base)}</span>
                    <span class="fsize">${f.size > LARGE ? '<span class="sev sev-warning">Large</span> ' : ''}${bytes(f.size)}</span>
                    <button type="button" class="linklike danger" data-delimg="${esc(f.path)}" aria-label="Delete ${esc(f.path)}">Delete</button></li>`).join('')}</ul>
            </div></li>`;
    };

    const paint = () => {
        const q = query.trim().toLowerCase();
        const list = panel.querySelector('#media-list');
        const crumbs = panel.querySelector('#media-crumbs');
        const tools = panel.querySelector('#folder-tools');
        const count = panel.querySelector('#media-count');

        if (!folder && !q) {
            // Top level: the folders.
            crumbs.innerHTML = '<span class="crumb-here">All folders</span>';
            tools.hidden = true;
            list.className = 'rows panel-list is-grid cells-folder';
            list.innerHTML = folders.map(f => `<li class="frow"><button type="button" class="folder-btn" data-folder="${esc(f.dir)}">
                ${FOLDER_ICON}<span class="fname-col"><strong>${esc(f.title)}</strong><span class="sub">${esc(f.dir)}</span></span>
                <span class="fissue">${f.missingAvif ? `<span class="sev sev-warning">${f.missingAvif} missing AVIF</span>` : ''}</span><span class="fcount num">${fmt(f.images)} image${f.images === 1 ? '' : 's'}</span><span class="fsize num">${bytes(f.bytes)}</span></button></li>`).join('');
            count.textContent = `${fmt(folders.length)} folders`;
            return;
        }

        // Inside a folder, or searching across all of them.
        let sets = q ? allSets.filter(s => s.files.some(f => f.path.toLowerCase().includes(q)) || folderTitle(s.dir, projects).toLowerCase().includes(q)) : byDir.get(folder);
        if (only === 'missing') sets = sets.filter(s => s.status === 'missing-avif');
        if (only === 'large') sets = sets.filter(s => s.files.some(f => f.size > LARGE));
        sets = [...sets].sort((a, b) => (only === 'large' ? b.bytes - a.bytes : a.name.localeCompare(b.name, undefined, { numeric: true })));

        crumbs.innerHTML = q
            ? '<button type="button" class="linklike" data-up>All folders</button><span class="crumb-sep" aria-hidden="true">/</span><span class="crumb-here">Search results</span>'
            : `<button type="button" class="linklike" data-up>All folders</button><span class="crumb-sep" aria-hidden="true">/</span><span class="crumb-here">${esc(folderTitle(folder, projects))}</span><span class="sub crumb-path">${esc(folder)}</span>`;
        tools.hidden = false;
        list.className = 'rows panel-list is-grid cells-set';
        list.innerHTML = sets.slice(0, LIMIT).map(s => setRow(s, Boolean(q))).join('') || '<li class="empty muted">Nothing matches.</li>';
        count.textContent = `${sets.length > LIMIT ? `${LIMIT} of ` : ''}${fmt(sets.length)} picture${sets.length === 1 ? '' : 's'}`;
    };

    panel.innerHTML = `
        <div class="stats stats-4" role="group" aria-label="Image summary">
            <div class="stat"><span class="k">Images</span><span class="v">${fmt(files.length)}</span><span class="delta">on ${esc(media.repo.branch)}</span></div>
            <div class="stat"><span class="k">Total size</span><span class="v">${bytes(total)}</span><span class="delta">${fmt(folders.length)} folders</span></div>
            <div class="stat"><span class="k">Over 500 KB</span><span class="v">${files.filter(f => f.size > LARGE).length}</span><span class="delta">worth shrinking</span></div>
            <div class="stat"><span class="k">Missing AVIF</span><span class="v">${missingTotal}</span><span class="delta ${missingTotal ? 'down' : 'up'}">${missingTotal ? 'PNG/JPG/WebP with no AVIF' : 'every picture has one'}</span></div>
        </div>
        ${media.repo.truncated ? '<div class="notice"><strong>List truncated.</strong>GitHub returned a partial file tree.</div>' : ''}
        <div class="toolbar">
            <input type="search" id="media-q" placeholder="Search all folders" aria-label="Search images" autocapitalize="none" autocorrect="off" spellcheck="false">
            <button type="button" class="btn btn-secondary" id="check-usage">Check for unused</button>
        </div>
        <div class="crumbs-row"><nav id="media-crumbs" class="crumbs-line" aria-label="Folder"></nav>
            <div class="seg" id="folder-tools" role="group" aria-label="Show" hidden>
                <button type="button" data-only="all" aria-pressed="true">All</button><button type="button" data-only="missing" aria-pressed="false">Missing AVIF</button><button type="button" data-only="large" aria-pressed="false">Over 500 KB</button>
            </div></div>
        <div class="status-line" id="media-status" aria-live="polite"><span id="media-count"></span></div>
        <ul class="rows panel-list" id="media-list"></ul>`;

    panel.querySelector('#media-q').addEventListener('input', e => { query = e.target.value; paint(); });
    panel.querySelector('#folder-tools').addEventListener('click', e => {
        const b = e.target.closest('[data-only]');
        if (!b) return;
        only = b.dataset.only;
        panel.querySelectorAll('#folder-tools button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        paint();
    });
    panel.querySelector('#media-crumbs').addEventListener('click', e => {
        if (!e.target.closest('[data-up]')) return;
        folder = ''; query = ''; only = 'all';
        panel.querySelector('#media-q').value = '';
        panel.querySelectorAll('#folder-tools button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.only === 'all')));
        remember(); paint();
    });
    panel.querySelector('#check-usage').addEventListener('click', async e => {
        e.target.disabled = true;
        const st = panel.querySelector('#media-status');
        const done = r => { stems = referencedStems(projects, r.scans); st.innerHTML = `<span id="media-count"></span> Usage checked across ${r.total - r.failed} write-ups. "Possibly unused" means no write-up or project card points at it; check before deleting.`; paint(); e.target.disabled = false; };
        const cached = cachedScan();
        if (cached) return done(cached);
        st.textContent = 'Scanning write-ups…';
        done(await scanAll(projects, (n, t) => { st.textContent = `Scanning ${n} of ${t} write-ups…`; }));
    });

    panel.querySelector('#media-list').addEventListener('click', async e => {
        const open = e.target.closest('[data-folder]');
        if (open) { folder = open.dataset.folder; only = 'all'; remember(); paint(); window.scrollTo(0, 0); return; }

        const btn = e.target.closest('[data-delimg]');
        if (!btn) return;
        const path = btn.dataset.delimg;
        const st = panel.querySelector('#media-status');
        btn.disabled = true;
        // Find out which write-ups use this image before asking.
        let scan = cachedScan();
        if (!scan) {
            st.textContent = 'Checking where this image is used…';
            scan = await scanAll(projects, (n, t) => { st.textContent = `Checking where this image is used (${n} of ${t})…`; });
        }
        const stem = imageStem(path);
        const names = new Map(projects.map(p => [p.id, p.title]));
        const by = scan.scans.filter(sc => (sc.images || []).some(img => imageStem(img) === stem)).map(sc => names.get(sc.project) || sc.project);
        const warn = by.length ? `\n\nIt is used by: ${by.join(', ')}. Those images will break.` : '\n\nNo write-up uses it.';
        if (!confirm(`Delete ${path} from ${branch()}?\n\nThis commits the deletion to GitHub. It can only be restored from git history, not from this admin.${warn}`)) {
            btn.disabled = false; st.innerHTML = '<span id="media-count"></span>'; paint(); return;
        }
        const res = await fetch(`/api/admin/media/image?path=${encodeURIComponent(path)}&branch=${encodeURIComponent(branch())}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) {
            const msg = (await res.json().catch(() => ({}))).message || `Delete failed (${res.status}).`;
            alert(msg); btn.disabled = false; st.innerHTML = '<span id="media-count"></span>'; paint(); return;
        }
        await reload();
    });
    paint();
}

/* ───────────── Audio & files (R2) ───────────── */

function r2Tab(panel, media, projects, reload) {
    if (!media.r2.available) {
        panel.innerHTML = '<div class="notice"><strong>R2 is not connected.</strong>The Worker needs the <code>MEDIA</code> binding (set in <code>wrangler.jsonc</code> and applied on deploy).</div>';
        return;
    }
    const used = new Map(); // key -> [project titles]
    const cached = cachedScan();
    const names = new Map(projects.map(p => [p.id, p.title]));
    if (cached) for (const s of cached.scans) for (const a of s.audio || []) if (a.key) used.set(a.key, [...(used.get(a.key) || []), names.get(s.project) || s.project]);

    const objects = [...media.r2.objects].sort((a, b) => b.size - a.size);
    panel.innerHTML = `
        <p class="muted tab-intro">Files served from <code>media.ryanmarch.me</code>. Audio players reference these by file name. ${cached ? '' : 'Run a scan on the Embeds page to see which write-up uses each file.'}</p>
        <form id="r2-upload" class="upload-form">
            <div class="field"><label for="r2-file">Upload a file</label><input type="file" id="r2-file" accept=".mp3,.m4a,.zip,.aup3" required></div>
            <div class="field"><label for="r2-key">Stored as</label><input id="r2-key" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="file-name.mp3" required></div>
            <label class="check-line"><input type="checkbox" id="r2-overwrite"> Replace if it already exists</label>
            <div class="actions"><button class="btn" type="submit" id="r2-submit">Upload</button><span class="status-line" id="r2-status" aria-live="polite"></span></div>
        </form>
        <ul class="rows panel-list">${objects.map(o => `<li class="mrow mrow-r2">
            <span class="label wrap"><a href="https://media.ryanmarch.me/${encodeURIComponent(o.key)}" target="_blank" rel="noopener">${esc(o.key)}</a>
                <span class="sub">${used.has(o.key) ? `Used by ${esc([...new Set(used.get(o.key))].join(', '))}` : (cached ? 'Not used by any write-up' : '')}</span></span>
            <span class="value">${bytes(o.size)}</span>
            <button type="button" class="btn btn-secondary" data-del="${esc(o.key)}" aria-label="Delete ${esc(o.key)}">Delete</button></li>`).join('') || '<li class="empty muted">The bucket is empty.</li>'}</ul>`;

    const fileInput = panel.querySelector('#r2-file');
    const keyInput = panel.querySelector('#r2-key');
    const status = panel.querySelector('#r2-status');
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) keyInput.value = sanitizeKey(fileInput.files[0].name); });

    panel.querySelector('#r2-upload').addEventListener('submit', async e => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) return;
        const submit = panel.querySelector('#r2-submit');
        submit.disabled = true;
        status.textContent = `Uploading ${bytes(file.size)}…`;
        const qs = new URLSearchParams({ key: keyInput.value.trim() });
        if (panel.querySelector('#r2-overwrite').checked) qs.set('overwrite', '1');
        try {
            const res = await fetch(`/api/admin/media/r2?${qs}`, { method: 'PUT', headers: authHeaders(), body: file });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.message || `Upload failed (${res.status}).`);
            status.textContent = `Uploaded ${body.uploaded}.`;
            await reload();
        } catch (err) {
            status.textContent = err.message;
            submit.disabled = false;
        }
    });

    panel.addEventListener('click', async e => {
        const del = e.target.closest('[data-del]');
        if (!del) return;
        const key = del.dataset.del;
        const by = used.get(key);
        const warn = by ? `\n\nIt is used by: ${[...new Set(by)].join(', ')}. Those players will break.` : '';
        if (!confirm(`Permanently delete ${key} from the media bucket? This cannot be undone.${warn}`)) return;
        del.disabled = true;
        const res = await fetch(`/api/admin/media/r2?key=${encodeURIComponent(key)}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) { alert((await res.json().catch(() => ({}))).message || `Delete failed (${res.status}).`); del.disabled = false; return; }
        await reload();
    });
}

/* ───────────── View ───────────── */

export async function render(root) {
    const projects = globalThis.myProjects || [];
    let tab = sessionStorage.getItem('admin_media_tab') === 'r2' ? 'r2' : 'images';
    root.innerHTML = `
        <div class="view-head"><div><h1>Media</h1><p>Site images from the repository, and audio files in the R2 bucket.</p></div></div>
        <div class="tabs" role="tablist" aria-label="Media">
            <button role="tab" type="button" id="tab-images" data-tab="images" aria-selected="${tab === 'images'}" aria-controls="media-panel">Images</button>
            <button role="tab" type="button" id="tab-r2" data-tab="r2" aria-selected="${tab === 'r2'}" aria-controls="media-panel">Audio &amp; files</button>
        </div>
        <div id="media-panel" role="tabpanel" class="tabpanel"><div class="loading">Loading…</div></div>`;

    let media = null;
    const load = async () => {
        const res = await api(`/api/admin/media?branch=${encodeURIComponent(branch())}`);
        media = res.ok ? res.body : { repo: null, repoError: `request failed (${res.status})`, r2: { available: false, objects: [] } };
    };
    const show = () => {
        root.querySelectorAll('[role=tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
        const fresh = root.querySelector('#media-panel').cloneNode(false);
        root.querySelector('#media-panel').replaceWith(fresh);
        fresh.setAttribute('aria-labelledby', `tab-${tab}`);
        if (tab === 'images') imagesTab(fresh, media, projects, async () => { await load(); show(); });
        else r2Tab(fresh, media, projects, async () => { await load(); show(); });
    };
    root.querySelector('.tabs').addEventListener('click', e => {
        const t = e.target.closest('[data-tab]');
        if (!t || t.dataset.tab === tab) return;
        tab = t.dataset.tab;
        try { sessionStorage.setItem('admin_media_tab', tab); } catch { /* private mode */ }
        show();
    });
    await load();
    show();
}
