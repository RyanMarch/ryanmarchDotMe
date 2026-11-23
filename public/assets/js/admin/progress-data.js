// Pure helpers for the Progress page and the dashboard's "Next up": streaks, a monthly journal, completeness,
// milestones, and one small suggested task at a time. No DOM, so they can be tested.
import { staleProjects } from './insights.js';

const DAY = 86400000;
const MERGE = /^Merge (pull request|branch|remote-tracking)/i;
const NOISE = /^admin( test cleanup)?: .*test/i;
const real = c => !MERGE.test(c.message) && !NOISE.test(c.message);

/** Monday 00:00 UTC of the week holding `ms`, as YYYY-MM-DD. */
export function weekKey(ms) {
    const d = new Date(ms);
    const back = (d.getUTCDay() + 6) % 7;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

/**
 * Weeks in a row with at least one real edit. A quiet current week does not break it until the week is over.
 * Only as far back as the commits given reach.
 */
export function streak(commits, now = Date.now()) {
    const weeks = new Set(commits.filter(real).map(c => weekKey(Date.parse(c.date))));
    const thisWeek = weekKey(now);
    let cursor = weeks.has(thisWeek) ? Date.parse(thisWeek) : Date.parse(thisWeek) - 7 * DAY;
    let current = 0;
    while (weeks.has(weekKey(cursor))) { current++; cursor -= 7 * DAY; }
    const sorted = [...weeks].sort();
    let best = 0, run = 0, prev = null;
    for (const w of sorted) {
        run = prev !== null && Date.parse(w) - prev === 7 * DAY ? run + 1 : 1;
        best = Math.max(best, run);
        prev = Date.parse(w);
    }
    return { current, best, activeThisWeek: weeks.has(thisWeek) };
}

/** Commits grouped by month, newest first, with a few of the more telling messages from each. */
export function journalMonths(commits) {
    const by = new Map();
    for (const c of commits.filter(real)) {
        const key = c.date.slice(0, 7);
        if (!by.has(key)) by.set(key, []);
        by.get(key).push(c.message);
    }
    return [...by].sort((a, b) => b[0].localeCompare(a[0])).map(([key, messages]) => ({
        key,
        label: new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        count: messages.length,
        highlights: [...new Set(messages.map(m => m.replace(/^admin: /i, '')))].slice(0, 5)
    }));
}

const CHECKS = [
    ['Card image', p => Boolean(p.image || p.symbol), () => true],
    ['Write-up', p => Boolean(p.hasExtendedContent), () => true],
    ['Share image', p => Boolean(p.ogImage), p => p.hasExtendedContent],
    ['Search title', p => Boolean(p.seoTitle), p => p.hasExtendedContent],
    ['Search description', p => Boolean(p.seoDescription), p => p.hasExtendedContent]
];

/** What each published project still lacks, and an overall percentage of checks passed. */
export function completeness(projects) {
    let passed = 0, total = 0;
    const rows = projects.filter(p => !p.unpublished).map(p => {
        const missing = [];
        for (const [label, ok, applies] of CHECKS) {
            if (!applies(p)) continue;
            total++;
            if (ok(p)) passed++; else missing.push(label);
        }
        return { id: p.id, title: p.title, missing };
    });
    return { rows: rows.sort((a, b) => b.missing.length - a.missing.length || a.title.localeCompare(b.title)), percent: total ? Math.round((passed / total) * 100) : 100 };
}

/** Searches that landed somewhere other than a project page: topics people want that you have no page for. */
export function topicIdeas(pairs = [], limit = 10) {
    const by = new Map();
    for (const r of pairs) {
        if (/^\/project\/[^/]+/i.test(r.page)) continue;
        const cur = by.get(r.query) || { query: r.query, impressions: 0, clicks: 0, page: r.page };
        cur.impressions += r.impressions; cur.clicks += r.clicks;
        by.set(r.query, cur);
    }
    return [...by.values()].filter(r => r.impressions >= 2).sort((a, b) => b.impressions - a.impressions).slice(0, limit);
}

/** Milestones reached right now, from data in hand. Each has a stable key so "new" can be remembered. */
export function milestones({ search, projects = [], index = {}, streakWeeks = 0, topProject = null } = {}) {
    const out = [];
    const clicks = search?.totals?.current?.clicks || 0;
    const impressions = search?.totals?.current?.impressions || 0;
    for (const n of [1, 10, 50, 100, 250, 500, 1000]) if (clicks >= n) out.push({ key: `clicks-${n}`, title: n === 1 ? 'Your first click from Google' : `${n} clicks from Google in a month`, rank: n });
    for (const n of [100, 1000, 10000]) if (impressions >= n) out.push({ key: `impressions-${n}`, title: `Shown on Google ${n.toLocaleString()} times in a month`, rank: n });
    const pages = projects.filter(p => !p.unpublished && p.hasExtendedContent);
    const checked = pages.filter(p => index[p.id]);
    if (pages.length && checked.length === pages.length && checked.every(p => index[p.id].state === 'indexed')) out.push({ key: 'all-indexed', title: 'Every project page is in Google', rank: 1 });
    for (const n of [2, 4, 8, 12, 26, 52]) if (streakWeeks >= n) out.push({ key: `streak-${n}`, title: `${n} weeks in a row of improving the site`, rank: n });
    if (topProject) out.push({ key: `top-${topProject.id}`, title: `${topProject.title} is your most-read project`, rank: 0 });
    return out;
}

/**
 * Small tasks, best first. Each: { key, title, why, minutes, href, cta }.
 * `skip` rotates through them so "Another" shows the next one.
 */
export function nextUp({ projects = [], search, index = {}, edited = {}, ideas = [], now = Date.now() } = {}) {
    const tasks = [];
    const published = projects.filter(p => !p.unpublished);
    const title = id => projects.find(p => p.id === id)?.title || id;

    for (const m of search?.nearMisses || []) {
        const id = (m.page.match(/^\/project\/([^/]+)/i) || [])[1];
        if (id) tasks.push({ key: `near-${id}-${m.query}`, title: `Sharpen ${title(id)} for "${m.query}"`, why: `It shows ${m.impressions} times on Google at position ${m.position.toFixed(1)} but gets ${m.clicks} clicks. A clearer title or description usually helps.`, minutes: 10, href: `/admin/search?project=${id}`, cta: 'Open the project' });
    }
    for (const p of published.filter(p => p.hasExtendedContent && !p.seoDescription)) tasks.push({ key: `desc-${p.id}`, title: `Write a search description for ${p.title}`, why: 'Google shows this under your link. Without one it guesses.', minutes: 5, href: '/admin/seo', cta: 'Open SEO' });
    for (const p of published.filter(p => p.hasExtendedContent && !p.ogImage)) tasks.push({ key: `og-${p.id}`, title: `Add a share image for ${p.title}`, why: 'It is the picture people see when the link is shared.', minutes: 15, href: '/admin/media', cta: 'Open Media' });
    for (const p of published.filter(p => index[p.id]?.state === 'not-indexed')) tasks.push({ key: `idx-${p.id}`, title: `Get ${p.title} into Google`, why: "Google hasn't indexed this page yet. Ask for indexing in Search Console, and check the page links to it.", minutes: 5, href: `/admin/search?project=${p.id}`, cta: 'See the status' });
    for (const s of staleProjects(published, edited, now).slice(0, 3)) tasks.push({ key: `stale-${s.id}`, title: `Refresh ${s.title}`, why: `It hasn't been edited in ${s.months} months. A fresh screenshot or a new paragraph keeps it feeling alive.`, minutes: 20, href: `/admin/projects?file=${encodeURIComponent(`content/${s.id}/index.html`)}`, cta: 'Open the write-up' });
    for (const i of ideas.filter(i => !i.done).slice(0, 2)) tasks.push({ key: `idea-${i.id}`, title: `From your inbox: ${i.text}`, why: 'You wrote this down because it was worth doing.', minutes: 30, href: '/admin/progress', cta: 'Open the inbox' });
    return tasks;
}

const SEEN = 'admin.milestones.seen';
export const readSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { return new Set(); } };
export const writeSeen = keys => { try { localStorage.setItem(SEEN, JSON.stringify([...keys])); } catch { /* a per-viewer nicety only */ } };

/** Keep the highest of each kind (the 100-clicks one, not also 10 and 50). */
export function highest(list) {
    const best = new Map();
    for (const m of list) {
        const family = m.key.split('-')[0];
        const slot = family === 'top' || family === 'all' ? m.key : family;
        if (!best.has(slot) || m.rank > best.get(slot).rank) best.set(slot, m);
    }
    return [...best.values()];
}
