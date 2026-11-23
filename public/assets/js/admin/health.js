import { buildReport, reportFilename } from './health-report.js';
import { api, apiProblem, esc } from './util.js';
import { sortFindings, summarize } from './audit.js';

const SEV_LABEL = { error: 'Error', warning: 'Warning', info: 'Note' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function openInEditor(id) {
    location.hash = '#/projects';
    setTimeout(() => {
        if (typeof window.loadFile === 'function') window.loadFile(`content/${id}/index.html`);
    }, 60);
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
    return [...groups].map(([id, items]) => {
        const counts = summarize(items);
        const meta = [counts.error && plural(counts.error, 'error'), counts.warning && plural(counts.warning, 'warning'), counts.info && plural(counts.info, 'note')].filter(Boolean).join(' · ');
        return `<section class="panel">
            <header><h2>${esc(names.get(id) || id)}</h2><span class="meta">${esc(meta)}</span></header>
            <ul class="rows">${items.map(f => `<li><span class="label wrap"><span class="sev sev-${f.severity}">${SEV_LABEL[f.severity]}</span> ${esc(f.message)}</span></li>`).join('')}</ul>
            ${names.has(id) ? `<div class="panel-foot"><button type="button" class="linklike" data-open="${esc(id)}">Open write-up in editor</button></div>` : ''}
        </section>`;
    }).join('');
}

export function countsHtml(c, note = '') {
    return `<dl class="stats stats-3">
        <div class="stat"><dt>Errors</dt><dd>${c.error}<span class="delta">things that are broken</span></dd></div>
        <div class="stat"><dt>Warnings</dt><dd>${c.warning}<span class="delta">worth fixing</span></dd></div>
        <div class="stat"><dt>Notes</dt><dd>${c.info}<span class="delta">${esc(note) || 'nice to have'}</span></dd></div>
    </dl>`;
}

export async function render(root) {
    const projects = (globalThis.myProjects || []).filter(p => !p.unpublished);
    let findings = [];
    let filter = 'all';
    let mode = 'quick'; // quick = data only, full = reads deployed files
    let running = false;

    root.innerHTML = /*html*/ `
        <div class="view-head">
            <div><h1>Content Health</h1><p>Checks the deployed site: SEO text, images, alt text, redirects and the sitemap.</p></div>
            <div class="head-actions">
                <div class="seg" role="group" aria-label="Show">
                    <button type="button" data-filter="all" aria-pressed="true">All</button>
                    <button type="button" data-filter="error" aria-pressed="false">Errors</button>
                    <button type="button" data-filter="warning" aria-pressed="false">Warnings</button>
                </div>
                <button type="button" class="btn btn-secondary" id="export-report" title="Runs the full audit if needed, then downloads a Markdown report you can hand to an agent">Export report</button>
                <button type="button" class="btn" id="run-audit">Run full audit</button>
            </div>
        </div>
        <div id="health-status" class="status-line" aria-live="polite"></div>
        <div id="health-body"><div class="loading">Loading…</div></div>`;

    const body = root.querySelector('#health-body');
    const status = root.querySelector('#health-status');
    const runBtn = root.querySelector('#run-audit');
    const exportBtn = root.querySelector('#export-report');

    const paint = () => {
        body.innerHTML = countsHtml(summarize(findings), mode === 'quick' ? 'quick check' : 'full audit')
            + findingsHtml(findings, projects, filter);
    };

    // Fast pass: bundled data only, no file reads.
    const quick = await api('/api/admin/health?scope=summary');
    if (!quick.ok) { body.innerHTML = `<div class="notice"><strong>Couldn't run the check.</strong>${esc(apiProblem(quick))}</div>`; return; }
    findings = quick.body.findings;
    status.textContent = 'Quick check done. Run the full audit to also read each write-up and image.';
    paint();

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
            status.textContent = `Audited ${total - failed} of ${plural(total, 'project')}${failed ? `; ${failed} could not be read` : ''}.`;
            paint();
            return true;
        } finally {
            runBtn.disabled = false;
            exportBtn.disabled = false;
            running = false;
        }
    };

    runBtn.addEventListener('click', runFull);

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
    });

    body.addEventListener('click', e => {
        const open = e.target.closest('[data-open]');
        if (open) openInEditor(open.dataset.open);
    });
}
