import { api, apiProblem, barRows, deltaText, esc, fmt, setupNotice } from './util.js';

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

export function pageLabel(path) {
    const m = path.match(/^\/project\/([^/]+)\/?$/i);
    const title = m && titleFor(m[1].toLowerCase());
    return title
        ? `<a href="${esc(path)}" target="_blank" rel="noopener">${esc(title)}</a><span class="sub">${esc(path)}</span>`
        : `<a href="${esc(path)}" target="_blank" rel="noopener">${esc(path)}</a>`;
}

/** Fill missing days with zero so the chart's x-axis is continuous. */
export function fillDays(rows, days) {
    const byDate = new Map(rows.map(r => [r.date, r]));
    const out = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
        const key = d.toISOString().slice(0, 10);
        out.push({ date: key, views: byDate.get(key)?.views || 0 });
    }
    return out;
}

const niceMax = n => {
    if (n <= 4) return 4;
    const mag = 10 ** Math.floor(Math.log10(n));
    return Math.ceil(n / (mag / 2)) * (mag / 2);
};

export function chartSvg(series, W = 720) {
    const H = 190, L = 34, B = 22, T = 8;
    const max = niceMax(Math.max(...series.map(s => s.views), 1));
    const bw = (W - L) / series.length;
    const y = v => T + (H - T - B) * (1 - v / max);
    const grid = [0, 0.5, 1].map(f => {
        const v = Math.round(max * f);
        return `<line class="grid" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
    }).join('');
    const bars = series.map((s, i) => {
        const h = Math.max(s.views ? 1.5 : 0, (H - T - B) * (s.views / max));
        return `<rect class="bar-rect" data-i="${i}" x="${(L + i * bw + bw * 0.14).toFixed(2)}" y="${(H - B - h).toFixed(2)}" width="${(bw * 0.72).toFixed(2)}" height="${h.toFixed(2)}"/>`;
    }).join('');
    const label = i => new Date(series[i].date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const mid = Math.floor(series.length / 2);
    const xl = [[0, 'start'], [mid, 'middle'], [series.length - 1, 'end']].map(([i, a]) =>
        `<text x="${a === 'start' ? L : a === 'end' ? W : L + (i + 0.5) * bw}" y="${H - 5}" text-anchor="${a}">${label(i)}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${grid}${bars}${xl}</svg>`;
}

function attachChart(root, series) {
    const readout = root.querySelector('.chart-readout');
    const box = root.querySelector('.chart');
    let rects = [];
    let cur = -1;
    // Draw at the container's real width so axis text stays a readable size on phones.
    const draw = () => {
        const w = Math.max(280, Math.floor(box.clientWidth - 32));
        box.innerHTML = chartSvg(series, w);
        rects = [...box.querySelectorAll('.bar-rect')];
        if (cur >= 0) rects[cur]?.classList.add('on');
    };
    draw();
    let lastW = box.clientWidth;
    new ResizeObserver(() => { if (box.clientWidth !== lastW) { lastW = box.clientWidth; draw(); } }).observe(box);
    const show = i => {
        if (i < 0 || i >= series.length) return;
        rects.forEach(r => r.classList.remove('on'));
        rects[i].classList.add('on');
        cur = i;
        const d = new Date(series[i].date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
        readout.textContent = `${d}: ${fmt(series[i].views)} page view${series[i].views === 1 ? '' : 's'}`;
    };
    const fromPointer = e => {
        const r = box.querySelector('svg').getBoundingClientRect();
        const slot = (r.width - 34) / series.length;
        show(Math.min(series.length - 1, Math.max(0, Math.floor((e.clientX - r.left - 34) / slot))));
    };
    box.addEventListener('pointermove', fromPointer);
    box.addEventListener('pointerdown', fromPointer);
    box.addEventListener('keydown', e => {
        if (e.key === 'ArrowLeft') { show(cur < 0 ? series.length - 1 : cur - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { show(cur < 0 ? 0 : cur + 1); e.preventDefault(); }
    });
}

function statsHtml(d) {
    const cur = d.totals.current, prev = d.totals.previous;
    const label = `previous ${d.days} days`;
    const ppv = cur.visits ? (cur.views / cur.visits).toFixed(2) : '–';
    return `<dl class="stats">
        <div class="stat"><dt>Page views</dt><dd>${fmt(cur.views)}<span class="delta">${esc(deltaText(cur.views, prev.views, label))}</span></dd></div>
        <div class="stat"><dt>Visits</dt><dd>${fmt(cur.visits)}<span class="delta">${cur.visits === null ? 'not reported' : esc(deltaText(cur.visits, prev.visits, label))}</span></dd></div>
        <div class="stat"><dt>Pages per visit</dt><dd>${ppv}<span class="delta">&nbsp;</span></dd></div>
        <div class="stat"><dt>Largest contentful paint</dt><dd>${ms(d.vitals.lcp_ms)}<span class="delta">${esc(rate('lcp_ms', d.vitals.lcp_ms).text)}</span></dd></div>
    </dl>`;
}

function vitalsHtml(v) {
    const cell = (k, key, val, text) => {
        const r = key ? rate(key, val) : { text: '', cls: '' };
        return `<div class="vital"><div class="k">${k}</div><div class="v">${text}</div><div class="r ${r.cls}">${r.text}</div></div>`;
    };
    return `<div class="vitals">
        ${cell('LCP', 'lcp_ms', v.lcp_ms, ms(v.lcp_ms))}
        ${cell('INP', 'inp_ms', v.inp_ms, ms(v.inp_ms))}
        ${cell('CLS', 'cls', v.cls, v.cls ?? '–')}
        ${cell('FCP', 'fcp_ms', v.fcp_ms, ms(v.fcp_ms))}
    </div>`;
}

export async function render(root) {
    let days = Number(sessionStorage.getItem('admin_range')) || 30;
    if (!RANGES.includes(days)) days = 30;
    let controller;

    root.innerHTML = `
        <div class="view-head">
            <div><h1>Analytics</h1><p>Cloudflare Web Analytics for ryanmarch.me. Privacy-friendly: no cookies, no personal data.</p></div>
            <div class="seg" role="group" aria-label="Date range">
                ${RANGES.map(r => `<button type="button" data-days="${r}" aria-pressed="${r === days}">${r} days</button>`).join('')}
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
            result = await api(`/api/admin/analytics?days=${days}`, { signal: controller.signal });
        } catch { return; /* superseded by a newer request */ }

        if (result.status === 501) { body.innerHTML = setupNotice(); return; }
        if (!result.ok) { body.innerHTML = `<div class="notice"><strong>Couldn't load analytics.</strong>${esc(apiProblem(result))}</div>`; return; }

        const d = result.body;
        const series = fillDays(d.rows, d.days);
        const peak = series.reduce((a, b) => (b.views > a.views ? b : a), series[0]);
        const summary = `Daily page views over the last ${d.days} days. Total ${fmt(d.totals.current.views)}. Peak ${fmt(peak.views)} on ${peak.date}.`;

        body.innerHTML = `
            ${statsHtml(d)}
            <section class="panel" aria-label="Daily page views">
                <header><h2>Page views per day</h2><span class="meta">${esc(d.host)}${d.cached ? ' · cached' : ''}</span></header>
                <div class="chart" tabindex="0" role="img" aria-label="${esc(summary)} Use left and right arrow keys to read individual days."></div>
                <div class="chart-readout" aria-live="polite">Tap or hover a bar for the day's count.</div>
            </section>
            <div class="cols">
                <section class="panel"><header><h2>Top pages</h2></header>${barRows(d.paths, i => pageLabel(i.label))}</section>
                <section class="panel"><header><h2>Referrers</h2></header>${barRows(d.referrers)}</section>
                <section class="panel"><header><h2>Countries</h2></header>${barRows(d.countries)}</section>
                <section class="panel"><header><h2>Devices</h2></header>${barRows(d.devices)}</section>
            </div>
            <section class="panel">
                <header><h2>Core Web Vitals</h2><span class="meta">${fmt(d.vitals.samples)} samples · averages, ${d.days} days</span></header>
                ${vitalsHtml(d.vitals)}
            </section>`;
        attachChart(body, series);
    }

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
