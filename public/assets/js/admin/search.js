import { apiProblem, esc, fmt, hasCached, swr } from './util.js';
import { deltaHtml, sparkSvg } from './analytics.js';
import { go, href, onPop, parse } from './router.js';

const RANGES = [7, 28, 90];
const titleFor = id => (globalThis.myProjects || []).find(p => p.id === id)?.title;

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
    let days = daysFrom(route);
    const record = () => go(href('search', [], { days: days === 28 ? '' : days }), { quiet: true });

    root.innerHTML = `
        <div class="view-head">
            <div><h1>Search</h1><p>How people find the site on Google. Search Console data runs about two days behind.</p></div>
            <div class="head-actions"><div class="seg" id="range-seg" role="group" aria-label="Range">${RANGES.map(d => `<button type="button" data-days="${d}" aria-pressed="${d === days}">${d} days</button>`).join('')}</div></div>
        </div>
        <div id="search-body" aria-live="polite"><div class="loading">Loading…</div></div>`;
    const body = root.querySelector('#search-body');

    const paint = d => {
        const c = d.totals.current, p = d.totals.previous;
        const series = d.daily;
        const stat = (k, v, sub, spark = '') => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span>${sub}${spark}</div>`;
        const strip = `<div class="stats">
            ${stat('Clicks', fmt(c.clicks), deltaHtml(c.clicks, p.clicks, d.days), sparkSvg(series, 'clicks'))}
            ${stat('Impressions', fmt(c.impressions), deltaHtml(c.impressions, p.impressions, d.days), sparkSvg(series, 'impressions'))}
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

        const queries = table(['Search phrase', 'Clicks', 'Impressions', 'CTR', 'Position'],
            d.queries.slice(0, 50).map(r => `<tr><td data-label="Phrase">${esc(r.query)}</td><td data-label="Clicks" class="num">${fmt(r.clicks)}</td><td data-label="Impressions" class="num">${fmt(r.impressions)}</td><td data-label="CTR" class="num">${pct(r.ctr)}</td><td data-label="Position" class="num">${pos(r.position)}</td></tr>`).join(''),
            'No search phrases in this range.');
        const pages = table(['Page', 'Clicks', 'Impressions', 'CTR', 'Position'],
            d.pages.slice(0, 50).map(r => `<tr><td data-label="Page">${pageCell(r.page)}</td><td data-label="Clicks" class="num">${fmt(r.clicks)}</td><td data-label="Impressions" class="num">${fmt(r.impressions)}</td><td data-label="CTR" class="num">${pct(r.ctr)}</td><td data-label="Position" class="num">${pos(r.position)}</td></tr>`).join(''),
            'No pages in this range.');

        body.innerHTML = `${strip}
            <h2 class="sec-title">Easy wins</h2><p class="muted small">Phrases that already show on the first two pages of Google but get few clicks.</p>${wins}
            <h2 class="sec-title">Pages</h2>${pages}
            <h2 class="sec-title">Search phrases</h2>${queries}
            <p class="muted small">${esc(d.range.start)} to ${esc(d.range.end)} · property ${esc(d.site)}</p>`;
    };

    let controller;
    const load = async () => {
        controller?.abort();
        controller = new AbortController();
        const path = `/api/admin/search?days=${days}`;
        if (!hasCached(path)) body.innerHTML = '<div class="loading">Loading…</div>';
        await swr([path], ([res]) => {
            if (res.status === 501) { body.innerHTML = setupHtml(); return; }
            if (!res.ok) { body.innerHTML = `<div class="notice"><strong>Couldn't load Search Console.</strong>${esc(res.body?.error || apiProblem(res))}</div>`; return; }
            paint(res.body);
        }, { signal: controller.signal });
    };

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
