import { api, esc } from './util.js';
import { reorderProjects } from './project-order.js';
import { parseProjectDataSource } from '/assets/js/admin-project-parser.js';
import { b64ToText, textToB64 } from './seo.js';

const authHeaders = () => (typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {});
const branch = () => (typeof window.getSelectedBranch === 'function' && window.getSelectedBranch()) || 'main';

const SITE_FILES = [
    ['index.html', 'Homepage wrapper', 'Page shell, header, footer and structured data'],
    ['assets/js/project-data.js', 'Projects database', 'Every project card and its SEO fields'],
    ['sitemap.xml', 'Sitemap', 'Regenerated on each build; edit only to fix a one-off'],
    ['robots.txt', 'robots.txt', 'Crawler rules']
];

async function statusPanel(el) {
    const res = await api('/api/admin/status');
    if (!res.ok) { el.innerHTML = '<div class="panel-body muted">Status unavailable.</div>'; return; }
    el.innerHTML = `<ul class="rows">${res.body.items.map(i => {
        const bad = !i.ok && !i.optional;
        const cls = i.ok ? 'ok' : bad ? 'error' : 'info';
        const word = i.invert ? (i.ok ? 'OK' : 'Review') : i.ok ? 'Connected' : i.optional ? 'Not set' : 'Missing';
        return `<li><span class="label wrap">${esc(i.label)}<span class="sub">${esc(i.detail)}${i.host && i.ok ? ` · ${esc(i.host)}` : ''}</span></span><span class="value"><span class="sev sev-${i.invert && !i.ok ? 'warning' : cls}">${word}</span></span></li>`;
    }).join('')}</ul>`;
}

async function orderPanel(el) {
    el.innerHTML = '<div class="loading">Loading project order…</div>';
    const res = await api(`/api/admin/file?path=assets/js/project-data.js&branch=${encodeURIComponent(branch())}`);
    if (!res.ok) { el.innerHTML = '<div class="panel-body muted">Project order needs GitHub access, which is not configured for this environment.</div>'; return; }
    let source = b64ToText(res.body.content);
    let sha = res.body.sha;
    let projects;
    try { projects = parseProjectDataSource(source).map(p => ({ id: p.id, title: p.title })); } catch { el.innerHTML = '<div class="panel-body muted">project-data.js could not be parsed.</div>'; return; }
    let original = projects.map(p => p.id).join(',');
    let moved = null;

    const draw = () => {
        const dirty = projects.map(p => p.id).join(',') !== original;
        el.innerHTML = `
            <p class="muted tab-intro">The order here is the order of the homepage grid (top = first). Changes commit to <strong>${esc(branch())}</strong>.</p>
            <ol class="orderlist">${projects.map((p, i) => `<li class="${moved === p.id ? 'moved' : ''}">
                <span class="pos num">${i + 1}</span><span class="label">${esc(p.title)}</span>
                <span class="order-btns">
                    <button type="button" class="btn btn-secondary" data-act="top" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(p.title)} to the top">Top</button>
                    <button type="button" class="btn btn-secondary" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(p.title)} up">Up</button>
                    <button type="button" class="btn btn-secondary" data-act="down" data-i="${i}" ${i === projects.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(p.title)} down">Down</button>
                </span></li>`).join('')}</ol>
            <div class="actions"><button type="button" class="btn" id="save-order" ${dirty ? '' : 'disabled'}>Save to ${esc(branch())}</button>
                <button type="button" class="btn btn-secondary" id="reset-order" ${dirty ? '' : 'disabled'}>Reset</button>
                <span class="status-line" id="order-status" aria-live="polite">${dirty ? 'Unsaved changes.' : ''}</span></div>`;
        if (moved) el.querySelector('li.moved button:not([disabled])')?.focus();
    };

    el.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]');
        if (b) {
            const i = Number(b.dataset.i);
            const [item] = projects.splice(i, 1);
            const to = b.dataset.act === 'top' ? 0 : b.dataset.act === 'up' ? i - 1 : i + 1;
            projects.splice(to, 0, item);
            moved = item.id;
            draw();
            el.querySelector(`li.moved [data-act="${b.dataset.act === 'top' ? 'down' : b.dataset.act}"]`)?.focus();
            return;
        }
        if (e.target.closest('#reset-order')) {
            projects.sort((a, c) => original.split(',').indexOf(a.id) - original.split(',').indexOf(c.id));
            moved = null; draw(); return;
        }
        const save = e.target.closest('#save-order');
        if (save && !save.disabled) {
            const status = el.querySelector('#order-status');
            save.disabled = true;
            status.textContent = 'Saving…';
            try {
                const order = projects.map(p => p.id);
                const next = reorderProjects(source, order);
                // Safety net: the rewritten file must still parse to the same projects in the new order.
                const check = parseProjectDataSource(next).map(p => p.id);
                if (check.join(',') !== order.join(',')) throw new Error('The rewritten file did not match the requested order; nothing was saved.');
                const r = await fetch('/api/admin/file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ path: 'assets/js/project-data.js', branch: branch(), sha, content: textToB64(next), message: 'admin: reorder homepage projects' })
                });
                if (!r.ok) throw new Error(r.status === 409 ? 'The file changed on GitHub; reload and try again.' : `GitHub returned ${r.status}.`);
                sha = (await r.json()).sha;
                source = next;
                original = order.join(',');
                moved = null;
                draw();
                el.querySelector('#order-status').textContent = `Saved to ${branch()}. It goes live with the next deploy.`;
            } catch (err) {
                status.textContent = `Not saved: ${err.message}`;
                save.disabled = false;
            }
        }
    });
    draw();
}

export async function render(root) {
    root.innerHTML = `
        <div class="view-head"><div><h1>Settings</h1><p>What this admin is connected to, the homepage order, and the site's core files.</p></div></div>
        <section class="panel"><header><h2>Connections</h2></header><div id="status-panel"><div class="loading">Checking…</div></div></section>
        <section class="panel"><header><h2>Homepage order</h2></header><div id="order-panel" class="panel-body"></div></section>
        <section class="panel"><header><h2>Site files</h2></header>
            <ul class="rows">${SITE_FILES.map(([path, name, note]) => `<li><span class="label wrap">${esc(name)}<span class="sub">${esc(note)}</span></span><span class="value"><button type="button" class="linklike" data-file="${esc(path)}">Edit</button></span></li>`).join('')}</ul></section>`;

    statusPanel(root.querySelector('#status-panel'));
    orderPanel(root.querySelector('#order-panel'));
    root.addEventListener('click', e => {
        const f = e.target.closest('[data-file]');
        if (!f) return;
        location.hash = '#/projects';
        setTimeout(() => { if (typeof window.loadFile === 'function') window.loadFile(f.dataset.file); }, 60);
    });
}
