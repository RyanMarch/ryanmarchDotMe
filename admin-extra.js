/**
 * Admin endpoints added after the first set: sitemap status, last-edited dates, scheduled publishing and
 * site events (project-page plays and outbound clicks). Plus the two Worker entry points they need: the
 * public event beacon and the cron that applies due schedules.
 */
import { adminEmail, ghJson, jsonResponse, safeBranch, withEditor } from './admin-http.js';
import { setUnpublished } from './public/assets/js/admin/project-order.js';
import { parseProjectDataSource } from './public/assets/js/admin-project-parser.js';
import { fetchPageWindow, fetchSitemaps } from './search-console.js';

const ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
const DATA_FILE = 'public/assets/js/project-data.js';
const SCHEDULE_KEY = 'schedule:v1';
const EVENT_TYPES = new Set(['play', 'out']);

/* ───────────── sitemap status ───────────── */

export async function handleSitemaps(request, env, url, fetchImpl) {
    if (!env.GSC_SERVICE_ACCOUNT) return jsonResponse({ configured: false, message: 'Set GSC_SERVICE_ACCOUNT to enable Search Console.' }, 501);
    try {
        return jsonResponse({ sitemaps: await fetchSitemaps(env, fetchImpl) });
    } catch (e) {
        return jsonResponse({ error: 'sitemaps_failed', message: e.message }, 502);
    }
}

/* ───────────── last edited per project ───────────── */

/** One GitHub GraphQL call: the newest commit touching each project's folder. Cached an hour. */
export async function handleFreshness(request, env, url, fetchImpl, { projects = [] } = {}) {
    if (!env.GITHUB_REPO || !env.GITHUB_PAT) return jsonResponse({ available: false, message: 'GitHub access is not configured.' });
    const branch = safeBranch(url.searchParams.get('branch') || 'main');
    const key = `fresh:v1:${branch}`;
    if (env.ADMIN_KV) {
        const hit = await env.ADMIN_KV.get(key, 'json').catch(() => null);
        if (hit) return jsonResponse({ ...hit, cached: true });
    }
    const ids = projects.map(p => p.id).filter(id => ID.test(id));
    const fields = ids.map((id, i) => `p${i}: history(path: "public/content/${id}", first: 1) { nodes { committedDate } }`).join('\n');
    const [owner, name] = env.GITHUB_REPO.split('/');
    try {
        const res = await fetchImpl('https://api.github.com/graphql', {
            method: 'POST',
            headers: { Authorization: `bearer ${env.GITHUB_PAT}`, 'User-Agent': `${name}-Cloudflare-Worker`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `query($owner:String!,$name:String!,$ref:String!){repository(owner:$owner,name:$name){ref(qualifiedName:$ref){target{... on Commit{${fields}}}}}}`, variables: { owner, name, ref: `refs/heads/${branch}` } })
        });
        if (!res.ok) throw new Error(`GitHub ${res.status}`);
        const target = (await res.json())?.data?.repository?.ref?.target;
        if (!target) throw new Error('no history');
        const edited = {};
        ids.forEach((id, i) => { const d = target[`p${i}`]?.nodes?.[0]?.committedDate; if (d) edited[id] = d; });
        const out = { available: true, branch, edited };
        if (env.ADMIN_KV) await env.ADMIN_KV.put(key, JSON.stringify(out), { expirationTtl: 3600 }).catch(() => {});
        return jsonResponse(out);
    } catch (e) {
        return jsonResponse({ available: false, message: `GitHub: ${e.message}` });
    }
}

/* ───────────── scheduled publishing ───────────── */

const readSchedule = async env => (env.ADMIN_KV && await env.ADMIN_KV.get(SCHEDULE_KEY, 'json').catch(() => null)) || { items: [], log: [] };
const writeSchedule = (env, data) => env.ADMIN_KV.put(SCHEDULE_KEY, JSON.stringify(data));

export async function handleSchedule(request, env, url, fetchImpl, { projects = [] } = {}) {
    if (!env.ADMIN_KV) return jsonResponse({ available: false, items: [], log: [], message: 'Scheduling needs the ADMIN_KV binding.' });
    const data = await readSchedule(env);
    if (request.method === 'GET') return jsonResponse({ available: true, ...data });

    if (request.method === 'DELETE') {
        const id = url.searchParams.get('project');
        const next = { ...data, items: data.items.filter(i => i.id !== id) };
        await writeSchedule(env, next);
        return jsonResponse({ available: true, ...next });
    }

    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'bad_json', message: 'Send JSON.' }, 400); }
    const project = projects.find(p => p.id === body.project);
    const at = Date.parse(body.at);
    if (!project) return jsonResponse({ error: 'unknown_project', message: 'Unknown project.' }, 404);
    if (!['publish', 'unpublish'].includes(body.action)) return jsonResponse({ error: 'bad_action', message: 'Action must be publish or unpublish.' }, 400);
    if (!Number.isFinite(at) || at < Date.now() + 60_000 || at > Date.now() + 366 * 86400_000) return jsonResponse({ error: 'bad_time', message: 'Pick a time between a minute from now and a year ahead.' }, 400);
    const item = { id: project.id, action: body.action, at: new Date(at).toISOString(), by: adminEmail(request) || '', created: new Date().toISOString() };
    const next = { ...data, items: [...data.items.filter(i => i.id !== project.id), item].sort((a, b) => a.at.localeCompare(b.at)) };
    await writeSchedule(env, next);
    return jsonResponse({ available: true, ...next });
}

/** Commits the flag change for one scheduled item on main. Throws on any problem so the item stays visible. */
export async function applySchedule(env, item, fetchImpl = fetch) {
    const file = await ghJson(env, `contents/${DATA_FILE}?ref=main`, fetchImpl);
    const source = new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\n/g, '')), c => c.charCodeAt(0)));
    const unpublished = item.action === 'unpublish';
    const current = parseProjectDataSource(source).find(p => p.id === item.id);
    if (!current) throw new Error(`No project "${item.id}" any more.`);
    if ((current.unpublished === true) === unpublished) return { changed: false };
    const next = setUnpublished(source, item.id, unpublished);
    const check = parseProjectDataSource(next);
    if (check.length !== parseProjectDataSource(source).length || (check.find(p => p.id === item.id)?.unpublished === true) !== unpublished) throw new Error('The edit did not re-parse cleanly.');
    const bytes = new TextEncoder().encode(next);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    const res = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${DATA_FILE}`, {
        method: 'PUT',
        headers: { Authorization: `token ${env.GITHUB_PAT}`, 'User-Agent': `${env.GITHUB_REPO.split('/').pop()}-Cloudflare-Worker`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: withEditor(`admin: scheduled ${item.action} of ${item.id}`, item.by), content: btoa(bin), sha: file.sha, branch: 'main' })
    });
    if (!res.ok) throw new Error(`GitHub ${res.status} while saving`);
    return { changed: true };
}

/** Cron entry point: applies whatever is due. A failed item is logged and dropped, so it never retries forever. */
export async function runDueSchedules(env, fetchImpl = fetch, now = Date.now()) {
    if (!env.ADMIN_KV || !env.GITHUB_REPO || !env.GITHUB_PAT) return { ran: 0 };
    const data = await readSchedule(env);
    const due = data.items.filter(i => Date.parse(i.at) <= now);
    if (!due.length) return { ran: 0 };
    const log = [...(data.log || [])];
    for (const item of due) {
        try {
            const r = await applySchedule(env, item, fetchImpl);
            log.unshift({ id: item.id, action: item.action, at: item.at, ok: true, note: r.changed ? '' : 'Already in that state' });
        } catch (e) {
            log.unshift({ id: item.id, action: item.action, at: item.at, ok: false, note: e.message });
        }
    }
    await writeSchedule(env, { items: data.items.filter(i => Date.parse(i.at) > now), log: log.slice(0, 10) });
    return { ran: due.length };
}

/* ───────────── events: plays and outbound clicks ───────────── */

const BOT = /bot|crawl|spider|slurp|preview|monitor|curl\/|wget|python|headless/i;
const day = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

/** Public beacon: POST /api/e {t:'play'|'out', p:'<project id>'}. Counts only; nothing identifies a visitor. */
export async function recordEvent(request, env, projects) {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    if (!env.ADMIN_KV || BOT.test(request.headers.get('user-agent') || '')) return new Response(null, { status: 204 });
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).hostname.replace(/^www\./, '') !== new URL(request.url).hostname.replace(/^www\./, '')) return new Response(null, { status: 403 });
    let body;
    try { body = JSON.parse((await request.text()).slice(0, 200)); } catch { return new Response(null, { status: 400 }); }
    if (!EVENT_TYPES.has(body?.t) || !ID.test(body?.p || '') || !projects.some(p => p.id === body.p)) return new Response(null, { status: 400 });
    const key = `ev:v1:${day()}`;
    try {
        const counts = (await env.ADMIN_KV.get(key, 'json')) || {};
        counts[`${body.t}:${body.p}`] = (counts[`${body.t}:${body.p}`] || 0) + 1;
        await env.ADMIN_KV.put(key, JSON.stringify(counts), { expirationTtl: 60 * 60 * 24 * 120 });
    } catch { /* counting is best-effort */ }
    return new Response(null, { status: 204 });
}

/** Adds the day files in the window into { play: {id: n}, out: {id: n} } totals, plus the previous window. */
export async function handleEvents(request, env, url) {
    if (!env.ADMIN_KV) return jsonResponse({ available: false, message: 'Event counts need the ADMIN_KV binding.' });
    const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
    const keys = Array.from({ length: days }, (_, i) => `ev:v1:${day(Date.now() - i * 86400000)}`);
    const out = { play: {}, out: {} };
    let first = null;
    for (const k of keys) {
        const counts = await env.ADMIN_KV.get(k, 'json').catch(() => null);
        if (!counts) continue;
        first = k.slice(6);
        for (const [name, n] of Object.entries(counts)) {
            const [type, id] = name.split(':');
            if (out[type]) out[type][id] = (out[type][id] || 0) + n;
        }
    }
    return jsonResponse({ available: true, days, since: first, ...out });
}

/* ───────────── ideas inbox ───────────── */

const IDEAS_KEY = 'ideas:v1';
const MAX_IDEAS = 100;

export async function handleIdeas(request, env, url) {
    if (!env.ADMIN_KV) return jsonResponse({ available: false, ideas: [], message: 'The ideas inbox needs the ADMIN_KV binding.' });
    const ideas = (await env.ADMIN_KV.get(IDEAS_KEY, 'json').catch(() => null)) || [];
    const save = async list => { await env.ADMIN_KV.put(IDEAS_KEY, JSON.stringify(list)); return jsonResponse({ available: true, ideas: list }); };

    if (request.method === 'GET') return jsonResponse({ available: true, ideas });
    if (request.method === 'DELETE') return save(ideas.filter(i => i.id !== url.searchParams.get('id')));

    let body;
    try { body = await request.json(); } catch { return jsonResponse({ error: 'bad_json', message: 'Send JSON.' }, 400); }
    if (body.id) { // mark done or not
        return save(ideas.map(i => (i.id === body.id ? { ...i, done: Boolean(body.done) } : i)));
    }
    const text = String(body.text || '').trim().slice(0, 200);
    if (!text) return jsonResponse({ error: 'empty', message: 'Write the idea first.' }, 400);
    if (ideas.length >= MAX_IDEAS) return jsonResponse({ error: 'full', message: `The inbox holds ${MAX_IDEAS} ideas. Clear some first.` }, 400);
    return save([{ id: crypto.randomUUID().slice(0, 8), text, created: new Date().toISOString(), done: false }, ...ideas]);
}

/* ───────────── journal: the last 100 commits that touched site content ───────────── */

export async function handleJournal(request, env, url, fetchImpl) {
    if (!env.GITHUB_REPO || !env.GITHUB_PAT) return jsonResponse({ available: false, commits: [], message: 'GitHub access is not configured.' });
    const key = 'journal:v2';
    if (env.ADMIN_KV) {
        const hit = await env.ADMIN_KV.get(key, 'json').catch(() => null);
        if (hit) return jsonResponse({ ...hit, cached: true });
    }
    try {
        const list = await ghJson(env, 'commits?sha=main&path=public%2Fcontent&per_page=100', fetchImpl);
        const out = { available: true, commits: list.map(c => ({ date: c.commit.author.date, message: (c.commit.message || '').split('\n')[0], author: c.commit.author.name || '' })) };
        if (env.ADMIN_KV) await env.ADMIN_KV.put(key, JSON.stringify(out), { expirationTtl: 3600 }).catch(() => {});
        return jsonResponse(out);
    } catch (e) {
        return jsonResponse({ available: false, commits: [], message: `GitHub: ${e.message}` });
    }
}

/* ───────────── before and after your last edit ───────────── */

/** Compares a project page's Google numbers in equal windows before and after its newest edit. */
export async function handleImpact(request, env, url, fetchImpl, { projects = [] } = {}) {
    if (!env.GSC_SERVICE_ACCOUNT) return jsonResponse({ configured: false, message: 'Set GSC_SERVICE_ACCOUNT to enable Search Console.' }, 501);
    const id = url.searchParams.get('project');
    if (!projects.some(p => p.id === id) || !ID.test(id)) return jsonResponse({ error: 'unknown_project', message: 'Unknown project.' }, 404);
    const key = `impact:v1:${id}`;
    if (env.ADMIN_KV) {
        const hit = await env.ADMIN_KV.get(key, 'json').catch(() => null);
        if (hit) return jsonResponse({ ...hit, cached: true });
    }
    try {
        const commits = await ghJson(env, `commits?sha=main&path=${encodeURIComponent(`public/content/${id}`)}&per_page=1`, fetchImpl);
        const edited = commits[0]?.commit?.author?.date;
        if (!edited) return jsonResponse({ ready: false, reason: 'No edits found for this project.' });
        const day = 86400000;
        const editDay = Date.parse(edited.slice(0, 10));
        const afterEnd = Date.now() - 2 * day; // Search Console runs about two days behind
        const days = Math.min(28, Math.floor((afterEnd - editDay) / day));
        if (days < 7) return jsonResponse({ ready: false, edited, reason: 'Too soon to compare. Check back a week after the edit.' });
        const iso = ms => new Date(ms).toISOString().slice(0, 10);
        const [before, after] = await Promise.all([
            fetchPageWindow(env, id, iso(editDay - days * day), iso(editDay - day), fetchImpl),
            fetchPageWindow(env, id, iso(editDay + day), iso(editDay + days * day), fetchImpl)
        ]);
        const out = { ready: true, edited, days, before, after };
        if (env.ADMIN_KV) await env.ADMIN_KV.put(key, JSON.stringify(out), { expirationTtl: 6 * 3600 }).catch(() => {});
        return jsonResponse(out);
    } catch (e) {
        return jsonResponse({ error: 'impact_failed', message: e.message }, 502);
    }
}
