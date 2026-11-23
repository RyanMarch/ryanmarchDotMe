// Pure helpers that turn the admin's different data sources into per-project rows and a weekly summary.
import { esc, fmt } from './util.js';

const DAY = 86400000;
const STALE_DAYS = 180;
const slashless = p => String(p || '').replace(/\/+$/, '') || '/';

export const monthsAgo = (iso, now = Date.now()) => Math.floor((now - Date.parse(iso)) / (30 * DAY));

/**
 * One row per published project with its own page: views, Google clicks, plays, outbound clicks, last edit,
 * and up to two plain-language notes about what is worth attention.
 */
export function projectInsights({ projects = [], paths = [], pages = [], nearMisses = [], edited = {}, events = {}, index = {}, now = Date.now() }) {
    const views = new Map(paths.map(p => [slashless(p.label), p.count]));
    const search = new Map(pages.map(p => [slashless(p.page), p]));
    const misses = new Set(nearMisses.map(m => slashless(m.page)));
    const rows = projects.filter(p => !p.unpublished && p.hasExtendedContent).map(p => {
        const key = `/project/${p.id}`;
        const s = search.get(key);
        return {
            id: p.id, title: p.title,
            views: views.get(key) || 0,
            clicks: s?.clicks || 0, impressions: s?.impressions || 0, position: s?.position || 0,
            plays: events.play?.[p.id] || 0, outs: events.out?.[p.id] || 0,
            edited: edited[p.id] || null, indexState: index[p.id]?.state || null,
            nearMiss: misses.has(key)
        };
    });
    const ranked = rows.map(r => r.views).filter(Boolean).sort((a, b) => b - a);
    const top = ranked.length >= 4 ? ranked[Math.floor(ranked.length / 4)] : Infinity;
    for (const r of rows) {
        const notes = [];
        if (r.indexState === 'not-indexed') notes.push({ level: 'warning', text: "Not in Google's index yet" });
        if (r.impressions >= 20 && r.clicks === 0) notes.push({ level: 'info', text: 'Shows in Google but nobody clicks: try a sharper title and description' });
        else if (r.nearMiss) notes.push({ level: 'info', text: 'Close to page 1 for a phrase: see Easy wins on Search' });
        if (r.edited && Date.parse(r.edited) < now - STALE_DAYS * DAY) notes.push({ level: 'info', text: `Not edited in ${monthsAgo(r.edited, now)} months` });
        if (r.views >= top && r.views > 0) notes.push({ level: 'info', text: 'One of your most-read projects' });
        if (!r.views && !r.impressions) notes.push({ level: 'info', text: 'No views or searches in this range' });
        r.notes = notes.slice(0, 2);
    }
    return rows.sort((a, b) => b.views - a.views || b.clicks - a.clicks || a.title.localeCompare(b.title));
}

/** Projects not touched for half a year, oldest first. */
export function staleProjects(projects, edited, now = Date.now()) {
    return projects.filter(p => !p.unpublished && edited[p.id] && Date.parse(edited[p.id]) < now - STALE_DAYS * DAY)
        .map(p => ({ id: p.id, title: p.title, months: monthsAgo(edited[p.id], now) }))
        .sort((a, b) => b.months - a.months);
}

const sumLast = (series, n, key) => series.slice(-n).reduce((t, r) => t + (r[key] || 0), 0);

/** "This week" lines from data the dashboard already loads. Anything missing is simply left out. */
export function digestLines({ analytics, search, overview, notfound, events, projects = [], now = Date.now() } = {}) {
    const out = [];
    const cur = analytics?.totals?.current?.views, prev = analytics?.totals?.previous?.views;
    if (cur !== undefined) {
        const change = prev ? Math.round(((cur - prev) / prev) * 100) : null;
        out.push(`${fmt(cur)} page views${change === null ? '' : `, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% on the week before`}.`);
    }
    const title = id => projects.find(p => p.id === id)?.title || id;
    const best = (analytics?.paths || []).map(p => ({ id: (p.label.match(/^\/project\/([^/]+)/i) || [])[1], count: p.count })).find(p => p.id);
    if (best) out.push(`Most read project: ${esc(title(best.id.toLowerCase()))} (${fmt(best.count)} views).`);
    if (search?.daily?.length) {
        const clicks = sumLast(search.daily, 7, 'clicks');
        const impressions = sumLast(search.daily, 7, 'impressions');
        out.push(`${fmt(clicks)} clicks from Google (${fmt(impressions)} impressions) in the last 7 days of data.`);
    }
    const plays = Object.values(events?.play || {}).reduce((a, b) => a + b, 0);
    const outs = Object.values(events?.out || {}).reduce((a, b) => a + b, 0);
    if (events?.available && (plays || outs)) out.push(`${fmt(plays)} plays and ${fmt(outs)} clicks out to live projects or source.`);
    const recent = (overview?.commits || []).filter(c => Date.parse(c.date) > now - 7 * DAY).length;
    if (overview?.commits) out.push(`${recent === (overview.commits.length) ? `${recent}+` : recent} edit${recent === 1 ? '' : 's'} saved to the repo.`);
    const lost = (notfound?.available ? notfound.items : []).reduce((n, i) => n + i.count, 0);
    if (notfound?.available && lost) out.push(`${fmt(lost)} visits to pages that don't exist.`);
    return out;
}
