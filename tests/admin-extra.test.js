import { describe, it, expect, vi } from 'vitest';
import { applySchedule, handleEvents, handleFreshness, handleSchedule, recordEvent, runDueSchedules } from '../admin-extra.js';
import { handleAdminApi } from '../admin-api.js';
import { digestLines, projectInsights, staleProjects } from '../public/assets/js/admin/insights.js';

const SOURCE = `export const myProjects = [
    {
        id: "a",
        title: "A",
        hasExtendedContent: true,
    },
    {
        id: "b",
        title: "B",
        hasExtendedContent: true,
    }
];
`;
const b64 = t => btoa(t);
const kvStore = (init = {}) => {
    const m = new Map(Object.entries(init).map(([k, v]) => [k, JSON.stringify(v)]));
    return { get: async (k, type) => (m.has(k) ? (type === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null), put: async (k, v) => { m.set(k, v); }, _m: m };
};
const github = (source = SOURCE) => {
    const puts = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
        if ((init.method || 'GET') === 'PUT') { puts.push(JSON.parse(init.body)); return new Response('{}'); }
        return new Response(JSON.stringify({ content: b64(source), sha: 'sha1' }));
    });
    return { fetchImpl, puts };
};
const env = extra => ({ GITHUB_REPO: 'o/r', GITHUB_PAT: 't', ...extra });

describe('scheduled publishing', () => {
    it('unpublishes on main with an admin: commit', async () => {
        const { fetchImpl, puts } = github();
        const r = await applySchedule(env(), { id: 'a', action: 'unpublish', by: 'me@x.com' }, fetchImpl);
        expect(r.changed).toBe(true);
        expect(puts[0].branch).toBe('main');
        expect(puts[0].message).toMatch(/^admin: scheduled unpublish of a/);
        expect(puts[0].message).toContain('Edited-by: me@x.com');
        expect(atob(puts[0].content)).toContain('unpublished: true');
    });
    it('does nothing when the project is already in that state', async () => {
        const { fetchImpl, puts } = github(SOURCE.replace('id: "a",', 'id: "a",\n        unpublished: true,'));
        expect((await applySchedule(env(), { id: 'a', action: 'unpublish' }, fetchImpl)).changed).toBe(false);
        expect(puts).toHaveLength(0);
    });
    it('runs only due items, logs them, and keeps the rest', async () => {
        const { fetchImpl, puts } = github();
        const kv = kvStore({ 'schedule:v1': { items: [{ id: 'a', action: 'unpublish', at: '2026-01-01T00:00:00Z' }, { id: 'b', action: 'unpublish', at: '2099-01-01T00:00:00Z' }], log: [] } });
        const out = await runDueSchedules(env({ ADMIN_KV: kv }), fetchImpl, Date.parse('2026-06-01'));
        expect(out.ran).toBe(1);
        expect(puts).toHaveLength(1);
        const saved = JSON.parse(kv._m.get('schedule:v1'));
        expect(saved.items.map(i => i.id)).toEqual(['b']);
        expect(saved.log[0]).toMatchObject({ id: 'a', ok: true });
    });
    it('logs a failure instead of retrying forever', async () => {
        const fetchImpl = vi.fn(async () => new Response('no', { status: 500 }));
        const kv = kvStore({ 'schedule:v1': { items: [{ id: 'a', action: 'publish', at: '2026-01-01T00:00:00Z' }], log: [] } });
        await runDueSchedules(env({ ADMIN_KV: kv }), fetchImpl, Date.parse('2026-06-01'));
        const saved = JSON.parse(kv._m.get('schedule:v1'));
        expect(saved.items).toEqual([]);
        expect(saved.log[0]).toMatchObject({ ok: false });
    });
    it('validates what the API accepts', async () => {
        const projects = [{ id: 'a' }];
        const call = (method, body, qs = '') => handleSchedule(new Request(`https://x.test/api/admin/schedule${qs}`, { method, body: body && JSON.stringify(body) }), { ADMIN_KV: kvStore() }, new URL(`https://x.test/api/admin/schedule${qs}`), fetch, { projects });
        const soon = new Date(Date.now() + 3600_000).toISOString();
        expect((await call('POST', { project: 'zzz', action: 'publish', at: soon })).status).toBe(404);
        expect((await call('POST', { project: 'a', action: 'delete', at: soon })).status).toBe(400);
        expect((await call('POST', { project: 'a', action: 'publish', at: '2001-01-01' })).status).toBe(400);
        const ok = await (await call('POST', { project: 'a', action: 'publish', at: soon })).json();
        expect(ok.items).toHaveLength(1);
    });
});

describe('events', () => {
    const projects = [{ id: 'a' }];
    const post = (body, headers = {}) => new Request('https://ryanmarch.me/api/e', { method: 'POST', headers: { 'user-agent': 'Mozilla/5.0', ...headers }, body: JSON.stringify(body) });
    it('counts a play and an outbound click per project, and sums them back', async () => {
        const kv = kvStore();
        const e = { ADMIN_KV: kv };
        await recordEvent(post({ t: 'play', p: 'a' }), e, projects);
        await recordEvent(post({ t: 'play', p: 'a' }), e, projects);
        await recordEvent(post({ t: 'out', p: 'a' }), e, projects);
        const out = await (await handleEvents(new Request('https://x.test'), e, new URL('https://x.test/api/admin/events?days=7'))).json();
        expect(out.play.a).toBe(2);
        expect(out.out.a).toBe(1);
    });
    it('ignores bots, unknown projects, odd types and other origins', async () => {
        const e = { ADMIN_KV: kvStore() };
        expect((await recordEvent(post({ t: 'play', p: 'zzz' }), e, projects)).status).toBe(400);
        expect((await recordEvent(post({ t: 'hack', p: 'a' }), e, projects)).status).toBe(400);
        expect((await recordEvent(post({ t: 'play', p: 'a' }, { origin: 'https://evil.test' }), e, projects)).status).toBe(403);
        expect((await recordEvent(post({ t: 'play', p: 'a' }, { 'user-agent': 'Googlebot' }), e, projects)).status).toBe(204);
        expect(e.ADMIN_KV._m.size).toBe(0);
    });
});

describe('freshness', () => {
    it('maps each project to its newest commit date', async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { repository: { ref: { target: { p0: { nodes: [{ committedDate: '2026-01-02T00:00:00Z' }] }, p1: { nodes: [] } } } } } })));
        const res = await handleFreshness(new Request('https://x.test'), env(), new URL('https://x.test/api/admin/freshness'), fetchImpl, { projects: [{ id: 'a' }, { id: 'b' }, { id: 'bad id!' }] });
        const body = await res.json();
        expect(body.edited).toEqual({ a: '2026-01-02T00:00:00Z' });
        expect(JSON.parse(fetchImpl.mock.calls[0][1].body).query).not.toContain('bad id');
    });
    it('routes need a sign-in', async () => {
        const url = new URL('https://ryanmarch.me/api/admin/freshness');
        expect((await handleAdminApi(new Request(url), {}, url, url.pathname, {})).status).toBe(401);
    });
});

describe('insights', () => {
    const now = Date.parse('2026-11-01');
    const projects = [{ id: 'a', title: 'A', hasExtendedContent: true }, { id: 'b', title: 'B', hasExtendedContent: true }, { id: 'c', title: 'C', hasExtendedContent: false }];
    it('joins views, search, plays and index status, with notes', () => {
        const rows = projectInsights({
            projects, now,
            paths: [{ label: '/project/a/', count: 50 }],
            pages: [{ page: '/project/b/', clicks: 0, impressions: 40, position: 9 }],
            edited: { a: '2025-01-01T00:00:00Z' }, events: { play: { a: 3 }, out: { a: 1 } }, index: { b: { state: 'not-indexed' } }
        });
        expect(rows.map(r => r.id)).toEqual(['a', 'b']);
        expect(rows[0]).toMatchObject({ views: 50, plays: 3, outs: 1 });
        expect(rows[0].notes[0].text).toMatch(/Not edited in 22 months/);
        expect(rows[1].notes[0].text).toMatch(/Not in Google/);
    });
    it('finds stale projects, oldest first', () => {
        expect(staleProjects(projects, { a: '2025-06-01T00:00:00Z', b: '2024-01-01T00:00:00Z' }, now).map(p => p.id)).toEqual(['b', 'a']);
    });
    it('writes a digest from what exists and skips what does not', () => {
        const lines = digestLines({ analytics: { totals: { current: { views: 120 }, previous: { views: 100 } }, paths: [{ label: '/project/a/', count: 40 }] }, projects, search: { daily: [{ clicks: 2, impressions: 10 }] } });
        expect(lines[0]).toContain('up 20%');
        expect(lines.join(' ')).toContain('Most read project: A');
        expect(lines.join(' ')).toContain('2 clicks from Google');
        expect(digestLines({})).toEqual([]);
    });
});
