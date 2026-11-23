import { api, apiProblem, esc, relativeTime } from './util.js';
import { go, href, onPop, parse } from './router.js';

const MERGE = /^Merge (pull request|branch|remote-tracking)/i;
const ADMIN = /^admin( test cleanup)?:/i;
const BRANCHES = ['main', 'develop'];

const dayLabel = iso => {
    const d = new Date(iso);
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: days > 300 ? 'numeric' : undefined });
};
const clock = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Overall state of a commit's checks: 'failed' | 'pending' | 'ok' | null (no data). */
export function checksState(checks) {
    if (!checks || !checks.length) return null;
    if (checks.some(c => c.state === 'failed')) return 'failed';
    if (checks.some(c => c.state === 'pending')) return 'pending';
    return 'ok';
}
const names = (checks, state) => [...new Set(checks.filter(c => c.state === state).map(c => c.name))];

/** Only trouble is flagged on a commit row; a passing commit stays quiet. */
export function flag(checks) {
    const st = checksState(checks);
    if (st === 'failed') return `<span class="sev sev-error">${esc(names(checks, 'failed').join(', '))} failed</span>`;
    if (st === 'pending') return `<span class="sev sev-warning">${esc(names(checks, 'pending').join(', '))} running</span>`;
    return '';
}

/** Verdict for one named check on the latest commit, for the summary strip. */
function summaryCell(label, checks, name) {
    const mine = (checks || []).filter(c => c.name === name);
    if (!mine.length) return `<div class="stat"><span class="k">${label}</span><span class="v">–</span><span class="delta">no checks ran on this commit</span></div>`;
    const st = checksState(mine);
    const [word, cls] = st === 'failed' ? ['Failed', 'down'] : st === 'pending' ? ['Running', 'r-ok'] : ['Passed', 'up'];
    return `<div class="stat"><span class="k">${label}</span><span class="v">${word}</span><span class="delta ${cls}">on the latest commit</span></div>`;
}

export async function render(root, route = parse()) {
    // Branch and filter live in the URL (?branch=develop&show=admin).
    const branchFrom = r => (BRANCHES.includes(r.query.get('branch')) ? r.query.get('branch') : 'main');
    const filterFrom = r => (['admin', 'nomerge'].includes(r.query.get('show')) ? r.query.get('show') : 'all');
    let branch = branchFrom(route);
    let filter = filterFrom(route); // all | admin | nomerge
    let data = null;
    const record = () => go(href('activity', [], { branch: branch === 'main' ? '' : branch, show: filter === 'all' ? '' : filter }), { quiet: true });

    root.innerHTML = `
        <div class="view-head">
            <div><h1>Activity</h1><p>What changed on the site, and whether it built. Edits made in this admin start with "admin:".</p></div>
            <div class="head-actions">
                <div class="seg" id="branch-seg" role="group" aria-label="Branch">${BRANCHES.map(b => `<button type="button" data-branch="${b}" aria-pressed="${b === branch}">${b}</button>`).join('')}</div>
                <div class="seg" id="filter-seg" role="group" aria-label="Show">
                    <button type="button" data-filter="all" aria-pressed="${filter === 'all'}">All</button>
                    <button type="button" data-filter="nomerge" aria-pressed="${filter === 'nomerge'}">Skip merges</button>
                    <button type="button" data-filter="admin" aria-pressed="${filter === 'admin'}">Admin edits</button>
                </div>
            </div>
        </div>
        <div id="activity-body"><div class="loading">Loading…</div></div>`;
    const body = root.querySelector('#activity-body');

    const paint = () => {
        const d = data;
        if (!d.commits) {
            body.innerHTML = `<div class="notice"><strong>Couldn't load commits.</strong>${esc(d.commitsError ? `GitHub: ${d.commitsError}` : 'GitHub access is not configured for this environment.')}</div>`;
            return;
        }
        const latest = d.commits[0];
        const latestChecks = latest?.checks || null;
        const trouble = latest && checksState(latestChecks) === 'failed';

        const strip = `<div class="stats" role="group" aria-label="Status">
            <div class="stat"><span class="k">Latest on ${esc(d.branch)}</span><span class="v">${latest ? esc(relativeTime(latest.date)) : '–'}</span><span class="delta clip">${latest ? esc(latest.message) : ''}</span></div>
            ${summaryCell('Tests', latestChecks, 'Tests')}
            ${summaryCell('Build', latestChecks, 'Build')}
            <div class="stat"><span class="k">Waiting to ship</span><span class="v">${d.pending ? d.pending.ahead : '–'}</span><span class="delta">${d.pending ? (d.pending.ahead ? `commit${d.pending.ahead === 1 ? '' : 's'} on develop, not in main` : 'develop matches main') : (d.branch === 'main' ? 'unknown' : 'main only')}</span></div>
        </div>`;
        const alert = trouble ? `<div class="modebar"><span class="sev sev-error">Needs attention</span><span class="muted">${esc(names(latestChecks, 'failed').join(', '))} failed on <a href="${esc(latest.url)}" target="_blank" rel="noopener">${esc(latest.sha)}</a>: ${esc(latest.message)}</span></div>` : '';
        const note = !d.checksAvailable ? '<p class="muted small">Test and build status needs the GitHub token to have Checks (read) and Actions (read) access.</p>' : '';

        const shown = d.commits.filter(c => filter === 'admin' ? ADMIN.test(c.message) : filter === 'nomerge' ? !MERGE.test(c.message) : true);
        let rows = '';
        let lastDay = '';
        for (const c of shown) {
            const day = dayLabel(c.date);
            if (day !== lastDay) { rows += `<li class="day">${esc(day)}</li>`; lastDay = day; }
            const flagged = flag(c.checks);
            rows += `<li><span class="label wrap"><a class="commit-msg" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.message)}</a><span class="sub">${esc(c.sha)} · ${esc(c.author)}${flagged ? ` · ${flagged}` : ''}</span></span><span class="value muted">${esc(clock(c.date))}</span></li>`;
        }
        const deploys = d.deploys
            ? `<section class="panel"><header><h2>Deploys</h2></header><ul class="rows">${d.deploys.map(x => `<li><span class="label">${esc(x.message || x.source || 'Deployment')}<span class="sub">${esc(x.id)}</span></span><span class="value">${esc(relativeTime(x.created))}</span></li>`).join('')}</ul></section>`
            : (d.deploysError ? `<p class="muted small">Deployments: ${esc(d.deploysError)}</p>` : '');

        body.innerHTML = `${strip}${alert}
            <section class="panel"><header><h2>Commits on ${esc(d.branch)}</h2><span class="meta">${shown.length} shown · failing or running checks are flagged</span></header>
                <ul class="rows timeline">${rows || '<li class="empty muted">Nothing matches.</li>'}</ul></section>
            ${deploys}${note}`;
    };

    const load = async () => {
        body.innerHTML = '<div class="loading">Loading…</div>';
        const res = await api(`/api/admin/activity?branch=${encodeURIComponent(branch)}`);
        if (!res.ok) { body.innerHTML = `<div class="notice"><strong>Couldn't load activity.</strong>${esc(apiProblem(res))}</div>`; return; }
        data = res.body;
        paint();
    };

    root.querySelector('#branch-seg').addEventListener('click', e => {
        const b = e.target.closest('[data-branch]');
        if (!b || b.dataset.branch === branch) return;
        branch = b.dataset.branch;
        root.querySelectorAll('#branch-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        record();
        load();
    });
    root.querySelector('#filter-seg').addEventListener('click', e => {
        const b = e.target.closest('[data-filter]');
        if (!b || !data) return;
        filter = b.dataset.filter;
        root.querySelectorAll('#filter-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        record();
        paint();
    });
    onPop(r => {
        const nextBranch = branchFrom(r);
        filter = filterFrom(r);
        root.querySelectorAll('#filter-seg button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.filter === filter)));
        root.querySelectorAll('#branch-seg button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.branch === nextBranch)));
        if (nextBranch !== branch) { branch = nextBranch; load(); } else if (data) paint();
    });
    await load();
}
