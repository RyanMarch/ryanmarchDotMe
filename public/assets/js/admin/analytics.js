import { api, apiProblem, dataTable, esc, fmt, setupNotice } from './util.js';

const RANGES = [7, 30, 90];
// Project titles come from window.myProjects (set by projects-list.js and
// refreshed per branch), so this module needs no import of the immutable-cached data file.
const titleFor = id => (globalThis.myProjects || []).find(p => p.id === id)?.title;

// web.dev thresholds: [good, poor]
const THRESHOLDS = { lcp_ms: [2500, 4000], inp_ms: [200, 500], cls: [0.1, 0.25], fcp_ms: [1800, 3000] };
function rate(key, value) {
    if (value === null || value === undefined) return { text: 'no data', cls: '' };
    const [good, poor] = THRESHOLDS[key];
    if (value <= good) return { text: 'good', cls: 'r-good' };
    if (value <= poor) return { text: 'needs work', cls: 'r-ok' };
    return { text: 'poor', cls: 'r-poor' };
}
const ms = v => (v === null || v === undefined ? '–' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v} ms`);

/** Country code → readable name. Cloudflare uses T1 for the Tor network and XX when it can't tell. */
export function countryLabel(code) {
    if (code === 'T1') return 'Tor network';
    if (!code || code === 'XX' || code === 'Unknown') return 'Unknown';
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; } catch { return code; }
}

/** One plain sentence about what the numbers exclude, plus a heads-up when most traffic is Tor. */
export function trafficNote(d) {
    const parts = [];
    if (d.filters?.botsExcluded) parts.push(`Bots are excluded${d.botLoads ? ` (${fmt(d.botLoads)} flagged loads in this range)` : ''}, the same as Cloudflare's own dashboard.`);
    if (d.filters?.torHidden) parts.push('Tor traffic is hidden.');
    else if (d.torLoads && d.totals.current.views) {
        const pct = Math.round((d.torLoads / d.totals.current.views) * 100);
        if (pct >= 20) parts.push(`${fmt(d.torLoads)} of ${fmt(d.totals.current.views)} views (${pct}%) come from the Tor network, which is mostly automated traffic. Hide it to see the rest.`);
    }
    return parts.join(' ');
}

export function pageLabel(path) {
    const m = path.match(/^\/project\/([^/]+)\/?$/i);
    const title = m && titleFor(m[1].toLowerCase());
    return title
        ? `<a href="${esc(path)}" target="_blank" rel="noopener">${esc(title)}</a><span class="sub">${esc(path)}</span>`
        : `<a href="${esc(path)}" target="_blank" rel="noopener">${esc(path)}</a>`;
}

/** Fill missing days with zero so the x-axis is continuous. `offset` shifts the window back (previous period). */
export function fillDays(rows, days, offset = 0) {
    const byDate = new Map(rows.map(r => [r.date, r]));
    const out = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i - offset));
        const key = d.toISOString().slice(0, 10);
        out.push({ date: key, views: byDate.get(key)?.views || 0, visits: byDate.get(key)?.visits ?? 0 });
    }
    return out;
}

// Pick an axis max so the four grid steps land on round numbers.
const niceMax = n => {
    const raw = Math.max(n, 4) / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, mag >= 10 ? 2.5 : 2, 5, 10].map(m => m * mag).find(c => c >= raw) || 10 * mag;
    return step * 4;
};

const dayLabel = (date, opts) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
export const CHART = { H: 240, L: 42, R: 8, T: 10, B: 26 };

/** Line chart of one metric, with an optional dashed previous-period line and one hit column per day. */
export function chartSvg(series, W = 720, { prev = null, metric = 'views' } = {}) {
    const { H, L, R, T, B } = CHART;
    const val = s => s[metric] || 0;
    const max = niceMax(Math.max(...series.map(val), ...(prev || []).map(val), 1));
    const step = (W - L - R) / series.length;
    const x = i => L + (i + 0.5) * step;
    const y = v => T + (H - T - B) * (1 - v / max);
    const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
        const v = Math.round(max * f);
        return `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
    }).join('');
    const pts = arr => arr.map((s, i) => `${x(i).toFixed(1)},${y(val(s)).toFixed(1)}`);
    const line = pts(series);
    const area = `M${x(0).toFixed(1)},${y(0).toFixed(1)} L${line.join(' L')} L${x(series.length - 1).toFixed(1)},${y(0).toFixed(1)} Z`;
    const prevLine = prev ? `<polyline class="line-prev" points="${pts(prev).join(' ')}"/>` : '';
    const every = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor((W - L) / 84))));
    const xl = series.map((s, i) => (i % every === 0 || i === series.length - 1) && (series.length - 1 - i >= every / 2 || i === series.length - 1)
        ? `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}">${dayLabel(s.date, { month: 'short', day: 'numeric' })}</text>` : '').join('');
    const hits = series.map((s, i) => `<rect class="hit" data-i="${i}" x="${(L + i * step).toFixed(1)}" y="${T}" width="${step.toFixed(1)}" height="${H - T - B}"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${grid}<path class="area" d="${area}"/>${prevLine}<polyline class="line" points="${line.join(' ')}"/><line class="cursor" y1="${T}" y2="${H - B}" x1="-10" x2="-10"/><circle class="dot" r="4" cx="-10" cy="-10"/>${xl}${hits}</svg>`;
}

export function sparkSvg(series, metric) {
    const W = 100, H = 30, max = Math.max(...series.map(s => s[metric] || 0), 1);
    const pts = series.map((s, i) => `${((i / Math.max(1, series.length - 1)) * W).toFixed(1)},${(H - 2 - (H - 4) * ((s[metric] || 0) / max)).toFixed(1)}`);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.join(' ')}"/></svg>`;
}

function attachChart(root, state) {
    const box = root.querySelector('.chart-plot');
    const tip = root.querySelector('.tip');
    let cur = -1;
    const draw = () => {
        const w = Math.max(300, Math.floor(box.clientWidth));
        box.querySelector('.svg-host').innerHTML = chartSvg(state.series, w, { prev: state.prev, metric: state.metric });
        tip.hidden = true;
        cur = -1;
    };
    state.redraw = draw;
    draw();
    let lastW = box.clientWidth;
    new ResizeObserver(() => { if (box.clientWidth !== lastW) { lastW = box.clientWidth; draw(); } }).observe(box);

    const noun = () => (state.metric === 'visits' ? 'visit' : 'page view');
    const show = i => {
        if (i < 0 || i >= state.series.length) return;
        cur = i;
        const svg = box.querySelector('svg');
        const s = state.series[i];
        const p = state.prev?.[i];
        const hit = svg.querySelector(`.hit[data-i="${i}"]`);
        const cx = Number(hit.getAttribute('x')) + Number(hit.getAttribute('width')) / 2;
        const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
        const v = s[state.metric] || 0;
        const { H, T, B } = CHART;
        const max = niceMax(Math.max(...state.series.map(r => r[state.metric] || 0), ...(state.prev || []).map(r => r[state.metric] || 0), 1));
        const cy = T + (H - T - B) * (1 - v / max);
        svg.querySelector('.cursor').setAttribute('x1', cx);
        svg.querySelector('.cursor').setAttribute('x2', cx);
        svg.querySelector('.dot').setAttribute('cx', cx);
        svg.querySelector('.dot').setAttribute('cy', cy);
        tip.hidden = false;
        tip.innerHTML = `<div class="tip-date">${esc(dayLabel(s.date, { weekday: 'short', month: 'short', day: 'numeric' }))}</div>
            <div class="tip-row"><span class="sw sw-cur"></span>${fmt(v)} ${noun()}${v === 1 ? '' : 's'}</div>
            ${p ? `<div class="tip-row muted"><span class="sw sw-prev"></span>${fmt(p[state.metric] || 0)} on ${esc(dayLabel(p.date, { month: 'short', day: 'numeric' }))}</div>` : ''}`;
        const tw = tip.offsetWidth;
        const left = cx * scale;
        tip.style.left = `${Math.min(Math.max(left - tw / 2, 4), box.clientWidth - tw - 4)}px`;
        tip.style.top = '6px';
        root.querySelector('.chart-readout').textContent = `${dayLabel(s.date, { weekday: 'short', month: 'short', day: 'numeric' })}: ${fmt(v)} ${noun()}${v === 1 ? '' : 's'}`;
    };
    const fromPointer = e => {
        const svg = box.querySelector('svg');
        const r = svg.getBoundingClientRect();
        const scale = r.width / svg.viewBox.baseVal.width;
        const L = CHART.L * scale, R = CHART.R * scale;
        const slot = (r.width - L - R) / state.series.length;
        show(Math.min(state.series.length - 1, Math.max(0, Math.floor((e.clientX - r.left - L) / slot))));
    };
    box.addEventListener('pointermove', fromPointer);
    box.addEventListener('pointerdown', fromPointer);
    box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { tip.hidden = true; box.querySelector('.cursor')?.setAttribute('x1', -10); box.querySelector('.cursor')?.setAttribute('x2', -10); box.querySelector('.dot')?.setAttribute('cx', -10); } });
    box.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { show(cur < 0 ? state.series.length - 1 : cur - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { show(cur < 0 ? 0 : cur + 1); e.preventDefault(); }
    });
}

export function deltaHtml(c, p, days) {
    if (c === null || p === null || p === undefined) return '<span class="delta">not reported</span>';
    if (!p) return `<span class="delta">${c ? 'new' : 'no data'}</span>`;
    const pct = Math.round(((c - p) / p) * 100);
    const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
    const mark = pct > 0 ? '▲' : pct < 0 ? '▼' : '–';
    return `<span class="delta ${dir}"><span aria-hidden="true">${mark}</span> ${Math.abs(pct)}%<span class="vs"> vs previous ${days} days</span></span>`;
}

function statsHtml(d, series, metric) {
    const cur = d.totals.current, prev = d.totals.previous;
    const ppv = cur.visits ? (cur.views / cur.visits).toFixed(2) : '–';
    const delta = (c, p) => deltaHtml(c, p, d.days);
    const pick = (m, label, c, p) => `<button type="button" class="stat stat-pick" data-metric="${m}" aria-pressed="${metric === m}" ${c === null ? 'disabled' : ''}>
        <span class="k">${label}</span><span class="v">${fmt(c)}</span>${delta(c, p)}${c === null ? '' : sparkSvg(series, m)}</button>`;
    return `<div class="stats" role="group" aria-label="Summary">
        ${pick('views', 'Page views', cur.views, prev.views)}
        ${pick('visits', 'Visits', cur.visits, prev.visits)}
        <div class="stat"><span class="k">Pages per visit</span><span class="v">${ppv}</span><span class="delta">&nbsp;</span></div>
        <div class="stat"><span class="k">Largest contentful paint</span><span class="v">${ms(d.vitals.lcp_ms)}</span><span class="delta ${rate('lcp_ms', d.vitals.lcp_ms).cls}">${esc(rate('lcp_ms', d.vitals.lcp_ms).text)}</span></div>
    </div>`;
}

function vitalsHtml(v) {
    const items = [
        ['LCP', 'Largest contentful paint', 'lcp_ms', v.lcp_ms, ms(v.lcp_ms)],
        ['INP', 'Interaction to next paint', 'inp_ms', v.inp_ms, ms(v.inp_ms)],
        ['CLS', 'Cumulative layout shift', 'cls', v.cls, v.cls ?? '–'],
        ['FCP', 'First contentful paint', 'fcp_ms', v.fcp_ms, ms(v.fcp_ms)]
    ];
    return `<div class="vitals">${items.map(([short, long, key, val, text]) => {
        const r = rate(key, val);
        const [good, poor] = THRESHOLDS[key];
        const top = poor * 1.5;
        const pos = val === null || val === undefined ? null : Math.min(100, (val / top) * 100);
        return `<div class="vital">
            <div class="k"><abbr title="${long}">${short}</abbr></div>
            <div class="v">${text}</div>
            <div class="gauge" role="img" aria-label="${long}: ${r.text}">
                <span class="seg-good" style="width:${(good / top) * 100}%"></span><span class="seg-ok" style="width:${((poor - good) / top) * 100}%"></span><span class="seg-poor"></span>
                ${pos === null ? '' : `<span class="mark" style="left:${pos}%"></span>`}
            </div>
            <div class="r ${r.cls}">${r.text}</div>
        </div>`;
    }).join('')}</div>`;
}

function sourcesHtml(d) {
    const tabs = [['referrers', 'Referrers', 'Source'], ['countries', 'Countries', 'Country'], ['devices', 'Devices', 'Device']];
    return `<section class="panel">
        <header><div class="tabs-inline" role="tablist" aria-label="Traffic breakdown">${tabs.map(([k, label], i) =>
            `<button type="button" role="tab" id="src-tab-${k}" data-src="${k}" aria-selected="${i === 0}" aria-controls="src-panel" tabindex="${i === 0 ? 0 : -1}">${label}</button>`).join('')}</div></header>
        <div id="src-panel" role="tabpanel" aria-labelledby="src-tab-referrers">${dataTable(d.referrers, { head: tabs[0][2], total: d.totals.current.views })}</div>
    </section>`;
}

export async function render(root) {
    let days = Number(sessionStorage.getItem('admin_range')) || 30;
    if (!RANGES.includes(days)) days = 30;
    let controller;
    let hideTor = false;
    try { hideTor = sessionStorage.getItem('admin_hide_tor') === '1'; } catch { /* private mode */ }

    root.innerHTML = `
        <div class="view-head">
            <div><h1>Analytics</h1><p>Cloudflare Web Analytics for ryanmarch.me. Privacy-friendly: no cookies, no personal data.</p></div>
            <div class="head-actions">
                <label class="check-line inline"><input type="checkbox" id="hide-tor" ${hideTor ? 'checked' : ''}> Hide Tor traffic</label>
                <div class="seg" role="group" aria-label="Date range">
                    ${RANGES.map(r => `<button type="button" data-days="${r}" aria-pressed="${r === days}">${r} days</button>`).join('')}
                </div>
            </div>
        </div>
        <div id="analytics-body" aria-live="polite"><div class="loading">Loading analytics…</div></div>`;

    const body = root.querySelector('#analytics-body');

    async function load() {
        controller?.abort();
        controller = new AbortController();
        body.innerHTML = '<div class="loading">Loading analytics…</div>';
        let result;
        try {
            result = await api(`/api/admin/analytics?days=${days}${hideTor ? '&tor=exclude' : ''}`, { signal: controller.signal });
        } catch { return; /* superseded by a newer request */ }

        if (result.status === 501) { body.innerHTML = setupNotice(); return; }
        if (!result.ok) { body.innerHTML = `<div class="notice"><strong>Couldn't load analytics.</strong>${esc(apiProblem(result))}</div>`; return; }

        const d = result.body;
        const series = fillDays(d.rows, d.days);
        const prevSeries = d.prevRows?.length ? fillDays(d.prevRows, d.days, d.days) : null;
        const state = { series, prev: prevSeries, metric: 'views' };
        const peak = series.reduce((a, b) => (b.views > a.views ? b : a), series[0]);
        const summary = `Daily page views over the last ${d.days} days. Total ${fmt(d.totals.current.views)}. Peak ${fmt(peak.views)} on ${peak.date}.`;

        body.innerHTML = `
            <div id="stats-host">${statsHtml(d, series, state.metric)}</div>
            ${trafficNote(d) ? `<div class="modebar"><span class="muted">${esc(trafficNote(d))}</span></div>` : ''}
            <section class="panel" aria-label="Traffic over time">
                <header>
                    <h2 id="chart-title">Page views per day</h2>
                    <span class="legend"><span class="sw sw-cur"></span>This period${prevSeries ? '<span class="sw sw-prev"></span>Previous period' : ''}</span>
                </header>
                <div class="chart-plot" tabindex="0" role="img" aria-label="${esc(summary)} Use left and right arrow keys to read individual days.">
                    <div class="svg-host"></div><div class="tip" hidden></div>
                </div>
                <div class="chart-foot"><span class="chart-readout" aria-live="polite">Hover or tap the chart for a day's count.</span><span class="meta">${esc(d.host)}${d.cached ? ' · cached' : ''}</span></div>
                <p class="chart-note">These are estimates. Cloudflare samples page loads on a site this size, so counts come in steps of about 10 and a single day can shift between refreshes. Trust the totals and the trend over any one day.</p>
            </section>
            <div class="split">
                <section class="panel"><header><h2>Top pages</h2></header>${dataTable(d.paths, { head: 'Page', render: i => pageLabel(i.label), total: d.totals.current.views })}</section>
                ${sourcesHtml(d)}
            </div>
            <section class="panel">
                <header><h2>Core Web Vitals</h2><span class="meta">${fmt(d.vitals.samples)} samples · averages, ${d.days} days</span></header>
                ${vitalsHtml(d.vitals)}
            </section>`;
        attachChart(body, state);

        body.querySelector('#stats-host').addEventListener('click', e => {
            const btn = e.target.closest('button[data-metric]');
            if (!btn || btn.disabled) return;
            state.metric = btn.dataset.metric;
            body.querySelectorAll('.stat-pick').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
            body.querySelector('#chart-title').textContent = state.metric === 'visits' ? 'Visits per day' : 'Page views per day';
            state.redraw();
        });

        const srcTabs = body.querySelector('.tabs-inline');
        const showSource = btn => {
            const k = btn.dataset.src;
            srcTabs.querySelectorAll('button').forEach(b => { b.setAttribute('aria-selected', String(b === btn)); b.tabIndex = b === btn ? 0 : -1; });
            const panel = body.querySelector('#src-panel');
            panel.setAttribute('aria-labelledby', btn.id);
            const head = { referrers: 'Source', countries: 'Country', devices: 'Device' }[k];
            panel.innerHTML = dataTable(d[k], { head, total: d.totals.current.views, ...(k === 'countries' ? { render: i => esc(countryLabel(i.label)) } : {}) });
        };
        srcTabs.addEventListener('click', e => { const b = e.target.closest('button[data-src]'); if (b) showSource(b); });
        srcTabs.addEventListener('keydown', e => {
            const btns = [...srcTabs.querySelectorAll('button')];
            const i = btns.indexOf(document.activeElement);
            if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
            const next = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
            next.focus(); showSource(next); e.preventDefault();
        });
    }

    root.querySelector('#hide-tor').addEventListener('change', e => {
        hideTor = e.target.checked;
        try { sessionStorage.setItem('admin_hide_tor', hideTor ? '1' : '0'); } catch { /* private mode */ }
        load();
    });

    root.querySelector('.seg').addEventListener('click', e => {
        const btn = e.target.closest('button[data-days]');
        if (!btn) return;
        days = Number(btn.dataset.days);
        try { sessionStorage.setItem('admin_range', String(days)); } catch { /* private mode */ }
        root.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        load();
    });

    await load();
}
