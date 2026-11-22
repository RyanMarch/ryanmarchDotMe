import { api, apiProblem, esc, relativeTime } from './util.js';

const ICON = { success: ['ok', 'Passed'], failure: ['error', 'Failed'], cancelled: ['info', 'Cancelled'], skipped: ['info', 'Skipped'], neutral: ['info', 'Neutral'], timed_out: ['error', 'Timed out'] };
const state = x => (x.status && x.status !== 'completed' ? ['warning', 'Running'] : ICON[x.conclusion] || ['info', x.conclusion || 'Unknown']);
const chip = ([cls, t]) => `<span class="sev sev-${cls}">${esc(t)}</span>`;

export async function render(root) {
    const branch = (typeof window.getSelectedBranch === 'function' && window.getSelectedBranch()) || 'main';
    let adminOnly = false;
    root.innerHTML = `
        <div class="view-head">
            <div><h1>Activity</h1><p>Commits, builds and deploys for <strong>${esc(branch)}</strong>. Edits made in this admin are commits starting with "admin:".</p></div>
            <label class="check-line inline"><input type="checkbox" id="admin-only"> Admin edits only</label>
        </div>
        <div id="activity-body"><div class="loading">Loading…</div></div>`;
    const body = root.querySelector('#activity-body');

    const res = await api(`/api/admin/activity?branch=${encodeURIComponent(branch)}`);
    if (!res.ok) { body.innerHTML = `<div class="notice"><strong>Couldn't load activity.</strong>${esc(apiProblem(res))}</div>`; return; }
    const d = res.body;

    const list = (items, row, empty) => (items && items.length ? `<ul class="rows">${items.map(row).join('')}</ul>` : `<ul class="rows"><li class="empty muted">${esc(empty)}</li></ul>`);
    const paint = () => {
        const commits = (d.commits || []).filter(c => !adminOnly || /^admin:/i.test(c.message));
        body.innerHTML = `
            <div class="cols">
                <section class="panel"><header><h2>Builds &amp; checks</h2><span class="meta">latest commit</span></header>
                    ${d.checks ? list(d.checks, c => `<li><span class="label">${esc(c.name)}${c.app ? `<span class="sub">${esc(c.app)}</span>` : ''}</span><span class="value">${chip(state(c))}</span></li>`, 'No checks reported.') : `<ul class="rows"><li class="empty muted">${esc(d.checksError ? `GitHub: ${d.checksError}` : 'GitHub access is not configured for this environment.')}</li></ul>`}
                </section>
                <section class="panel"><header><h2>Deploys</h2></header>
                    ${d.deploys ? list(d.deploys, x => `<li><span class="label">${esc(x.message || x.source || 'Deployment')}<span class="sub">${esc(x.id)}</span></span><span class="value">${esc(relativeTime(x.created))}</span></li>`, 'No deployments found.') : `<ul class="rows"><li class="empty muted">${esc(d.deploysError || 'Cloudflare access is not configured for this environment.')}</li></ul>`}
                </section>
            </div>
            <section class="panel"><header><h2>CI runs</h2></header>
                ${d.runs ? list(d.runs, r => `<li><span class="label"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a><span class="sub">${esc(r.sha)}</span></span><span class="value">${chip(state(r))} ${esc(relativeTime(r.date))}</span></li>`, 'No runs yet.') : `<ul class="rows"><li class="empty muted">${esc(d.runsError ? `GitHub: ${d.runsError}` : 'GitHub access is not configured for this environment.')}</li></ul>`}
            </section>
            <section class="panel"><header><h2>Commits</h2><span class="meta">${commits.length} shown</span></header>
                ${d.commits ? list(commits, c => `<li><span class="label wrap"><a class="commit-msg" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.message)}</a><span class="sub">${esc(c.sha)} · ${esc(c.author)}</span></span><span class="value">${esc(relativeTime(c.date))}</span></li>`, adminOnly ? 'No admin edits in the last 30 commits.' : 'No commits.') : `<ul class="rows"><li class="empty muted">${esc(d.commitsError ? `GitHub: ${d.commitsError}` : 'GitHub access is not configured for this environment.')}</li></ul>`}
            </section>`;
    };
    root.querySelector('#admin-only').addEventListener('change', e => { adminOnly = e.target.checked; paint(); });
    paint();
}
