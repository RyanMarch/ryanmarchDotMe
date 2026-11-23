import { describe, it, expect, vi } from 'vitest';
import { completeness, highest, journalMonths, milestones, plainMessage, nextUp, streak, topicIdeas, weekKey } from '../public/assets/js/admin/progress-data.js';
import { handleIdeas, handleImpact, handleJournal } from '../admin-extra.js';
import { impactHtml } from '../public/assets/js/admin/search.js';
import { nextUpHtml, todayHtml } from '../public/assets/js/admin/today.js';

const c = (date, message = 'Update a write-up') => ({ date, message, author: 'R' });
const kvStore = () => { const m = new Map(); return { get: async (k, t) => (m.has(k) ? (t === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, _m: m }; };

describe('streak and journal', () => {
    const now = Date.parse('2026-11-25T12:00:00Z'); // a Wednesday
    it('weeks start on Monday', () => expect(weekKey(now)).toBe('2026-11-23'));
    it('counts consecutive weeks, ignoring merges and test cleanups', () => {
        const s = streak([c('2026-11-24T10:00:00Z'), c('2026-11-17T10:00:00Z'), c('2026-11-10T10:00:00Z', 'Merge pull request #1'), c('2026-11-03T10:00:00Z')], now);
        expect(s).toMatchObject({ current: 2, activeThisWeek: true });
        expect(s.best).toBe(2);
    });
    it('a quiet current week does not break the streak yet', () => {
        expect(streak([c('2026-11-17T10:00:00Z'), c('2026-11-10T10:00:00Z')], now)).toMatchObject({ current: 2, activeThisWeek: false });
        expect(streak([c('2026-11-03T10:00:00Z')], now).current).toBe(0);
    });
    it('groups the journal by month, newest first', () => {
        const months = journalMonths([c('2026-11-02T00:00:00Z', 'admin: save Ledger'), c('2026-10-02T00:00:00Z'), c('2026-11-03T00:00:00Z', 'Merge branch x')]);
        expect(months.map(m => m.key)).toEqual(['2026-11', '2026-10']);
        expect(months[0]).toMatchObject({ count: 1, entries: [{ date: '2026-11-02T00:00:00Z', text: 'Save Ledger' }], label: 'November 2026' });
    });
});

describe('plain journal messages', () => {
    const t = id => ({ ledger: 'Ledger' })[id] || id;
    it('turns admin commits into plain words', () => {
        expect(plainMessage('admin: update content/ledger/index.html', t)).toBe('Edited the Ledger write-up');
        expect(plainMessage('admin: upload content/ledger/images/a.png', t)).toBe('Added an image to Ledger');
        expect(plainMessage('admin: unpublish ledger', t)).toBe('Unpublished Ledger');
        expect(plainMessage('update ledger writeup', t)).toBe('Update ledger writeup');
    });
});

describe('completeness, topics, milestones, next up', () => {
    const projects = [
        { id: 'a', title: 'A', image: 'x.png', hasExtendedContent: true, ogImage: 'o.jpg', seoTitle: 't', seoDescription: 'd' },
        { id: 'b', title: 'B', image: 'x.png', hasExtendedContent: true },
        { id: 'c', title: 'C', symbol: 'hub', hasExtendedContent: false },
        { id: 'd', title: 'D', hasExtendedContent: true, unpublished: true }
    ];
    it('lists what is missing, worst first, and a percentage', () => {
        const r = completeness(projects);
        expect(r.rows[0]).toMatchObject({ id: 'b', missing: ['Share image', 'Search title', 'Search description'] });
        expect(r.rows.find(x => x.id === 'c').missing).toEqual(['Write-up']);
        expect(r.rows.find(x => x.id === 'd')).toBeUndefined();
        expect(r.percent).toBeGreaterThan(0);
    });
    it('finds searches that landed outside project pages', () => {
        const t = topicIdeas([{ query: 'rent plugin', page: '/', impressions: 5, clicks: 0 }, { query: 'rent plugin', page: '/about', impressions: 3, clicks: 1 }, { query: 'ledger', page: '/project/a/', impressions: 50, clicks: 5 }, { query: 'rare', page: '/', impressions: 1, clicks: 0 }]);
        expect(t).toEqual([{ query: 'rent plugin', impressions: 8, clicks: 1, page: '/' }]);
    });
    it('milestones keep only the highest of each kind', () => {
        const all = milestones({ search: { totals: { current: { clicks: 120, impressions: 1500 } } }, streakWeeks: 5 });
        const best = highest(all).map(m => m.key).sort();
        expect(best).toEqual(['clicks-100', 'impressions-1000', 'streak-4']);
    });
    it('next up offers small tasks and rotates through them', () => {
        const tasks = nextUp({
            projects, now: Date.parse('2026-11-01'),
            search: { nearMisses: [{ page: '/project/a/', query: 'q', impressions: 40, clicks: 0, position: 9 }] },
            index: { a: { state: 'not-indexed' } }, edited: { a: '2024-01-01T00:00:00Z' }, ideas: [{ id: 'i', text: 'redo TripDeck', done: false }, { id: 'j', text: 'done one', done: true }]
        });
        expect(tasks[0].key).toMatch(/^near-a/);
        expect(tasks.some(t => t.key === 'desc-b')).toBe(true);
        expect(tasks.some(t => t.key === 'idea-i')).toBe(true);
        expect(tasks.some(t => t.key === 'idea-j')).toBe(false);
        expect(nextUpHtml(tasks, tasks.length)).toContain(tasks[0].title.replace(/"/g, '&quot;'));
        expect(nextUpHtml([])).toBe('');
    });
    it('the empty Worth doing list names the best project', () => expect(todayHtml([], { best: 'Ledger' })).toContain('Ledger was your most-read project'));
});

describe('ideas inbox API', () => {
    const call = (env, method, body, qs = '') => handleIdeas(new Request('https://x.test/api/admin/ideas', { method, body: body && JSON.stringify(body) }), env, new URL(`https://x.test/api/admin/ideas${qs}`));
    it('adds, marks done, and removes', async () => {
        const env = { ADMIN_KV: kvStore() };
        let out = await (await call(env, 'POST', { text: '  write up WXCU  ' })).json();
        expect(out.ideas[0].text).toBe('write up WXCU');
        const id = out.ideas[0].id;
        out = await (await call(env, 'POST', { id, done: true })).json();
        expect(out.ideas[0].done).toBe(true);
        out = await (await call(env, 'DELETE', null, `?id=${id}`)).json();
        expect(out.ideas).toEqual([]);
    });
    it('rejects empty text and works without KV', async () => {
        expect((await call({ ADMIN_KV: kvStore() }, 'POST', { text: '   ' })).status).toBe(400);
        expect((await (await call({}, 'GET')).json()).available).toBe(false);
    });
});

describe('journal and impact APIs', () => {
    it('journal maps commits', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ commit: { author: { date: '2026-11-01T00:00:00Z', name: 'R' }, message: 'First line\n\nbody' } }])));
        const out = await (await handleJournal(new Request('https://x.test'), { GITHUB_REPO: 'o/r', GITHUB_PAT: 't' }, new URL('https://x.test'), fetchImpl)).json();
        expect(out.commits).toEqual([{ date: '2026-11-01T00:00:00Z', message: 'First line', author: 'R' }]);
    });
    it('impact is not ready too soon after an edit', async () => {
        const recent = new Date(Date.now() - 3 * 86400000).toISOString();
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ commit: { author: { date: recent } } }])));
        const env = { GITHUB_REPO: 'o/r', GITHUB_PAT: 't', GSC_SERVICE_ACCOUNT: '{"client_email":"a@b","private_key":"k"}' };
        const out = await (await handleImpact(new Request('https://x.test'), env, new URL('https://x.test/?project=a'), fetchImpl, { projects: [{ id: 'a' }] })).json();
        expect(out.ready).toBe(false);
        expect((await handleImpact(new Request('https://x.test'), env, new URL('https://x.test/?project=zzz'), fetchImpl, { projects: [{ id: 'a' }] })).status).toBe(404);
    });
    it('impact table says better or worse', () => {
        const html = impactHtml({ ready: true, days: 28, edited: '2026-09-01T00:00:00Z', before: { clicks: 2, impressions: 100, position: 12 }, after: { clicks: 9, impressions: 100, position: 8 } });
        expect(html).toContain('better');
        expect(impactHtml({ ready: false, reason: 'Too soon' })).toContain('Too soon');
    });
});
