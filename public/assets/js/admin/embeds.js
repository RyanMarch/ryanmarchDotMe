import { esc } from './util.js';
import { cachedScan, scanAll } from './scan-client.js';
import { openInEditor } from './health.js';

/** Verdict for one audio file from a scan result: ['ok' | 'warning' | 'error', label]. */
export function audioState(a) {
    const s = typeof a === 'number' ? a : a.status;
    if (s === 0) return ['warning', 'Unreachable'];
    if (!(s >= 200 && s < 300)) return ['error', `Missing (${s})`];
    if (typeof a === 'number') return ['ok', 'Found'];
    if (a.bytes === 0) return ['error', 'Empty file'];
    if (a.type && !/^audio\//.test(a.type) && a.type !== 'application/octet-stream') return ['error', `Not audio (${a.type})`];
    if (a.signature === null) return ['error', 'Not a valid audio file'];
    if (a.ranges === false) return ['warning', "Plays, but can't seek"];
    return ['ok', 'Found'];
}
const mb = n => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
/** "MP3 · 28.3 MB" for a file that answered. */
export const audioDetail = a => [a.signature ? a.signature.toUpperCase() : '', a.bytes ? mb(a.bytes) : ''].filter(Boolean).join(' · ');
// YouTube's oEmbed answers by the video's real state: 401 when the owner disabled embedding (or the video is private),
// 403 when it is restricted, 404 when it was removed, and 400 for an ID that was never valid.
const VIDEO_PROBLEMS = { 400: 'Invalid video ID', 401: 'Embedding disabled or private', 403: 'Restricted', 404: 'Removed' };
export const videoState = s => (s >= 200 && s < 300 ? ['ok', 'Available'] : s === 0 ? ['warning', 'Unreachable'] : ['error', VIDEO_PROBLEMS[s] || `Unavailable (${s})`]);
const chip = ([cls, text]) => `<span class="sev sev-${cls === 'ok' ? 'ok' : cls}">${esc(text)}</span>`;

export function summarizeEmbeds(scans) {
    let audio = 0, videos = 0, problems = 0;
    for (const s of scans) {
        for (const a of s.audio || []) { audio++; if (audioState(a)[0] !== 'ok') problems++; }
        for (const v of s.videos || []) { videos++; if (videoState(v.status)[0] !== 'ok') problems++; }
    }
    return { audio, videos, problems };
}

export async function render(root) {
    const projects = globalThis.myProjects || [];
    const names = new Map(projects.map(p => [p.id, p.title]));
    let onlyProblems = false;
    let data = cachedScan();

    root.innerHTML = `
        <div class="view-head">
            <div><h1>Embeds</h1><p>Every audio player and YouTube video in your write-ups, checked against its live source.</p></div>
            <div class="head-actions">
                <label class="check-line inline"><input type="checkbox" id="only-problems"> Only problems</label>
                <button type="button" class="btn" id="scan-btn">Rescan</button>
            </div>
        </div>
        <div id="embeds-status" class="status-line" aria-live="polite"></div>
        <div id="embeds-body"></div>`;
    const body = root.querySelector('#embeds-body');
    const status = root.querySelector('#embeds-status');
    const btn = root.querySelector('#scan-btn');

    const paint = () => {
        const c = summarizeEmbeds(data.scans);
        const rows = data.scans.filter(s => (s.audio?.length || s.videos?.length)).map(s => {
            const audio = (s.audio || []).filter(a => !onlyProblems || audioState(a)[0] !== 'ok');
            const videos = (s.videos || []).filter(v => !onlyProblems || videoState(v.status)[0] !== 'ok');
            if (!audio.length && !videos.length) return '';
            return `<section class="panel"><header><h2>${esc(names.get(s.project) || s.project)}</h2></header>
                <ul class="rows">
                    ${audio.map(a => `<li><span class="label wrap"><strong>${esc(a.title || a.key || 'Audio')}</strong>${a.subtitle ? ` <span class="muted">· ${esc(a.subtitle)}</span>` : ''}<span class="sub">Audio · ${esc(a.key || a.src)}${audioDetail(a) ? ` · ${esc(audioDetail(a))}` : ''}</span></span><span class="value">${chip(audioState(a))}</span></li>`).join('')}
                    ${videos.map(v => `<li><span class="label wrap"><strong>${esc(v.title || 'YouTube video')}</strong><span class="sub">YouTube · ${esc(v.id)}</span></span><span class="value">${chip(videoState(v.status))}</span></li>`).join('')}
                </ul>
                <div class="panel-foot"><button type="button" class="linklike" data-open="${esc(s.project)}">Open write-up in editor</button></div>
            </section>`;
        }).join('');
        body.innerHTML = `<dl class="stats stats-3">
            <div class="stat"><dt>Audio players</dt><dd>${c.audio}<span class="delta">&nbsp;</span></dd></div>
            <div class="stat"><dt>YouTube videos</dt><dd>${c.videos}<span class="delta">&nbsp;</span></dd></div>
            <div class="stat"><dt>Problems</dt><dd>${c.problems}<span class="delta">${c.problems ? 'need attention' : 'all good'}</span></dd></div></dl>
            ${rows || '<div class="panel"><div class="panel-body muted">Nothing to show.</div></div>'}`;
    };

    const run = async () => {
        btn.disabled = true;
        data = await scanAll(projects, (done, total) => { status.textContent = `Scanning ${done} of ${total} write-ups…`; });
        status.textContent = `Scanned ${data.total - data.failed} of ${data.total} write-ups${data.failed ? `; ${data.failed} could not be read` : ''}.`;
        btn.disabled = false;
        paint();
    };

    root.querySelector('#only-problems').addEventListener('change', e => { onlyProblems = e.target.checked; if (data) paint(); });
    btn.addEventListener('click', run);
    body.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o) openInEditor(o.dataset.open); });

    if (data) { status.textContent = 'Showing the last scan from this session.'; paint(); } else await run();
}
