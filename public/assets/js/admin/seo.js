// "Redirects & SEO": a table editor for config/redirects.json and a per-project SEO overview.
import { api, esc } from './util.js';
import { auditProjectMeta, auditRedirects, SEO_DESCRIPTION, SEO_TITLE, summarize } from './audit.js';
import { openInEditor } from './health.js';

const branch = () => (typeof window.getSelectedBranch === 'function' && window.getSelectedBranch()) || 'main';
const authHeaders = () => (typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {});

export function b64ToText(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
export function textToB64(text) {
    let bin = '';
    for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
    return btoa(bin);
}

const SEV = { error: 'Error', warning: 'Warning', info: 'Note' };

/* ───────────── Redirects tab ───────────── */

function redirectRow(r, i, notes) {
    return `<li class="rrow" data-i="${i}">
        <div class="field"><label for="rs-${i}">Source</label><input id="rs-${i}" data-f="source" value="${esc(r.source)}" placeholder="/old-path" autocapitalize="none" autocorrect="off" spellcheck="false"></div>
        <div class="field"><label for="rd-${i}">Destination</label><input id="rd-${i}" data-f="destination" value="${esc(r.destination)}" placeholder="/new-path or https://…" autocapitalize="none" autocorrect="off" spellcheck="false"></div>
        <div class="field field-check"><label><input type="checkbox" data-f="permanent" ${r.permanent !== false ? 'checked' : ''}> Permanent (301)</label></div>
        <div class="field field-end"><button type="button" class="btn btn-secondary" data-del="${i}" aria-label="Delete redirect from ${esc(r.source || 'new row')}">Delete</button></div>
        ${notes.length ? `<ul class="row-notes">${notes.map(n => `<li><span class="sev sev-${n.severity}">${SEV[n.severity]}</span> ${esc(n.message)}</li>`).join('')}</ul>` : ''}
    </li>`;
}

async function renderRedirects(panel) {
    panel.innerHTML = '<div class="loading">Loading redirects…</div>';
    const res = await api(`/api/admin/file?path=redirects.json&branch=${encodeURIComponent(branch())}`);
    if (!res.ok) {
        panel.innerHTML = `<div class="notice"><strong>Couldn't load redirects.json.</strong>${esc(res.status === 401 ? 'Not authorized.' : 'The GitHub connection is not configured for this environment, or the file could not be read.')}</div>`;
        return;
    }
    const original = b64ToText(res.body.content);
    let sha = res.body.sha;
    let list;
    try { list = JSON.parse(original); } catch { panel.innerHTML = '<div class="notice"><strong>redirects.json is not valid JSON.</strong>Fix it in the editor first.</div>'; return; }
    const trailingNewline = original.endsWith('\n');
    const baseline = JSON.stringify(list);

    const projects = () => globalThis.myProjects || [];
    const notesFor = () => {
        const all = auditRedirects(list, projects());
        const by = new Map();
        for (const f of all) { if (!by.has(f.id)) by.set(f.id, []); by.get(f.id).push(f); }
        return { all, by };
    };

    const draw = () => {
        const { all, by } = notesFor();
        const c = summarize(all);
        const dirty = JSON.stringify(list) !== baseline;
        panel.innerHTML = `
            <p class="muted tab-intro">Redirects run before everything else on the site. Query strings are carried through. Changes commit to <strong>${esc(branch())}</strong>.</p>
            <ul class="rrows">${list.map((r, i) => redirectRow(r, i, by.get(r.source) || [])).join('') || '<li class="empty muted">No redirects yet.</li>'}</ul>
            <div class="actions">
                <button type="button" class="btn btn-secondary" id="add-redirect">Add redirect</button>
                <button type="button" class="btn" id="save-redirects" ${!dirty || c.error ? 'disabled' : ''}>Save to ${esc(branch())}</button>
                <span class="status-line" id="redirect-status" aria-live="polite">${c.error ? `Fix ${c.error} error${c.error === 1 ? '' : 's'} before saving.` : dirty ? 'Unsaved changes.' : ''}</span>
            </div>`;
    };

    panel.addEventListener('input', e => {
        const row = e.target.closest('.rrow');
        const f = e.target.dataset.f;
        if (!row || !f) return;
        const i = Number(row.dataset.i);
        list[i][f] = f === 'permanent' ? e.target.checked : e.target.value.trim();
        // Re-evaluate notes/buttons without rebuilding the focused input.
        const { all, by } = notesFor();
        const c = summarize(all);
        panel.querySelectorAll('.rrow').forEach((el, idx) => {
            let ul = el.querySelector('.row-notes');
            const notes = by.get(list[idx].source) || [];
            const html = notes.map(n => `<li><span class="sev sev-${n.severity}">${SEV[n.severity]}</span> ${esc(n.message)}</li>`).join('');
            if (!notes.length) { ul?.remove(); return; }
            if (!ul) { ul = document.createElement('ul'); ul.className = 'row-notes'; el.appendChild(ul); }
            ul.innerHTML = html;
        });
        const dirty = JSON.stringify(list) !== baseline;
        panel.querySelector('#save-redirects').disabled = !dirty || c.error > 0;
        panel.querySelector('#redirect-status').textContent = c.error ? `Fix ${c.error} error${c.error === 1 ? '' : 's'} before saving.` : dirty ? 'Unsaved changes.' : '';
    });

    panel.addEventListener('click', async e => {
        if (e.target.closest('#add-redirect')) {
            list.push({ source: '', destination: '', permanent: true });
            draw();
            panel.querySelector(`#rs-${list.length - 1}`)?.focus();
            return;
        }
        const del = e.target.closest('[data-del]');
        if (del) {
            const i = Number(del.dataset.del);
            if (list[i].source && !confirm(`Delete the redirect from ${list[i].source}?`)) return;
            list.splice(i, 1);
            draw();
            return;
        }
        const save = e.target.closest('#save-redirects');
        if (save && !save.disabled) {
            save.disabled = true;
            const status = panel.querySelector('#redirect-status');
            status.textContent = 'Saving…';
            const text = JSON.stringify(list, null, 2) + (trailingNewline ? '\n' : '');
            try {
                const r = await fetch('/api/admin/file', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ path: 'redirects.json', branch: branch(), sha, content: textToB64(text), message: 'admin: update redirects' })
                });
                if (!r.ok) throw new Error(r.status === 409 ? 'The file changed on GitHub; reload and try again.' : `GitHub returned ${r.status}.`);
                sha = (await r.json()).sha;
                status.textContent = `Saved to ${branch()}. It goes live with the next deploy.`;
                // Reload from GitHub so the baseline and sha are authoritative.
                return renderRedirectsAfterSave(panel);
            } catch (err) {
                status.textContent = `Save failed: ${err.message}`;
                save.disabled = false;
            }
        }
    });

    draw();
}

async function renderRedirectsAfterSave(panel) {
    const msg = 'Saved. It goes live with the next deploy.';
    const fresh = panel.cloneNode(false);
    panel.replaceWith(fresh);
    await renderRedirects(fresh);
    const s = fresh.querySelector('#redirect-status');
    if (s) s.textContent = msg;
}

/* ───────────── SEO tab ───────────── */

function lenCell(text, { min, max }) {
    const n = (text || '').trim().length;
    if (!n) return '<span class="sev sev-warning">Missing</span>';
    const cls = n > max ? 'sev-warning' : n < min ? 'sev-info' : 'sev-ok';
    const label = n > max ? 'Too long' : n < min ? 'Short' : 'Good';
    return `<span class="sev ${cls}">${label}</span> <span class="num muted">${n}/${max}</span>`;
}

function renderSeo(panel, onlyIssues) {
    const projects = (globalThis.myProjects || []).filter(p => p.hasExtendedContent);
    const rows = projects.map(p => ({ p, issues: auditProjectMeta(p) })).filter(r => !onlyIssues || r.issues.length);
    panel.innerHTML = `
        <p class="muted tab-intro">What search engines and social previews see for each project page. Limits: title ${SEO_TITLE.max}, description ${SEO_DESCRIPTION.max} characters.</p>
        <label class="check-line"><input type="checkbox" id="only-issues" ${onlyIssues ? 'checked' : ''}> Only projects with issues</label>
        <ul class="srows">${rows.map(({ p }) => `
            <li class="srow">
                <div class="srow-head"><strong>${esc(p.title)}</strong>
                    <button type="button" class="linklike" data-open="${esc(p.id)}">Edit</button></div>
                <dl class="srow-grid">
                    <div><dt>SEO title</dt><dd>${lenCell(p.seoTitle, SEO_TITLE)}<span class="clip">${esc(p.seoTitle || '')}</span></dd></div>
                    <div><dt>Description</dt><dd>${lenCell(p.seoDescription, SEO_DESCRIPTION)}<span class="clip">${esc(p.seoDescription || '')}</span></dd></div>
                    <div><dt>Share image</dt><dd>${p.ogImage ? `<span class="sev sev-ok">Set</span> <span class="muted">${esc(p.ogImage.split('/').pop())}</span>` : '<span class="sev sev-warning">Missing</span>'}</dd></div>
                </dl>
            </li>`).join('') || '<li class="empty muted">No projects with issues.</li>'}</ul>`;
    panel.querySelector('#only-issues').addEventListener('change', e => renderSeo(panel, e.target.checked));
    panel.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openInEditor(b.dataset.open)));
}

/* ───────────── View shell ───────────── */

export async function render(root) {
    let tab = sessionStorage.getItem('admin_seo_tab') === 'seo' ? 'seo' : 'redirects';
    root.innerHTML = `
        <div class="view-head"><div><h1>Redirects &amp; SEO</h1><p>Edit redirects and review the text search engines and link previews use.</p></div></div>
        <div class="tabs" role="tablist" aria-label="Redirects and SEO">
            <button role="tab" type="button" id="tab-redirects" data-tab="redirects" aria-selected="${tab === 'redirects'}" aria-controls="seo-panel">Redirects</button>
            <button role="tab" type="button" id="tab-seo" data-tab="seo" aria-selected="${tab === 'seo'}" aria-controls="seo-panel">SEO</button>
        </div>
        <div id="seo-panel" role="tabpanel" class="panel-body tabpanel"></div>`;

    const show = async () => {
        root.querySelectorAll('[role=tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
        // A fresh node each time drops the previous tab's event listeners.
        const fresh = root.querySelector('#seo-panel').cloneNode(false);
        root.querySelector('#seo-panel').replaceWith(fresh);
        fresh.setAttribute('aria-labelledby', `tab-${tab}`);
        if (tab === 'redirects') await renderRedirects(fresh); else renderSeo(fresh, false);
    };
    root.querySelector('.tabs').addEventListener('click', e => {
        const t = e.target.closest('[data-tab]');
        if (!t || t.dataset.tab === tab) return;
        tab = t.dataset.tab;
        try { sessionStorage.setItem('admin_seo_tab', tab); } catch { /* private mode */ }
        show();
    });
    await show();
}
