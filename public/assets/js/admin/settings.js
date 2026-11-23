import { api, esc, send } from './util.js';
import { go, href } from './router.js';
import { confirmDialog, toast } from './ui.js';
import { reorderProjects, setUnpublished } from './project-order.js';
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

const WHEN = iso => new Date(iso).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Publish or unpublish a project at a set time. The Worker applies it on main from a cron that runs every 15 minutes. */
async function schedulePanel(el) {
    const res = await api('/api/admin/schedule');
    if (!res.ok || !res.body.available) { el.innerHTML = `<div class="panel-body muted">${esc(res.body?.message || 'Scheduling is not available here.')}</div>`; return; }
    const titles = new Map((globalThis.myProjects || []).map(p => [p.id, p.title]));
    const name = id => titles.get(id) || id;
    const draw = state => {
        const projects = (globalThis.myProjects || []).slice().sort((a, b) => a.title.localeCompare(b.title));
        el.innerHTML = `<p class="muted tab-intro">Pick a time and a project; it publishes or unpublishes itself on <strong>main</strong>, within 15 minutes of then. Times are in your local time zone.</p>
            ${state.items.length ? `<ul class="rows">${state.items.map(i => `<li><span class="label">${esc(name(i.id))}<span class="sub">${i.action === 'publish' ? 'Publish' : 'Unpublish'} · ${esc(WHEN(i.at))}</span></span><span class="value"><button type="button" class="linklike danger" data-cancel="${esc(i.id)}">Cancel</button></span></li>`).join('')}</ul>` : '<p class="empty-note">Nothing scheduled.</p>'}
            <form class="sched-form" id="sched-form">
                <label>Project<select name="project" required>${projects.map(p => `<option value="${esc(p.id)}">${esc(p.title)}${p.unpublished ? ' (unpublished)' : ''}</option>`).join('')}</select></label>
                <label>Action<select name="action"><option value="unpublish">Unpublish</option><option value="publish">Publish</option></select></label>
                <label>When<input type="datetime-local" name="at" required></label>
                <button type="submit" class="btn">Schedule</button>
            </form>
            ${(state.log || []).length ? `<h3 class="sec-title">Recent</h3><ul class="rows">${state.log.slice(0, 5).map(l => `<li><span class="label wrap">${esc(name(l.id))}<span class="sub">${l.action === 'publish' ? 'Publish' : 'Unpublish'} · ${esc(WHEN(l.at))}${l.note ? ` · ${esc(l.note)}` : ''}</span></span><span class="value"><span class="sev sev-${l.ok ? 'info' : 'error'}">${l.ok ? 'Done' : 'Failed'}</span></span></li>`).join('')}</ul>` : ''}`;
    };
    draw(res.body);
    el.addEventListener('submit', async e => {
        e.preventDefault();
        const f = new FormData(e.target);
        const out = await send('/api/admin/schedule', 'POST', { project: f.get('project'), action: f.get('action'), at: new Date(f.get('at')).toISOString() });
        if (!out.ok) { window.adminAlert(out.body?.message || 'Could not schedule that.', { title: 'Schedule' }); return; }
        draw(out.body);
        window.adminToast?.('Scheduled.', { type: 'success' });
    });
    el.addEventListener('click', async e => {
        const c = e.target.closest('[data-cancel]');
        if (!c) return;
        const out = await send(`/api/admin/schedule?project=${encodeURIComponent(c.dataset.cancel)}`, 'DELETE');
        if (out.ok) draw(out.body);
    });
}

async function orderPanel(el) {
    el.innerHTML = '<div class="loading">Loading projects…</div>';
    const res = await api(`/api/admin/file?path=assets/js/project-data.js&branch=${encodeURIComponent(branch())}`);
    if (!res.ok) { el.innerHTML = '<div class="panel-body muted">Project order needs GitHub access, which is not configured for this environment.</div>'; return; }
    let source = b64ToText(res.body.content);
    let sha = res.body.sha;
    let projects;
    try { projects = parseProjectDataSource(source).map(p => ({ id: p.id, title: p.title, unpublished: p.unpublished === true })); } catch { el.innerHTML = '<div class="panel-body muted">project-data.js could not be parsed.</div>'; return; }
    const signature = () => projects.map(p => p.id + (p.unpublished ? '!' : '')).join(',');
    let saved = projects.map(p => ({ ...p })); // what GitHub has right now
    let original = signature();
    let moved = null;
    let skipConfirm = false; // set by Undo, which should not ask again

    const draw = () => {
        const dirty = signature() !== original;
        el.innerHTML = `
            <p class="muted tab-intro">The order here is the order of the homepage grid (top = first). Unpublishing hides a project from the homepage, its page, and the sitemap; nothing is deleted, and you can publish it again at any time. Changes commit to <strong>${esc(branch())}</strong>.</p>
            <ol class="orderlist">${projects.map((p, i) => `<li class="${moved === p.id ? 'moved' : ''}${p.unpublished ? ' is-off' : ''}">
                <span class="pos num">${i + 1}</span><span class="label">${esc(p.title)}${p.unpublished ? ' <span class="sev sev-info">Unpublished</span>' : ''}</span>
                <span class="order-btns">
                    <button type="button" class="btn btn-secondary" data-act="top" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(p.title)} to the top">Top</button>
                    <button type="button" class="btn btn-secondary" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(p.title)} up">Up</button>
                    <button type="button" class="btn btn-secondary" data-act="down" data-i="${i}" ${i === projects.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(p.title)} down">Down</button>
                    <button type="button" class="btn btn-secondary" data-act="toggle" data-i="${i}" aria-label="${p.unpublished ? 'Publish' : 'Unpublish'} ${esc(p.title)}">${p.unpublished ? 'Publish' : 'Unpublish'}</button>
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
            if (b.dataset.act === 'toggle') {
                projects[i].unpublished = !projects[i].unpublished;
                moved = projects[i].id;
                draw();
                el.querySelector(`li.moved [data-act="toggle"]`)?.focus();
                return;
            }
            const [item] = projects.splice(i, 1);
            const to = b.dataset.act === 'top' ? 0 : b.dataset.act === 'up' ? i - 1 : i + 1;
            projects.splice(to, 0, item);
            moved = item.id;
            draw();
            el.querySelector(`li.moved [data-act="${b.dataset.act === 'top' ? 'down' : b.dataset.act}"]`)?.focus();
            return;
        }
        if (e.target.closest('#reset-order')) {
            projects = saved.map(p => ({ ...p }));
            moved = null; draw(); return;
        }
        const save = e.target.closest('#save-order');
        if (save && !save.disabled) {
            const status = el.querySelector('#order-status');
            const nowOff = projects.filter(p => p.unpublished && !saved.find(s => s.id === p.id)?.unpublished);
            if (nowOff.length && !skipConfirm && !(await confirmDialog({
                title: `Unpublish ${nowOff.map(p => p.title).join(', ')}?`,
                message: 'After the next deploy it disappears from the homepage and its page returns a 404. Nothing is deleted; you can publish it again here.',
                confirmLabel: 'Unpublish'
            }))) return;
            const wasUndo = skipConfirm;
            skipConfirm = false;
            const before = saved.map(p => ({ ...p })); // what to go back to if the person taps Undo
            save.disabled = true;
            status.textContent = 'Saving…';
            try {
                const order = projects.map(p => p.id);
                let next = reorderProjects(source, order);
                for (const p of projects) {
                    if (p.unpublished !== saved.find(s => s.id === p.id).unpublished) next = setUnpublished(next, p.id, p.unpublished);
                }
                // Safety net: the rewritten file must still parse to the same projects, order and visibility.
                const check = parseProjectDataSource(next);
                if (check.map(p => p.id).join(',') !== order.join(',') || check.some((p, i) => (p.unpublished === true) !== projects[i].unpublished)) {
                    throw new Error('The rewritten file did not match the requested changes; nothing was saved.');
                }
                const nowOn = projects.filter(p => !p.unpublished && saved.find(s => s.id === p.id)?.unpublished);
                const reordered = order.join(',') !== saved.map(p => p.id).join(',');
                const parts = [
                    nowOff.length && `unpublish ${nowOff.map(p => p.id).join(', ')}`,
                    nowOn.length && `publish ${nowOn.map(p => p.id).join(', ')}`,
                    reordered && 'reorder homepage projects'
                ].filter(Boolean);
                const r = await fetch('/api/admin/file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ path: 'assets/js/project-data.js', branch: branch(), sha, content: textToB64(next), message: `admin: ${parts.join('; ')}` })
                });
                if (!r.ok) throw new Error(r.status === 409 ? 'The file changed on GitHub; reload and try again.' : `GitHub returned ${r.status}.`);
                const result = await r.json();
                sha = result.sha;
                source = next;
                saved = projects.map(p => ({ ...p }));
                original = signature();
                moved = null;
                draw();
                const statusEl = el.querySelector('#order-status');
                statusEl.textContent = `Saved to ${branch()}. Checking the build…`;
                window.adminTrackDeploy?.({ branch: branch(), commit: result.commit }, s => { if (statusEl.isConnected) statusEl.textContent = s.text; });
                const changes = [nowOff.length && `Unpublished ${nowOff.map(p => p.title).join(', ')}`, nowOn.length && `Published ${nowOn.map(p => p.title).join(', ')}`, reordered && !nowOff.length && !nowOn.length && 'Homepage order saved'].filter(Boolean);
                if (wasUndo) toast('Change undone.', { type: 'success' });
                else if (changes.length) {
                    toast(`${changes.join('. ')}.`, {
                        type: 'success',
                        duration: 10000,
                        action: {
                            label: 'Undo',
                            onClick: () => {
                                projects = before.map(p => ({ ...p }));
                                moved = null;
                                draw();
                                skipConfirm = true;
                                el.querySelector('#save-order')?.click();
                            }
                        }
                    });
                }
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
        <div class="view-head"><div><h1>Settings</h1><p>What this admin is connected to, which projects are published and in what order, and the site's core files.</p></div></div>
        <div class="settings-grid">
        <div class="settings-side">
        <section class="panel s-conn"><header><h2>Connections</h2></header><div id="status-panel"><div class="loading">Checking…</div></div></section>
        <section class="panel s-files"><header><h2>Site files</h2></header>
            <ul class="rows">${SITE_FILES.map(([path, name, note]) => `<li><span class="label wrap">${esc(name)}<span class="sub">${esc(note)}</span></span><span class="value"><button type="button" class="linklike" data-file="${esc(path)}">Edit</button></span></li>`).join('')}</ul></section></div>
        <div class="settings-main">
        <section class="panel s-order"><header><h2>Projects: order and visibility</h2></header><div id="order-panel" class="panel-body"></div></section>
        <section class="panel s-sched"><header><h2>Scheduled changes</h2></header><div id="sched-panel" class="panel-body"><div class="loading">Loading…</div></div></section></div></div>`;

    statusPanel(root.querySelector('#status-panel'));
    orderPanel(root.querySelector('#order-panel'));
    schedulePanel(root.querySelector('#sched-panel'));
    root.addEventListener('click', e => {
        const f = e.target.closest('[data-file]');
        if (!f) return;
        go(href('projects', [], { file: f.dataset.file }));
    });
}
