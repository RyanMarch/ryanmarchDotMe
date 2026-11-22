import { api, esc, fmt } from './util.js';
import { cachedScan, scanAll } from './scan-client.js';
import { imageStem, referencedStems } from './scan.js';

const authHeaders = () => (typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {});
const branch = () => (typeof window.getSelectedBranch === 'function' && window.getSelectedBranch()) || 'main';

export const bytes = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
const LARGE = 500 * 1024;

export function sanitizeKey(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '').slice(0, 120);
}

/* ───────────── Images (repo) ───────────── */

function imagesTab(panel, media, projects) {
    if (!media.repo) {
        panel.innerHTML = `<div class="notice"><strong>Images unavailable.</strong>${esc(media.repoError ? `GitHub: ${media.repoError}` : 'GitHub access is not configured for this environment.')}</div>`;
        return;
    }
    const files = media.repo.files;
    let sort = 'size';
    let query = '';
    let stems = null; // set after a usage scan

    const total = files.reduce((n, f) => n + f.size, 0);
    const paint = () => {
        const q = query.trim().toLowerCase();
        let shown = files.filter(f => !q || f.path.toLowerCase().includes(q));
        const unused = f => stems && f.path.startsWith('content/') && !stems.has(imageStem(f.path));
        shown = [...shown].sort((a, b) => (sort === 'size' ? b.size - a.size : a.path.localeCompare(b.path)));
        const list = panel.querySelector('#media-list');
        list.innerHTML = shown.slice(0, 200).map(f => `<li class="mrow">
            <img class="thumb" loading="lazy" decoding="async" src="/${esc(f.path)}" alt="" width="48" height="48">
            <span class="label wrap">${esc(f.path.split('/').pop())}<span class="sub">${esc(f.path.split('/').slice(0, -1).join('/'))}</span></span>
            <span class="value">${f.size > LARGE ? '<span class="sev sev-warning">Large</span> ' : ''}${unused(f) ? '<span class="sev sev-info">Possibly unused</span> ' : ''}${bytes(f.size)}</span></li>`).join('')
            || '<li class="empty muted">No files match.</li>';
        panel.querySelector('#media-count').textContent = `${shown.length > 200 ? '200 of ' : ''}${fmt(shown.length)} shown`;
    };

    panel.innerHTML = `
        <dl class="stats stats-3">
            <div class="stat"><dt>Images</dt><dd>${fmt(files.length)}<span class="delta">on ${esc(media.repo.branch)}</span></dd></div>
            <div class="stat"><dt>Total size</dt><dd>${bytes(total)}<span class="delta">&nbsp;</span></dd></div>
            <div class="stat"><dt>Over 500 KB</dt><dd>${files.filter(f => f.size > LARGE).length}<span class="delta">worth shrinking</span></dd></div>
        </dl>
        ${media.repo.truncated ? '<div class="notice"><strong>List truncated.</strong>GitHub returned a partial file tree.</div>' : ''}
        <div class="toolbar">
            <input type="search" id="media-q" placeholder="Filter by name or folder" aria-label="Filter images" autocapitalize="none" autocorrect="off" spellcheck="false">
            <div class="seg" role="group" aria-label="Sort"><button type="button" data-sort="size" aria-pressed="true">Largest</button><button type="button" data-sort="name" aria-pressed="false">Name</button></div>
            <button type="button" class="btn btn-secondary" id="check-usage">Check for unused</button>
        </div>
        <div class="status-line" id="media-status" aria-live="polite"><span id="media-count"></span></div>
        <ul class="rows panel-list" id="media-list"></ul>`;

    panel.querySelector('#media-q').addEventListener('input', e => { query = e.target.value; paint(); });
    panel.querySelector('.seg').addEventListener('click', e => {
        const b = e.target.closest('[data-sort]');
        if (!b) return;
        sort = b.dataset.sort;
        panel.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        paint();
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
        if (tab === 'images') imagesTab(fresh, media, projects);
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
