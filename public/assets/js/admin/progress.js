import { apiProblem, esc, fmt, send, swr } from './util.js';
import { completeness, highest, journalMonths, milestones, readSeen, streak, topicIdeas, writeSeen } from './progress-data.js';
import { go } from './router.js';

const table = (head, rows, empty) => `<div class="table-wrap"><table class="dt st">
    <thead><tr>${head.map((h, i) => `<th scope="col"${i && i < head.length ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows || `<tr><td colspan="${head.length}" class="empty-note">${empty}</td></tr>`}</tbody></table></div>`;

export async function render(root) {
    root.innerHTML = `
        <div class="view-head"><div><h1>Progress</h1><p>What you've been building, what's still missing, and what to try next.</p></div></div>
        <div id="progress-body" aria-live="polite"><div class="loading">Loading…</div></div>`;
    const body = root.querySelector('#progress-body');
    let ideas = [];

    const paint = ([journal, ideasRes, search, saved]) => {
        const commits = journal.ok ? journal.body.commits || [] : [];
        const s = search.ok ? search.body : null;
        const projects = globalThis.myProjects || [];
        const st = streak(commits);
        const comp = completeness(projects);
        ideas = ideasRes.ok ? ideasRes.body.ideas || [] : [];
        const open = ideas.filter(i => !i.done);

        const published = projects.filter(p => !p.unpublished && p.hasExtendedContent);
        const top = (() => { const best = (s?.pages || []).filter(p => /^\/project\//.test(p.page)).sort((a, b) => b.clicks - a.clicks)[0]; const id = best && best.clicks ? best.page.split('/')[2] : null; return id ? { id, title: projects.find(p => p.id === id)?.title || id } : null; })();
        const reached = highest(milestones({ search: s, projects: published, index: saved.ok ? saved.body.results : {}, streakWeeks: st.current, topProject: top }));
        const seen = readSeen();
        const stat = (k, v, sub) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span><span class="delta">${sub}</span></div>`;

        const missingRows = comp.rows.filter(r => r.missing.length).map(r => `<tr><td data-label="Project"><strong>${esc(r.title)}</strong></td><td data-label="Missing" class="pf-notes">${r.missing.map(m => `<span>${esc(m)}</span>`).join('')}</td></tr>`).join('');
        const topics = topicIdeas(s?.pairs || []).map(t => `<tr><td data-label="Search phrase"><strong>${esc(t.query)}</strong></td><td data-label="Impressions" class="num">${fmt(t.impressions)}</td><td data-label="Clicks" class="num">${fmt(t.clicks)}</td><td data-label="Landed on">${esc(t.page)}</td></tr>`).join('');
        const titleOf = id => projects.find(p => p.id === id)?.title || id;
        const day = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const months = journalMonths(commits, titleOf).map(m => `<li class="journal-month"><strong>${esc(m.label)}</strong><span class="value">${fmt(m.count)} change${m.count === 1 ? '' : 's'}</span></li>${m.entries.slice(0, 8).map(e => `<li><span class="label">${esc(e.text)}</span><span class="value">${esc(day(e.date))}</span></li>`).join('')}${m.entries.length > 8 ? `<li class="empty">and ${m.entries.length - 8} more</li>` : ''}`).join('');

        body.innerHTML = `
            <div class="stats">
                ${stat('Weekly streak', `${st.current}`, st.current ? (st.activeThisWeek ? 'weeks in a row, including this one' : "weeks in a row; one edit this week keeps it going") : 'one edit this week starts one')}
                ${stat('Completeness', `${comp.percent}%`, 'of the basics filled in across projects')}
                ${stat('Best streak', `${st.best}`, 'weeks, within the last 100 edits')}
                ${stat('Ideas waiting', `${open.length}`, open.length ? 'in your inbox' : 'nothing waiting')}
            </div>
            <h2 class="sec-title">Milestones</h2>
            ${reached.length ? `<ul class="rows milestones">${reached.sort((a, b) => b.rank - a.rank).map(m => `<li><span class="label wrap">${esc(m.title)}</span>${seen.has(m.key) ? '' : '<span class="value"><span class="sev sev-info">New</span></span>'}</li>`).join('')}</ul>` : '<p class="muted small">Nothing yet. They appear as your numbers grow.</p>'}
            <h2 class="sec-title">Ideas inbox</h2>
            <form class="idea-form" id="idea-form"><input name="text" maxlength="200" placeholder="Write an idea in a line…" aria-label="New idea" required><button class="btn" type="submit">Add</button></form>
            ${ideasRes.ok && ideasRes.body.available === false ? `<p class="muted small">${esc(ideasRes.body.message)}</p>` : ''}
            ${ideas.length ? `<ul class="rows ideas">${ideas.map(i => `<li class="${i.done ? 'is-done' : ''}"><label class="label wrap"><input type="checkbox" data-done="${esc(i.id)}" ${i.done ? 'checked' : ''}> <span>${esc(i.text)}</span></label><span class="value">${i.done ? '' : `<button type="button" class="linklike" data-start="${esc(i.text)}">Start a project</button> `}<button type="button" class="linklike danger" data-del="${esc(i.id)}">Remove</button></span></li>`).join('')}</ul>` : '<p class="empty-note">Empty. Anything you think of, drop it here.</p>'}
            <h2 class="sec-title">What's missing</h2><p class="muted small">Basics a published project should have. Works through them from the one missing most.</p>
            ${table(['Project', 'Missing'], missingRows, 'Every project has the basics.')}
            <h2 class="sec-title">People searched for these</h2><p class="muted small">Phrases that brought people to your homepage or another page, not a project. Each is a possible new write-up.</p>
            ${s ? table(['Search phrase', 'Impressions', 'Clicks', 'Landed on'], topics, 'No such phrases yet.') : '<p class="muted small">Connect Search Console to see these.</p>'}
            <h2 class="sec-title">Journal</h2><p class="muted small">Changes to your project pages and images, newest first.</p>
            ${months ? `<ul class="rows">${months}</ul>` : `<p class="muted small">${esc(journal.ok ? 'No content changes found yet.' : apiProblem(journal))}</p>`}`;

        // Looking at the page counts as having seen what's new.
        const next = readSeen();
        reached.forEach(m => next.add(m.key));
        writeSeen(next);
    };

    const reload = () => swr(['/api/admin/journal', '/api/admin/ideas', '/api/admin/search?days=28', '/api/admin/search/index'], paint);
    body.addEventListener('submit', async e => {
        e.preventDefault();
        const text = new FormData(e.target).get('text');
        const out = await send('/api/admin/ideas', 'POST', { text });
        if (!out.ok) { window.adminAlert?.(out.body?.message || 'Could not save that.', { title: 'Ideas' }); return; }
        reload();
    });
    body.addEventListener('click', async e => {
        const del = e.target.closest('[data-del]');
        if (del) { await send(`/api/admin/ideas?id=${encodeURIComponent(del.dataset.del)}`, 'DELETE'); reload(); return; }
        const start = e.target.closest('[data-start]');
        if (start) {
            go('/admin/projects');
            window.adminEnsureEditor?.().then(() => {
                const form = document.getElementById('new-project-form');
                if (form && form.classList.contains('hidden')) window.toggleNewProjectForm?.();
                const field = document.getElementById('new-project-title');
                if (field) { field.value = start.dataset.start; field.focus(); }
            });
        }
    });
    body.addEventListener('change', async e => {
        const box = e.target.closest('[data-done]');
        if (!box) return;
        await send('/api/admin/ideas', 'POST', { id: box.dataset.done, done: box.checked });
        reload();
    });
    await reload();
}
