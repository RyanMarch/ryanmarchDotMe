import { apiProblem, countUp, dataTable, esc, fmt, relativeTime, setupNotice, swr } from './util.js';
import { digestHtml, milestoneHtml, nextUpHtml, todayHtml, todayItems } from './today.js';
import { highest, milestones, nextUp, readSeen, streak, writeSeen } from './progress-data.js';
import { digestLines } from './insights.js';
import { deltaHtml, fillDays, pageLabel, sparkSvg } from './analytics.js';

function statBox(label, value, sub, spark = '') {
    return `<div class="stat"><span class="k">${esc(label)}</span><span class="v">${value}</span>${sub}${spark}</div>`;
}

export async function render(root) {
    root.innerHTML = `
        <div class="view-head"><div><h1>Dashboard</h1><p>Last 7 days, plus what's happening in the repo.</p></div></div>
        <div id="dash-body" aria-live="polite"><div class="loading">Loading…</div></div>`;
    const body = root.querySelector('#dash-body');
    const branch = (typeof window.getSelectedBranch === 'function' && window.getSelectedBranch()) || 'main';

    const paths = [`/api/admin/overview?branch=${encodeURIComponent(branch)}`, '/api/admin/analytics?days=7', '/api/admin/health?scope=summary', '/api/admin/notfound', '/api/admin/search?days=28', '/api/admin/search/index', '/api/admin/freshness', '/api/admin/schedule', '/api/admin/events?days=7', '/api/admin/ideas', '/api/admin/journal'];

    let tasks = [];
    let nextIndex = 0;
    let pendingMilestones = [];
    body.addEventListener('click', e => {
        if (e.target.closest('[data-another]')) {
            nextIndex++;
            body.querySelector('#next-up').outerHTML = nextUpHtml(tasks, nextIndex);
        } else if (e.target.closest('[data-dismiss-milestones]')) {
            const seen = readSeen();
            pendingMilestones.forEach(m => seen.add(m.key));
            writeSeen(seen);
            body.querySelector('#milestone-card')?.remove();
        }
    });
    const paint = ([overview, analytics, health, notfound, search, saved, fresh, schedule, events, ideas, journal]) => {
        const parts = [];
        const a = analytics.ok ? analytics.body : null;
        const o = overview.ok ? overview.body : null;

        if (analytics.status === 501) parts.push(setupNotice());
        else if (!analytics.ok) parts.push(`<div class="notice"><strong>Analytics unavailable.</strong>${esc(apiProblem(analytics))}</div>`);

        const cur = a?.totals.current, prev = a?.totals.previous;
        const pending = o?.pending;
        const series = a ? fillDays(a.rows, a.days) : null;
        parts.push(`<div class="stats">
            ${statBox('Page views', a ? fmt(cur.views) : '–', a ? deltaHtml(cur.views, prev.views, 7) : '<span class="delta">unavailable</span>', series ? sparkSvg(series, 'views') : '')}
            ${statBox('Visits', a ? fmt(cur.visits) : '–', a ? deltaHtml(cur.visits, prev.visits, 7) : '<span class="delta">unavailable</span>', series && cur.visits !== null ? sparkSvg(series, 'visits') : '')}
            ${statBox('Projects', o ? fmt(o.projects.total) : fmt((window.myProjects || []).filter(p => !p.unpublished).length), `<span class="delta">${o ? `${fmt(o.projects.withWriteup)} with write-ups${o.projects.unpublished ? ` · ${fmt(o.projects.unpublished)} unpublished` : ''}` : '&nbsp;'}</span>`)}
            ${statBox('Unreleased', pending ? fmt(pending.ahead) : '–', `<span class="delta">${pending ? (pending.ahead ? 'commits on develop not in main' : 'develop matches main') : 'branch status unavailable'}</span>`)}
        </div>`);

        const commits = o?.commits;
        const commitList = commits
            ? `<ul class="rows">${commits.map(c => `<li><span class="label"><a class="commit-msg" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.message)}</a><span class="sub">${esc(c.sha)} · ${esc(c.author)}</span></span><span class="value">${esc(relativeTime(c.date))}</span></li>`).join('')}</ul>`
            : `<ul class="rows"><li class="empty">${esc(o?.commitsError ? `GitHub: ${o.commitsError}` : 'GitHub access is not configured for this environment.')}</li></ul>`;

        const projectsNow = window.myProjects || [];
        const bestPath = (a?.paths || []).find(p => /^\/project\//.test(p.label));
        const bestTitle = bestPath ? projectsNow.find(p => p.id === bestPath.label.split('/')[2]?.toLowerCase())?.title : '';
        const searchData = search?.ok ? search.body : null;
        const indexNow = saved?.ok ? saved.body.results : {};
        const streakNow = streak(journal?.ok ? journal.body.commits || [] : []);
        const topPage = (searchData?.pages || []).filter(p => /^\/project\//.test(p.page)).sort((x, y) => y.clicks - x.clicks)[0];
        const topId = topPage?.clicks ? topPage.page.split('/')[2] : null;
        const fresh_milestones = highest(milestones({
            search: searchData, projects: projectsNow.filter(p => !p.unpublished && p.hasExtendedContent), index: indexNow, streakWeeks: streakNow.current,
            topProject: topId ? { id: topId, title: projectsNow.find(p => p.id === topId)?.title || topId } : null
        })).filter(m => !readSeen().has(m.key));
        parts.push(milestoneHtml(fresh_milestones));
        tasks = nextUp({ projects: projectsNow, search: searchData, index: indexNow, edited: fresh?.ok ? fresh.body.edited : {}, ideas: ideas?.ok ? ideas.body.ideas : [] });
        parts.push(nextUpHtml(tasks, nextIndex));
        pendingMilestones = fresh_milestones;
        parts.push(todayHtml(todayItems({
            overview: overview.ok ? overview.body : null, health: health.ok ? health.body : null,
            notfound: notfound?.ok ? notfound.body : null, search: searchData, analytics: a,
            index: saved?.ok ? saved.body.results : null, edited: fresh?.ok ? fresh.body.edited : null,
            schedule: schedule?.ok ? schedule.body : null, projects: projectsNow
        }), { best: bestTitle }));
        parts.push(digestHtml(digestLines({
            analytics: a, search: search?.ok ? search.body : null, overview: o, notfound: notfound?.ok ? notfound.body : null,
            events: events?.ok ? events.body : null, projects: window.myProjects || []
        })));

        const hc = health.ok ? health.body.counts : null;
        const top = health.ok ? health.body.findings.filter(f => f.severity !== 'info').slice(0, 5) : [];
        parts.push( /*html*/`<div class="dash-grid"><section class="panel dash-health"><header><h2>Content Health</h2><a href="/admin/health" class="meta">Full audit</a></header>
            ${hc
                ? `<p class="panel-body health-line">${hc.error ? `<strong>${hc.error} error${hc.error === 1 ? '' : 's'}</strong>` : 'No errors'}, ${hc.warning} warning${hc.warning === 1 ? '' : 's'}, ${hc.info} note${hc.info === 1 ? '' : 's'} <span class="muted">(quick check; the full audit also reads write-ups and images)</span></p>
                   ${top.length ? `<ul class="rows">${top.map(f => `<li><span class="label wrap"><span class="sev sev-${f.severity}">${f.severity === 'error' ? 'Error' : 'Warning'}</span> <strong>${esc(f.id)}</strong>: ${esc(f.message)}</span></li>`).join('')}</ul>` : ''}`
                : `<p class="panel-body muted">${esc(apiProblem(health))}</p>`}
        </section>`);

        const nf = notfound?.ok && notfound.body.available ? notfound.body.items.slice(0, 5) : null;
    parts.push(/*html*/`<section class="panel"><header><h2>Broken links people hit</h2><a href="/admin/seo?tab=404" class="meta">${nf && nf.length ? 'Fix them' : 'All'}</a></header>
        ${nf === null ? '<p class="empty-note">Not recording yet.</p>' : nf.length ? `<ul class="rows">${nf.map(i => `<li><span class="label"><code>${esc(i.path)}</code></span><span class="value">${i.count}</span></li>`).join('')}</ul>` : '<p class="empty-note">Nobody has hit a missing page lately.</p>'}
    </section>`);

    parts.push(/*html*/`<section class="panel"><header><h2>Top pages</h2><a href="/admin/analytics" class="meta">All analytics</a></header>${a ? dataTable(a.paths.slice(0, 6), { head: 'Page', render: i => pageLabel(i.label), total: a.totals.current.views }) : '<p class="empty-note">No analytics data.</p>'}</section>
            <section class="panel"><header><h2>Recent commits</h2><span class="meta">${esc(o?.branch || branch)}</span></header>${commitList}</section>
        <section class="panel dash-quick"><header><h2>Quick actions</h2></header>
            <div class="quick">
                <a class="btn" href="/admin/projects" data-action="new-project">New project</a>
                <a class="btn btn-secondary" href="/admin/projects" data-action="upload-image">Upload image</a>
                <a class="btn btn-secondary" href="/" target="_blank" rel="noopener">View site</a>
            </div>
        </section></div>`);

        body.innerHTML = parts.join('');
        body.querySelector('.quick').addEventListener('click', e => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;
            // The link takes you to Projects; wait for the editor to load, then open the right panel.
            window.adminEnsureEditor?.().then(() => {
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
            });
        });
    };

    await swr(paths, (results, meta) => { paint(results); if (!meta.stale) countUp(body); });
}
