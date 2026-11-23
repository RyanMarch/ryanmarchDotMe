import { buildReport, reportFilename } from './health-report.js';
import { api, apiProblem, esc } from './util.js';
import { go, href, onPop, parse } from './router.js';
import { sortFindings, summarize } from './audit.js';

const SEV_LABEL = { error: 'Error', warning: 'Warning', info: 'Note' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function openInEditor(id) {
    go(href('projects', [], { file: `content/${id}/index.html` }));
}

/** Findings grouped by subject, as panels. `projects` supplies display names. */
export function findingsHtml(findings, projects, filter = 'all') {
    const names = new Map(projects.map(p => [p.id, p.title]));
    const shown = filter === 'all' ? findings : findings.filter(f => f.severity === filter);
    if (!shown.length) return '<div class="panel"><div class="panel-body muted">Nothing to report here.</div></div>';

    const groups = new Map();
    for (const f of shown) {
        if (!groups.has(f.id)) groups.set(f.id, []);
        groups.get(f.id).push(f);
    }
    const rows = [...groups].map(([id, items]) => {
        const open = names.has(id) ? `<button type="button" class="linklike" data-open="${esc(id)}">Open write-up</button>` : '';
        return items.map((f, i) => `<tr${i === 0 ? ' class="first"' : ''}>
            <td data-label="Project" class="ht-project">${i === 0 ? `<strong>${esc(names.get(id) || id)}</strong>${open}` : ''}</td>
            <td data-label="Severity" class="ht-sev"><span class="sev sev-${f.severity}">${SEV_LABEL[f.severity]}</span></td>
            <td data-label="Finding" class="ht-msg">${esc(f.message)}</td></tr>`).join('');
    }).join('');
    return `<div class="table-wrap"><table class="dt ht">
        <thead><tr><th scope="col">Project</th><th scope="col">Severity</th><th scope="col">Finding</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
}

export function countsHtml(c, note = '') {
    return `<dl class="stats stats-3">
        <div class="stat"><dt>Errors</dt><dd>${c.error}<span class="delta">things that are broken</span></dd></div>
        <div class="stat"><dt>Warnings</dt><dd>${c.warning}<span class="delta">worth fixing</span></dd></div>
        <div class="stat"><dt>Notes</dt><dd>${c.info}<span class="delta">${esc(note) || 'nice to have'}</span></dd></div>
    </dl>`;
}

const FULL_KEY = 'admin_health_full';

export async function render(root, route = parse()) {
    const projects = (globalThis.myProjects || []).filter(p => !p.unpublished);
    const filterFrom = r => (['error', 'warning'].includes(r.query.get('show')) ? r.query.get('show') : 'all');
    let findings = [];
    let filter = filterFrom(route);
    let mode = 'quick'; // quick = data only, full = reads deployed files
    let running = false;
    let audit = null; // { at, total, failed } once the full audit has run

    root.innerHTML = /*html*/ `
        <div class="view-head">
            <div><h1>Content Health</h1><p>Checks the deployed site: SEO text, images, alt text, redirects and the sitemap.</p></div>
            <div class="head-actions">
                <div class="seg" role="group" aria-label="Show">
                    <button type="button" data-filter="all" aria-pressed="${filter === 'all'}">All</button>
                    <button type="button" data-filter="error" aria-pressed="${filter === 'error'}">Errors</button>
                    <button type="button" data-filter="warning" aria-pressed="${filter === 'warning'}">Warnings</button>
                </div>
                <button type="button" class="btn btn-secondary" id="export-report" title="Runs the full audit if needed, then downloads a Markdown report you can hand to an agent">Export report</button>
                <button type="button" class="btn btn-secondary" id="check-links" title="Visits every outside link in the write-ups and reports the ones that no longer work">Check links</button>
                <button type="button" class="btn" id="run-audit">Run full audit</button>
            </div>
        </div>
        <div id="health-status" class="status-line" aria-live="polite"></div>
        <div id="health-body"><div class="loading">Loading…</div></div>`;

    const body = root.querySelector('#health-body');
    const status = root.querySelector('#health-status');
    const runBtn = root.querySelector('#run-audit');
    const exportBtn = root.querySelector('#export-report');
    const linksBtn = root.querySelector('#check-links');

    const modeBar = () => (mode === 'full'
        ? `<div class="modebar"><span class="sev sev-ok">Full audit</span><span class="muted">Checked ${audit.total - audit.failed} of ${plural(audit.total, 'project')}, including write-ups and images, at ${esc(audit.at)}.${audit.failed ? ` ${audit.failed} could not be read.` : ''} Run it again to refresh.</span></div>`
        : `<div class="modebar"><span class="sev sev-info">Quick check</span><span class="muted">Project data, SEO text and redirects only. Write-up, alt text and image checks are not included, so this list is shorter than a full audit.</span><button type="button" class="linklike" data-run-full>Run full audit</button></div>`);

    const paint = () => {
        body.innerHTML = modeBar()
            + countsHtml(summarize(findings), mode === 'quick' ? 'quick check only' : 'full audit')
            + findingsHtml(findings, projects, filter);
    };

    // Coming back to this page (Back, or the sidebar) within a few minutes: show the last full audit instead of starting over.
    let restored = null;
    try { restored = JSON.parse(sessionStorage.getItem(FULL_KEY) || 'null'); } catch { /* ignore */ }
    if (restored && Date.now() - restored.when < 10 * 60 * 1000) {
        findings = restored.findings;
        mode = 'full';
        audit = restored.audit;
        paint();
    } else {
        // Fast pass: bundled data only, no file reads.
        const quick = await api('/api/admin/health?scope=summary');
        if (!quick.ok) { body.innerHTML = `<div class="notice"><strong>Couldn't run the check.</strong>${esc(apiProblem(quick))}</div>`; return; }
        findings = quick.body.findings;
        paint();
    }

    // Reads every write-up and image on top of the quick data checks. Resolves when the findings are updated.
    const runFull = async () => {
        if (running) return false;
        running = true;
        runBtn.disabled = true;
        exportBtn.disabled = true;
        try {
            const site = await api('/api/admin/health?scope=site');
            if (!site.ok) { status.textContent = apiProblem(site); return false; }
            const all = [...site.body.findings];
            const queue = projects.filter(p => p.hasExtendedContent || p.image).map(p => p.id);
            let done = 0, failed = 0;
            const worker = async () => {
                while (queue.length) {
                    const id = queue.shift();
                    const res = await api(`/api/admin/health?project=${encodeURIComponent(id)}`);
                    if (res.ok) all.push(...res.body.findings); else failed += 1;
                    done += 1;
                    status.textContent = `Auditing ${done} of ${done + queue.length}…`;
                }
            };
            const total = queue.length;
            await Promise.all([worker(), worker(), worker(), worker()]);
            findings = sortFindings(all);
            mode = 'full';
            audit = { at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), total, failed };
            status.textContent = '';
            paint();
            try { sessionStorage.setItem(FULL_KEY, JSON.stringify({ when: Date.now(), findings, audit })); } catch { /* storage full or blocked */ }
            return true;
        } finally {
            runBtn.disabled = false;
            exportBtn.disabled = false;
            running = false;
        }
    };

    runBtn.addEventListener('click', runFull);

    // Visit the outside links in each write-up and add the dead ones to the list.
    const runLinks = async () => {
        if (running) return;
        running = true;
        [runBtn, exportBtn, linksBtn].forEach(b => { b.disabled = true; });
        try {
            const queue = projects.filter(p => p.hasExtendedContent).map(p => p.id);
            const total = queue.length;
            const broken = [];
            let checked = 0, unverified = 0, done = 0, failed = 0;
            const worker = async () => {
                while (queue.length) {
                    const id = queue.shift();
                    const res = await api(`/api/admin/links?project=${encodeURIComponent(id)}`);
                    if (res.ok) {
                        for (const l of res.body.links) {
                            checked += 1;
                            if (l.state === 'broken') broken.push({ severity: 'error', check: 'link-broken', id, message: `Link is broken (${l.status ? `HTTP ${l.status}` : 'no answer'}): ${l.url}` });
                            else if (l.state === 'unverified') unverified += 1;
                        }
                    } else failed += 1;
                    done += 1;
                    status.textContent = `Checking links in write-up ${done} of ${total}…`;
                }
            };
            await Promise.all([worker(), worker(), worker(), worker()]);
            findings = sortFindings([...findings.filter(f => f.check !== 'link-broken'), ...broken]);
            paint();
            status.textContent = `Checked ${checked} outside link${checked === 1 ? '' : 's'} in ${total - failed} write-ups: ${broken.length} broken${unverified ? `, ${unverified} could not be verified (those sites refuse automated checks)` : ''}${failed ? `; ${failed} write-ups could not be read` : ''}.`;
            if (audit) { try { sessionStorage.setItem(FULL_KEY, JSON.stringify({ when: Date.now(), findings, audit })); } catch { /* storage full or blocked */ } }
        } finally {
            [runBtn, exportBtn, linksBtn].forEach(b => { b.disabled = false; });
            running = false;
        }
    };
    linksBtn.addEventListener('click', runLinks);

    exportBtn.addEventListener('click', async () => {
        // A report should match what the full audit finds, so run it first if only the quick check has run.
        if (mode !== 'full' && !(await runFull())) return;
        const text = buildReport({ findings, projects, mode, filter });
        const blob = new Blob([text], { type: 'text/markdown' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = reportFilename();
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        let copied = false;
        try { await navigator.clipboard.writeText(text); copied = true; } catch { /* clipboard blocked */ }
        status.textContent = `Report downloaded${copied ? ' and copied to the clipboard' : ''}, from the full audit.`;
    });

    root.querySelector('.seg').addEventListener('click', e => {
        const btn = e.target.closest('button[data-filter]');
        if (!btn) return;
        filter = btn.dataset.filter;
        root.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        paint();
        go(href('health', [], { show: filter === 'all' ? '' : filter }), { quiet: true });
    });

    body.addEventListener('click', e => {
        if (e.target.closest('[data-run-full]')) { runFull(); return; }
        const open = e.target.closest('[data-open]');
        if (open) openInEditor(open.dataset.open);
    });

    onPop(r => {
        filter = filterFrom(r);
        root.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
        paint();
    });
}
