import { apiProblem, esc, fmt, hasCached, relativeTime, swr } from './util.js';
import { deltaHtml, sparkSvg } from './analytics.js';
import { go, href, onPop, parse } from './router.js';

const RANGES = [7, 28, 90];
const titleFor = id => (globalThis.myProjects || []).find(p => p.id === id)?.title;

const authHeaders = () => (typeof window !== 'undefined' && window.getAuthHeaders?.()) || {};
const pct = v => `${(v * 100).toFixed(1)}%`;
const pos = v => v.toFixed(1);

/** A page URL from Search Console, shown as the project's title when it is one of ours. */
export function pageCell(url) {
    let path = url;
    try { path = new URL(url).pathname; } catch { /* already a path */ }
    const m = path.match(/^\/project\/([^/]+)\/?$/i);
    const title = m && titleFor(m[1].toLowerCase());
    return `<a href="${esc(path)}" target="_blank" rel="noopener">${esc(title || path)}</a>${title ? `<span class="sub">${esc(path)}</span>` : ''}`;
}

/** What to try for a query that shows up but doesn't get clicked. */
export function hint(r) {
    if (r.position <= 10) return 'On page 1 but rarely clicked: sharpen the title and description.';
    return 'Just off page 1: strengthen the write-up around this phrase.';
}

/** Published projects that have a page of their own, with that page's search numbers from Search Console. */
export function projectRows(projects, pages) {
    const by = new Map(pages.map(p => [p.page.replace(/\/$/, ''), p]));
    return projects.filter(p => !p.unpublished && p.hasExtendedContent).map(p => {
        const m = by.get(`/project/${p.id}`);
        return { id: p.id, title: p.title, clicks: m?.clicks || 0, impressions: m?.impressions || 0, ctr: m?.ctr || 0, position: m?.position || 0 };
    }).sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || a.title.localeCompare(b.title));
}

const STATE = { indexed: ['Indexed', 'sev-info'], 'not-indexed': ['Not indexed', 'sev-warning'], unknown: ['Unknown', 'sev-info'] };
export function indexCell(r) {
    if (!r) return '<span class="muted">Not checked</span>';
    const [label, cls] = STATE[r.state] || STATE.unknown;
    return `<span class="sev ${cls}">${label}</span>${r.checked ? `<span class="sub">checked ${esc(relativeTime(new Date(r.checked).toISOString()))}</span>` : ''}`;
}

const table = (head, rows, empty) => `<div class="table-wrap"><table class="dt st">
    <thead><tr>${head.map((h, i) => `<th scope="col"${i ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows || `<tr><td colspan="${head.length}" class="empty-note">${empty}</td></tr>`}</tbody></table></div>`;

export function setupHtml() {
    return `<div class="notice"><strong>Search Console isn't connected yet.</strong>
        Create a Google Cloud service account, enable the Search Console API, add the service account's e-mail as a restricted user on your property in Search Console, then store its JSON key:
        <pre>npx wrangler secret put GSC_SERVICE_ACCOUNT\nnpx wrangler secret put GSC_SITE   # optional, default sc-domain:ryanmarch.me</pre></div>`;
}

export async function render(root, route = parse()) {
    const daysFrom = r => (RANGES.includes(Number(r.query.get('days'))) ? Number(r.query.get('days')) : 28);
    const projectFrom = r => r.query.get('project') || '';
    let days = daysFrom(route);
    let project = projectFrom(route);
    let data = null;
    let index = {};
    const record = () => go(href('search', [], { days: days === 28 ? '' : days, project }), { quiet: true });

    root.innerHTML = `
        <div class="view-head">
            <div><h1>Search</h1><p>How people find the site on Google. Search Console data runs about two days behind.</p></div>
            <div class="head-actions"><div class="seg" id="range-seg" role="group" aria-label="Range">${RANGES.map(d => `<button type="button" data-days="${d}" aria-pressed="${d === days}">${d} days</button>`).join('')}</div></div>
        </div>
        <div id="search-body" aria-live="polite"><div class="loading">Loading…</div></div>`;
    const body = root.querySelector('#search-body');
    const stat = (k, v, sub, spark = '') => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span>${sub}${spark}</div>`;
    const myProjects = () => globalThis.myProjects || [];

    /** Asks Google about one project's page, one at a time, and keeps the answer. */
    const inspect = async id => {
        const res = await fetch(`/api/admin/search/index?project=${encodeURIComponent(id)}`, { headers: authHeaders() });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.message || `Request failed (${res.status})`);
        index[id] = out.result;
        return out.result;
    };

    const paintProject = () => {
        const p = myProjects().find(x => x.id === project);
        const m = data.pages.find(x => x.page.replace(/\/$/, '') === `/project/${project}`);
        const phrases = data.pairs.filter(x => x.page.replace(/\/$/, '') === `/project/${project}`).sort((a, b) => b.impressions - a.impressions);
        const r = index[project];
        const detail = r ? `<dl class="kv">
            <dt>Status</dt><dd>${indexCell(r)} ${esc(r.coverage)}</dd>
            <dt>Last crawled</dt><dd>${r.lastCrawl ? esc(relativeTime(r.lastCrawl)) : 'Never'}${r.crawledAs ? ` · by ${esc(r.crawledAs.toLowerCase())} crawler` : ''}</dd>
            <dt>Canonical</dt><dd>${r.googleCanonical ? esc(r.googleCanonical) : 'Not chosen yet'}${r.canonicalMismatch ? ` <span class="sev sev-warning">differs from yours: ${esc(r.userCanonical)}</span>` : ''}</dd>
            ${r.robots && r.robots !== 'ALLOWED' ? `<dt>robots.txt</dt><dd>${esc(r.robots)}</dd>` : ''}
            ${r.pageFetch && r.pageFetch !== 'SUCCESSFUL' ? `<dt>Last fetch</dt><dd>${esc(r.pageFetch)}</dd>` : ''}
        </dl>` : '<p class="empty-note">Not checked yet.</p>';
        body.innerHTML = `<p><a href="${esc(href('search', [], { days: days === 28 ? '' : days }))}" data-back>← All projects</a></p>
            <h2 class="proj-title">${esc(p?.title || project)}</h2>
            <p class="muted small"><a href="/project/${esc(project)}/" target="_blank" rel="noopener">/project/${esc(project)}/</a> · <a href="${esc(href('projects', [], { file: `content/${project}/index.html` }))}" data-edit>Edit write-up</a></p>
            <div class="stats">
                ${stat('Clicks', fmt(m?.clicks || 0), '<span class="delta">&nbsp;</span>')}
                ${stat('Impressions', fmt(m?.impressions || 0), '<span class="delta">&nbsp;</span>')}
                ${stat('Click-through rate', pct(m?.ctr || 0), '<span class="delta">&nbsp;</span>')}
                ${stat('Average position', m?.impressions ? pos(m.position) : '–', '<span class="delta">lower is better</span>')}
            </div>
            <section class="panel"><header><h2>In Google's index</h2><button type="button" class="linklike" id="inspect-one">${r ? 'Check again' : 'Check now'}</button></header><div class="panel-body" id="inspect-detail">${detail}</div></section>
            <h2 class="sec-title">Phrases that found this page</h2>
            ${table(['Search phrase', 'Clicks', 'Impressions', 'Position'], phrases.slice(0, 50).map(x => `<tr><td data-label="Phrase">${esc(x.query)}</td><td data-label="Clicks" class="num">${fmt(x.clicks)}</td><td data-label="Impressions" class="num">${fmt(x.impressions)}</td><td data-label="Position" class="num">${pos(x.position)}</td></tr>`).join(''), 'No phrases reported for this page in this range. Google only lists phrases that enough people searched.')}`;
    };

    const paintOverview = () => {
        const d = data;
        const c = d.totals.current, p = d.totals.previous;
        const strip = `<div class="stats">
            ${stat('Clicks', fmt(c.clicks), deltaHtml(c.clicks, p.clicks, d.days), sparkSvg(d.daily, 'clicks'))}
            ${stat('Impressions', fmt(c.impressions), deltaHtml(c.impressions, p.impressions, d.days), sparkSvg(d.daily, 'impressions'))}
            ${stat('Click-through rate', pct(c.ctr), `<span class="delta">${p.ctr ? `was ${pct(p.ctr)}` : '&nbsp;'}</span>`)}
            ${stat('Average position', c.impressions ? pos(c.position) : '–', `<span class="delta">${p.impressions ? `was ${pos(p.position)}` : '&nbsp;'} · lower is better</span>`)}
        </div>`;

        const wins = table(['Search phrase', 'Page', 'Impressions', 'Clicks', 'Position'],
            d.nearMisses.map(r => `<tr>
                <td data-label="Phrase"><strong>${esc(r.query)}</strong><span class="sub">${esc(hint(r))}</span></td>
                <td data-label="Page">${pageCell(r.page)}</td>
                <td data-label="Impressions" class="num">${fmt(r.impressions)}</td>
                <td data-label="Clicks" class="num">${fmt(r.clicks)}</td>
                <td data-label="Position" class="num">${pos(r.position)}</td></tr>`).join(''),
            'Nothing stands out yet. Phrases show here once they get enough impressions.');

        const rows = projectRows(myProjects(), d.pages);
        const projects = table(['Project', 'Clicks', 'Impressions', 'Position', 'In Google'],
            rows.map(r => `<tr>
                <td data-label="Project"><a href="${esc(href('search', [], { days: days === 28 ? '' : days, project: r.id }))}" data-project="${esc(r.id)}"><strong>${esc(r.title)}</strong></a></td>
                <td data-label="Clicks" class="num">${fmt(r.clicks)}</td>
                <td data-label="Impressions" class="num">${fmt(r.impressions)}</td>
                <td data-label="Position" class="num">${r.impressions ? pos(r.position) : '–'}</td>
                <td data-label="In Google" class="num" data-idx="${esc(r.id)}">${indexCell(index[r.id])}</td></tr>`).join(''),
            'No projects with their own page.');

        const others = d.pages.filter(x => !/^\/project\/[^/]+\/?$/i.test(x.page)).slice(0, 15);
        const pages = table(['Other pages', 'Clicks', 'Impressions', 'CTR', 'Position'],
            others.map(r => `<tr><td data-label="Page">${pageCell(r.page)}</td><td data-label="Clicks" class="num">${fmt(r.clicks)}</td><td data-label="Impressions" class="num">${fmt(r.impressions)}</td><td data-label="CTR" class="num">${pct(r.ctr)}</td><td data-label="Position" class="num">${pos(r.position)}</td></tr>`).join(''),
            'No other pages in this range.');
        const queries = table(['Search phrase', 'Clicks', 'Impressions', 'CTR', 'Position'],
            d.queries.slice(0, 50).map(r => `<tr><td data-label="Phrase">${esc(r.query)}</td><td data-label="Clicks" class="num">${fmt(r.clicks)}</td><td data-label="Impressions" class="num">${fmt(r.impressions)}</td><td data-label="CTR" class="num">${pct(r.ctr)}</td><td data-label="Position" class="num">${pos(r.position)}</td></tr>`).join(''),
            'No search phrases in this range.');

        body.innerHTML = `${strip}
            <h2 class="sec-title">Easy wins</h2><p class="muted small">Phrases that already show on the first two pages of Google but get few clicks.</p>${wins}
            <div class="sec-row"><h2 class="sec-title">Projects</h2><span class="muted small" id="inspect-progress"></span><button type="button" class="btn btn-secondary" id="inspect-all">Check indexing</button></div>${projects}
            <h2 class="sec-title">Search phrases</h2>${queries}
            <h2 class="sec-title">Everything else</h2>${pages}
            <p class="muted small">${esc(d.range.start)} to ${esc(d.range.end)} · property ${esc(d.site)}</p>`;
    };

    const paint = () => (project ? paintProject() : paintOverview());

    let controller;
    const load = async () => {
        controller?.abort();
        controller = new AbortController();
        const path = `/api/admin/search?days=${days}`;
        if (!hasCached(path)) body.innerHTML = '<div class="loading">Loading…</div>';
        await swr([path, '/api/admin/search/index'], ([res, saved]) => {
            if (res.status === 501) { body.innerHTML = setupHtml(); return; }
            if (!res.ok) { body.innerHTML = `<div class="notice"><strong>Couldn't load Search Console.</strong>${esc(res.body?.error || apiProblem(res))}</div>`; return; }
            data = res.body;
            index = { ...(saved.ok ? saved.body.results : {}), ...index };
            paint();
        }, { signal: controller.signal });
    };

    body.addEventListener('click', async e => {
        const nav = e.target.closest('[data-project], [data-back]');
        if (nav) { e.preventDefault(); project = nav.dataset.project || ''; record(); paint(); window.scrollTo?.(0, 0); return; }
        const edit = e.target.closest('[data-edit]');
        if (edit) { e.preventDefault(); go(edit.getAttribute('href')); return; }

        const one = e.target.closest('#inspect-one');
        if (one) {
            one.disabled = true; one.textContent = 'Checking…';
            try { await inspect(project); } catch (err) { window.adminToast?.(`Couldn't check: ${err.message}`, { kind: 'error' }); }
            paint();
            return;
        }
        const all = e.target.closest('#inspect-all');
        if (all) {
            const ids = projectRows(myProjects(), data.pages).map(r => r.id);
            const progress = body.querySelector('#inspect-progress');
            all.disabled = true;
            let done = 0;
            for (const id of ids) {
                progress.textContent = `Checking ${++done} of ${ids.length}…`;
                try {
                    await inspect(id);
                    const cell = body.querySelector(`[data-idx="${CSS.escape(id)}"]`);
                    if (cell) cell.innerHTML = indexCell(index[id]);
                } catch (err) {
                    progress.textContent = `Stopped: ${err.message}`;
                    all.disabled = false;
                    return;
                }
            }
            progress.textContent = '';
            all.disabled = false;
            const missing = ids.filter(id => index[id]?.state === 'not-indexed').length;
            window.adminToast?.(missing ? `${missing} of ${ids.length} aren't in Google yet.` : 'Every project page is in Google.');
        }
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
        const nextDays = daysFrom(r);
        root.querySelectorAll('#range-seg button').forEach(x => x.setAttribute('aria-pressed', String(Number(x.dataset.days) === nextDays)));
        project = projectFrom(r);
        if (nextDays !== days) { days = nextDays; load(); } else if (data) paint();
    });
    await load();
}
