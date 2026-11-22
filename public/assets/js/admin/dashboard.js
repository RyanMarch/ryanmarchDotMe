import { api, apiProblem, barRows, deltaText, esc, fmt, relativeTime, setupNotice } from './util.js';
import { pageLabel } from './analytics.js';

function statBox(label, value, sub) {
    return `<div class="stat"><dt>${esc(label)}</dt><dd>${value}<span class="delta">${sub}</span></dd></div>`;
}

export async function render(root) {
    root.innerHTML = `
        <div class="view-head"><div><h1>Dashboard</h1><p>Last 7 days, plus what's happening in the repo.</p></div></div>
        <div id="dash-body" aria-live="polite"><div class="loading">Loading…</div></div>`;
    const body = root.querySelector('#dash-body');
    const branch = (typeof window.getSelectedBranch === 'function' && window.getSelectedBranch()) || 'main';

    const [overview, analytics, health] = await Promise.all([
        api(`/api/admin/overview?branch=${encodeURIComponent(branch)}`),
        api('/api/admin/analytics?days=7'),
        api('/api/admin/health?scope=summary')
    ]);

    const parts = [];
    const a = analytics.ok ? analytics.body : null;
    const o = overview.ok ? overview.body : null;

    if (analytics.status === 501) parts.push(setupNotice());
    else if (!analytics.ok) parts.push(`<div class="notice"><strong>Analytics unavailable.</strong>${esc(apiProblem(analytics))}</div>`);

    const cur = a?.totals.current, prev = a?.totals.previous;
    const pending = o?.pending;
    parts.push(`<dl class="stats">
        ${statBox('Page views', a ? fmt(cur.views) : '–', a ? esc(deltaText(cur.views, prev.views, 'previous 7 days')) : 'unavailable')}
        ${statBox('Visits', a ? fmt(cur.visits) : '–', a && cur.visits !== null ? esc(deltaText(cur.visits, prev.visits, 'previous 7 days')) : 'unavailable')}
        ${statBox('Projects', o ? fmt(o.projects.total) : fmt(window.myProjects?.length), o ? `${fmt(o.projects.withWriteup)} with write-ups` : '&nbsp;')}
        ${statBox('Unreleased', pending ? fmt(pending.ahead) : '–', pending ? (pending.ahead ? 'commits on develop not in main' : 'develop matches main') : 'branch status unavailable')}
    </dl>`);

    const commits = o?.commits;
    const commitList = commits
        ? `<ul class="rows">${commits.map(c => `<li><span class="label"><a class="commit-msg" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.message)}</a><span class="sub">${esc(c.sha)} · ${esc(c.author)}</span></span><span class="value">${esc(relativeTime(c.date))}</span></li>`).join('')}</ul>`
        : `<ul class="rows"><li class="empty">${esc(o?.commitsError ? `GitHub: ${o.commitsError}` : 'GitHub access is not configured for this environment.')}</li></ul>`;

    const hc = health.ok ? health.body.counts : null;
    const top = health.ok ? health.body.findings.filter(f => f.severity !== 'info').slice(0, 5) : [];
    parts.push(`<section class="panel"><header><h2>Content health</h2><a href="#/health" class="meta">Full audit</a></header>
        ${hc
            ? `<p class="panel-body health-line">${hc.error ? `<strong>${hc.error} error${hc.error === 1 ? '' : 's'}</strong>` : 'No errors'}, ${hc.warning} warning${hc.warning === 1 ? '' : 's'}, ${hc.info} note${hc.info === 1 ? '' : 's'} <span class="muted">(quick check; the full audit also reads write-ups and images)</span></p>
               ${top.length ? `<ul class="rows">${top.map(f => `<li><span class="label wrap"><span class="sev sev-${f.severity}">${f.severity === 'error' ? 'Error' : 'Warning'}</span> <strong>${esc(f.id)}</strong>: ${esc(f.message)}</span></li>`).join('')}</ul>` : ''}`
            : `<p class="panel-body muted">${esc(apiProblem(health))}</p>`}
    </section>`);

    parts.push(`<div class="cols">
        <section class="panel"><header><h2>Top pages</h2><a href="#/analytics" class="meta">All analytics</a></header>${a ? barRows(a.paths.slice(0, 6), i => pageLabel(i.label)) : '<ul class="rows"><li class="empty">No analytics data.</li></ul>'}</section>
        <section class="panel"><header><h2>Recent commits</h2><span class="meta">${esc(o?.branch || branch)}</span></header>${commitList}</section>
    </div>
    <section class="panel"><header><h2>Quick actions</h2></header>
        <div class="quick">
            <a class="btn" href="#/projects" data-action="new-project">New project</a>
            <a class="btn btn-secondary" href="#/projects" data-action="upload-image">Upload image</a>
            <a class="btn btn-secondary" href="/" target="_blank" rel="noopener">View site</a>
        </div>
    </section>`);

    body.innerHTML = parts.join('');

    body.querySelector('.quick').addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        // The projects view mounts on hashchange; give it a tick, then open the right panel.
        setTimeout(() => {
            if (action === 'new-project' && typeof window.toggleNewProjectForm === 'function') {
                const form = document.getElementById('new-project-form');
                if (form && form.classList.contains('hidden')) window.toggleNewProjectForm();
                document.getElementById('new-project-title')?.focus();
            }
            if (action === 'upload-image') {
                const bodyEl = document.getElementById('uploader-body');
                if (bodyEl && bodyEl.classList.contains('hidden') && typeof window.toggleUploader === 'function') window.toggleUploader();
                document.getElementById('uploader-card')?.scrollIntoView({ block: 'start' });
            }
        }, 50);
    });
}
