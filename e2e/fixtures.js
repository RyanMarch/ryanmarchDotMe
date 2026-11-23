import fs from 'fs';
import path from 'path';

const b64 = text => Buffer.from(text, 'utf8').toString('base64');
const projectData = fs.readFileSync(path.join(import.meta.dirname, '../public/assets/js/project-data.js'), 'utf8');
export const PASSWORD = 'e2e-pass';

const day = n => new Date(Date.UTC(2026, 10, 23 - n)).toISOString().slice(0, 10);
const analytics = () => ({
    days: 30, host: 'ryanmarch.me', filters: { botsExcluded: true, torHidden: false }, botLoads: 0, torLoads: 0,
    totals: { current: { views: 120, visits: 100 }, previous: { views: 90, visits: 80 } },
    rows: Array.from({ length: 30 }, (_, i) => ({ date: day(i), views: (i % 5) * 4, visits: (i % 5) * 3 })),
    prevRows: [],
    paths: [{ label: '/', count: 60 }, { label: '/project/ledger/', count: 30 }],
    referrers: [{ label: 'Direct / none', count: 100 }], countries: [{ label: 'US', count: 100 }], devices: [{ label: 'desktop', count: 100 }],
    vitals: { samples: 10, lcp_ms: 900, cls: 0.01, inp_ms: 120, fcp_ms: 700, load_ms: 1500 }
});

const mediaFiles = [
    'content/ledger/images/card.avif', 'content/ledger/images/card.png', 'content/ledger/images/card-640.avif',
    'content/spindex/images/card.png', 'assets/img/logo.webp', 'assets/img/logo.avif'
].map(p => ({ path: p, size: 40000 }));

/**
 * Answers every /api/admin call. Returns { posts } — the bodies of any saves — so tests can assert on them.
 * Pass `overrides` to change a response: { notfound: { items: [...] } }.
 */
export async function mockAdminApi(page, overrides = {}) {
    const posts = [];
    const schedule = { items: [], log: [] };
    const ideas = { list: [] };
    await page.route('**/api/admin/**', async route => {
        const req = route.request();
        const url = new URL(req.url());
        const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        const name = url.pathname.replace('/api/admin/', '');
        if (overrides[name]) return reply(overrides[name]);

        if (name === 'file') {
            if (req.method() === 'POST') { posts.push(JSON.parse(req.postData())); return reply({ success: true, sha: `sha-${posts.length}`, commit: 'abc1234' }); }
            if (req.headers().authorization && req.headers().authorization !== `Bearer ${PASSWORD}`) return route.fulfill({ status: 401, body: 'Unauthorized' });
            const file = url.searchParams.get('path');
            if (file === 'assets/js/project-data.js') return reply({ content: b64(projectData), sha: 'pd-sha' });
            if (file === 'redirects.json') return reply({ content: b64('[]'), sha: 'rd-sha' });
            return reply({ content: b64('ok'), sha: 'x' });
        }
        if (name === 'analytics') return reply(analytics());
        if (name === 'overview') return reply({ projects: { total: 34, withWriteup: 33, linkOnly: 1, unpublished: 0 }, commits: [{ sha: 'abc1234', message: 'Update things', author: 'Ryan', date: new Date().toISOString(), url: 'https://example.com/c' }], pending: { ahead: 0 }, branch: 'main' });
        if (name === 'health') return reply({ findings: [], counts: { error: 0, warning: 0, info: 0 }, projects: 34 });
        if (name === 'media') return reply({ repo: { branch: 'main', files: mediaFiles, truncated: false }, r2: { available: true, trash: false, objects: [] } });
        if (name === 'activity') return reply({ branch: url.searchParams.get('branch') || 'main', commits: [{ sha: 'abc1234', message: 'Update things', author: 'Ryan', date: new Date().toISOString(), url: 'https://example.com/c', checks: [{ name: 'Tests', state: 'ok' }] }], checksAvailable: true, pending: { ahead: 0 }, deploys: null });
        if (name === 'notfound') return reply({ available: true, since: Date.now() - 86400000, items: [{ path: '/project/ledgr', count: 3, first: Date.now() - 1000, last: Date.now() - 1000, referrer: '' }] });
        if (name === 'ideas') {
            if (req.method() === 'POST') {
                const b = JSON.parse(req.postData());
                if (b.id) ideas.list = ideas.list.map(i => (i.id === b.id ? { ...i, done: b.done } : i));
                else ideas.list = [{ id: `i${ideas.list.length + 1}`, text: b.text, created: new Date().toISOString(), done: false }, ...ideas.list];
            }
            if (req.method() === 'DELETE') ideas.list = ideas.list.filter(i => i.id !== url.searchParams.get('id'));
            return reply({ available: true, ideas: ideas.list });
        }
        if (name === 'journal') return reply({ available: true, commits: [0, 1, 2, 8, 9].map(d => ({ date: new Date(Date.now() - d * 86400000).toISOString(), message: `admin: edit ${d}`, author: 'Ryan' })) });
        if (name === 'search/impact') return reply({ ready: true, days: 28, edited: '2026-09-01T00:00:00Z', before: { clicks: 2, impressions: 100, position: 12 }, after: { clicks: 9, impressions: 140, position: 8 } });
        if (name === 'freshness') return reply({ available: true, branch: 'main', edited: { ledger: '2024-01-01T00:00:00Z' } });
        if (name === 'events') return reply({ available: true, days: 30, since: '2026-11-01', play: { ledger: 4 }, out: { ledger: 2 } });
        if (name === 'schedule') {
            if (req.method() === 'POST') { const b = JSON.parse(req.postData()); schedule.items = [{ id: b.project, action: b.action, at: b.at, by: '', created: new Date().toISOString() }]; }
            if (req.method() === 'DELETE') schedule.items = [];
            return reply({ available: true, ...schedule });
        }
        if (name === 'search/sitemaps') return reply({ sitemaps: [{ path: 'https://ryanmarch.me/sitemap.xml', lastDownloaded: new Date().toISOString(), pending: false, errors: 0, warnings: 0, submitted: 30, indexed: 12 }] });
        if (name === 'search/index') return url.searchParams.get('project')
            ? reply({ id: 'ledger', result: { url: 'https://ryanmarch.me/project/ledger/', state: 'indexed', checked: Date.now(), coverage: 'Submitted and indexed', lastCrawl: new Date().toISOString(), googleCanonical: 'https://ryanmarch.me/project/ledger/', userCanonical: 'https://ryanmarch.me/project/ledger/' } })
            : reply({ results: {}, persistent: true });
        if (name === 'search') return reply({ configured: true, site: 'sc-domain:ryanmarch.me', days: 28, range: { start: '2026-11-01', end: '2026-11-21' },
            totals: { current: { clicks: 12, impressions: 480, ctr: 0.025, position: 11.2 }, previous: { clicks: 8, impressions: 400, ctr: 0.02, position: 12 } },
            daily: [{ date: '2026-11-20', clicks: 5, impressions: 200 }, { date: '2026-11-21', clicks: 7, impressions: 280 }],
            queries: [{ query: 'rentpress data hub', clicks: 4, impressions: 90, ctr: 0.044, position: 6.1 }], pages: [{ page: '/project/ledger/', clicks: 9, impressions: 300, ctr: 0.03, position: 9 }, { page: '/', clicks: 3, impressions: 100, ctr: 0.03, position: 4 }], pairs: [{ query: 'ledger app', page: '/project/ledger/', clicks: 2, impressions: 60, ctr: 0.03, position: 7 }],
            nearMisses: [{ query: 'wordpress rent plugin', page: '/project/ledger/', clicks: 1, impressions: 120, ctr: 0.008, position: 8.4 }] });
        if (name === 'build') return reply({ sha: 'abc1234', state: 'ok', checks: [{ name: 'Tests', state: 'ok' }, { name: 'Build', state: 'ok' }] });
        if (name === 'history') return reply({ commits: [{ sha: 'a'.repeat(40), short: 'aaaaaaa', message: 'Newest edit', author: 'Ryan', by: '', date: '2026-11-22T12:00:00Z', url: 'https://g/a' }, { sha: 'b'.repeat(40), short: 'bbbbbbb', message: 'Older edit', author: 'Ryan', by: 'me@example.com', date: '2026-11-21T12:00:00Z', url: 'https://g/b' }] });
        if (name === 'status') return reply({ items: [] });
        if (name === 'scan') return reply({ project: url.searchParams.get('project'), images: [], audio: [], videos: [] });
        return reply({});
    });

    // The editor's highlighter and code editor come from CDNs; give the page harmless stand-ins.
    await page.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, route => {
        const url = route.request().url();
        if (url.includes('codejar')) return route.fulfill({ contentType: 'text/javascript', body: 'export const CodeJar = () => ({ onUpdate() {}, updateCode() {}, toString() { return ""; }, destroy() {} });' });
        return route.fulfill({ contentType: 'text/javascript', body: 'window.Prism = window.Prism || { highlightElement() {} };' });
    });
    return { posts };
}

/** Signs in through the local password gate. */
export async function signIn(page, path = '/admin') {
    await page.goto(path);
    await page.fill('#passcode-input', PASSWORD);
    await page.click('#login-btn');
    await page.locator('#admin-view:not(.hidden)').waitFor();
}
