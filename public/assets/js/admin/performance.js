import { apiProblem, esc, fmt, hasCached, relativeTime, swr } from './util.js';
import { projectInsights } from './insights.js';
import { go, href, onPop, parse } from './router.js';

const RANGES = [7, 30, 90];

export async function render(root, route = parse()) {
    const daysFrom = r => (RANGES.includes(Number(r.query.get('days'))) ? Number(r.query.get('days')) : 30);
    let days = daysFrom(route);
    const record = () => go(href('performance', [], { days: days === 30 ? '' : days }), { quiet: true });

    root.innerHTML = `
        <div class="view-head">
            <div><h1>Performance</h1><p>Every project in one table: who reads it, who finds it on Google, and what to do next.</p></div>
            <div class="head-actions"><div class="seg" id="range-seg" role="group" aria-label="Range">${RANGES.map(d => `<button type="button" data-days="${d}" aria-pressed="${d === days}">${d} days</button>`).join('')}</div></div>
        </div>
        <div id="perf-body" aria-live="polite"><div class="loading">Loading…</div></div>`;
    const body = root.querySelector('#perf-body');

    const paint = ([analytics, search, fresh, events, saved]) => {
        if (!analytics.ok) { body.innerHTML = `<div class="notice"><strong>Analytics unavailable.</strong>${esc(apiProblem(analytics))}</div>`; return; }
        const a = analytics.body;
        const s = search.ok ? search.body : null;
        const rows = projectInsights({
            projects: globalThis.myProjects || [], paths: a.paths, pages: s?.pages || [], nearMisses: s?.nearMisses || [],
            edited: fresh.ok ? fresh.body.edited || {} : {}, events: events.ok ? events.body : {}, index: saved.ok ? saved.body.results || {} : {}
        });
        const haveSearch = Boolean(s), haveEvents = events.ok && events.body.available, haveEdits = fresh.ok && fresh.body.available;
        const head = ['Project', 'Views', haveSearch && 'Google clicks', haveSearch && 'Position', haveEvents && 'Plays', haveEvents && 'Clicks out', haveEdits && 'Last edited', 'Worth a look'].filter(Boolean);
        const cells = r => [
            `<td data-label="Project"><a href="${esc(href('search', [], { project: r.id }))}" data-go><strong>${esc(r.title)}</strong></a></td>`,
            `<td data-label="Views" class="num">${fmt(r.views)}</td>`,
            haveSearch && `<td data-label="Google clicks" class="num">${fmt(r.clicks)}</td>`,
            haveSearch && `<td data-label="Position" class="num">${r.impressions ? r.position.toFixed(1) : '–'}</td>`,
            haveEvents && `<td data-label="Plays" class="num">${fmt(r.plays)}</td>`,
            haveEvents && `<td data-label="Clicks out" class="num">${fmt(r.outs)}</td>`,
            haveEdits && `<td data-label="Last edited" class="num">${r.edited ? esc(relativeTime(r.edited)) : '–'}</td>`,
            `<td data-label="Worth a look" class="pf-notes">${r.notes.map(n => `<span class="note-${n.level}">${esc(n.text)}</span>`).join('') || '<span class="muted">Nothing stands out</span>'}</td>`
        ].filter(Boolean).join('');
        const lacking = [
            !haveSearch && 'Connect Search Console to see Google clicks and position.',
            !haveEvents && 'Plays and outbound clicks appear here once the site has recorded some (they start counting from the deploy).',
            !haveEdits && 'Last-edited dates need GitHub access.'
        ].filter(Boolean);
        body.innerHTML = `<div class="table-wrap"><table class="dt st pf">
            <thead><tr>${head.map((h, i) => `<th scope="col"${i && i < head.length - 1 && h !== 'Last edited' ? ' class="num"' : h === 'Last edited' ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr>${cells(r)}</tr>`).join('') || `<tr><td colspan="${head.length}" class="empty-note">No projects with their own page.</td></tr>`}</tbody></table></div>
            ${lacking.map(t => `<p class="muted small">${esc(t)}</p>`).join('')}
            <p class="muted small">Views come from Cloudflare (bots excluded) for the last ${a.days} days. Google figures cover the last ${s?.days || 28} days.</p>`;
    };

    let controller;
    const load = async () => {
        controller?.abort();
        controller = new AbortController();
        const paths = [`/api/admin/analytics?days=${days}&paths=all`, '/api/admin/search?days=28', '/api/admin/freshness', `/api/admin/events?days=${days}`, '/api/admin/search/index'];
        if (!hasCached(paths[0])) body.innerHTML = '<div class="loading">Loading…</div>';
        await swr(paths, paint, { signal: controller.signal });
    };
    body.addEventListener('click', e => {
        const a = e.target.closest('a[data-go]');
        if (a) { e.preventDefault(); go(a.getAttribute('href')); }
    });
    root.querySelector('#range-seg').addEventListener('click', e => {
        const b = e.target.closest('[data-days]');
        if (!b || Number(b.dataset.days) === days) return;
        days = Number(b.dataset.days);
        root.querySelectorAll('#range-seg button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        record();
        load();
    });
    onPop(r => {
        const next = daysFrom(r);
        root.querySelectorAll('#range-seg button').forEach(x => x.setAttribute('aria-pressed', String(Number(x.dataset.days) === next)));
        if (next !== days) { days = next; load(); }
    });
    await load();
}
