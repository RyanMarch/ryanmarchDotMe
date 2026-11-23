// The dashboard's "Worth doing" list: a few concrete next steps worked out from data the admin already loads.
import { esc, fmt } from './util.js';
import { staleProjects } from './insights.js';

const RANK = { error: 0, warning: 1, info: 2 };
const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;

/** Each item: { level: 'error'|'warning'|'info', text, href, action }. Pure; any input may be null. */
export function todayItems({ overview, health, notfound, search, analytics, index, edited, schedule, projects = [], now = Date.now() } = {}) {
    const items = [];
    const counts = health?.counts;
    if (counts?.error) items.push({ level: 'error', text: `${plural(counts.error, 'error')} in Content Health`, href: '/admin/health', action: 'Review' });
    else if (counts?.warning) items.push({ level: 'warning', text: `${plural(counts.warning, 'warning')} in Content Health`, href: '/admin/health', action: 'Review' });

    const lost = (notfound?.available ? notfound.items : []).filter(i => i.count >= 3).slice(0, 2);
    for (const i of lost) items.push({ level: 'warning', text: `${i.path} was hit ${plural(i.count, 'time')} and doesn't exist`, href: '/admin/seo?tab=404', action: 'Add a redirect' });

    const ahead = overview?.pending?.ahead;
    if (ahead) items.push({ level: 'info', text: `${plural(ahead, 'commit')} on develop ${ahead === 1 ? "isn't" : "aren't"} in main yet`, href: '/admin/activity?branch=develop', action: 'See what is waiting' });

    for (const r of (search?.nearMisses || []).slice(0, 2)) {
        items.push({ level: 'info', text: `"${r.query}" shows at position ${r.position.toFixed(1)} (${fmt(r.impressions)} impressions, ${fmt(r.clicks)} clicks)`, href: '/admin/search', action: 'See easy wins' });
    }

    const published = projects.filter(p => !p.unpublished && p.hasExtendedContent);
    const missing = published.filter(p => index?.[p.id]?.state === 'not-indexed');
    if (missing.length) items.push({ level: 'warning', text: `${plural(missing.length, 'project page')} ${missing.length === 1 ? "isn't" : "aren't"} in Google's index yet`, href: '/admin/search', action: 'See which' });

    const stale = staleProjects(projects, edited || {}, now);
    if (stale.length) items.push({ level: 'info', text: `${plural(stale.length, 'project')} not edited in six months or more (oldest: ${stale[0].title}, ${stale[0].months} months)`, href: '/admin/performance', action: 'See them' });

    const next = (schedule?.items || [])[0];
    if (next) items.push({ level: 'info', text: `${projects.find(p => p.id === next.id)?.title || next.id} will be ${next.action === 'publish' ? 'published' : 'unpublished'} ${new Date(next.at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`, href: '/admin/settings', action: 'Change' });
    if ((schedule?.log || []).some(l => !l.ok && Date.parse(l.at) > now - 7 * 86400000)) items.push({ level: 'error', text: 'A scheduled publish or unpublish failed', href: '/admin/settings', action: 'See why' });

    const p = overview?.projects;
    if (p && p.total - p.withWriteup > 0) items.push({ level: 'info', text: `${plural(p.total - p.withWriteup, 'project')} ${p.total - p.withWriteup === 1 ? 'has' : 'have'} no write-up`, href: '/admin/projects', action: 'Open projects' });

    const cur = analytics?.totals?.current?.views, prev = analytics?.totals?.previous?.views;
    if (prev >= 20 && cur !== undefined && cur < prev * 0.6) items.push({ level: 'info', text: `Page views are down ${Math.round((1 - cur / prev) * 100)}% on the previous period`, href: '/admin/analytics', action: 'Look at analytics' });

    return items.sort((a, b) => RANK[a.level] - RANK[b.level]).slice(0, 8);
}

export function todayHtml(items) {
    const body = items.length
        ? `<ul class="rows today">${items.map(i => `<li><span class="label wrap"><span class="sev sev-${i.level === 'info' ? 'info' : i.level}">${i.level === 'error' ? 'Error' : i.level === 'warning' ? 'Warning' : 'Idea'}</span> ${esc(i.text)}</span><a class="value" href="${esc(i.href)}">${esc(i.action)}</a></li>`).join('')}</ul>`
        : '<p class="empty-note">Nothing needs attention. Good time to write something new.</p>';
    return `<section class="panel dash-today"><header><h2>Worth doing</h2><span class="meta">worked out from your own data</span></header>${body}</section>`;
}

export function digestHtml(lines) {
    if (!lines.length) return '';
    return `<section class="panel dash-today"><header><h2>This week</h2><span class="meta">from analytics, Google and the repo</span></header><ul class="rows">${lines.map(l => `<li><span class="label wrap">${l}</span></li>`).join('')}</ul></section>`;
}
