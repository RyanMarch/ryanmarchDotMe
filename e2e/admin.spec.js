import { test, expect } from '@playwright/test';
import { mockAdminApi, PASSWORD, signIn } from './fixtures.js';

test.describe('sign-in', () => {
    test('rejects a wrong password, accepts the right one, and stays signed in after a refresh', async ({ page }) => {
        await mockAdminApi(page);
        await page.goto('/admin');
        await expect(page.locator('#auth-view')).toBeVisible();

        await page.fill('#passcode-input', 'not-it');
        await page.click('#login-btn');
        await expect(page.locator('#auth-alert')).toContainText('Invalid password');
        await expect(page.locator('#admin-view')).toBeHidden();

        await page.fill('#passcode-input', PASSWORD);
        await page.click('#login-btn');
        await expect(page.locator('#admin-view')).toBeVisible();

        await page.reload();
        await expect(page.locator('#admin-view')).toBeVisible();
        await expect(page.locator('#auth-view')).toBeHidden();
    });
});

test.describe('routing and history', () => {
    test.beforeEach(async ({ page }) => { await mockAdminApi(page); });

    test('sidebar links change the path (no #), the title and the active link', async ({ page }) => {
        await signIn(page);
        await page.click('[data-nav=analytics]');
        await expect(page).toHaveURL(/\/admin\/analytics$/);
        await expect(page.locator('#topbar-title')).toHaveText('Analytics');
        await expect(page.locator('[data-nav=analytics]')).toHaveAttribute('aria-current', 'page');
        expect(page.url()).not.toContain('#');
    });

    test('Back and Forward step through pages', async ({ page }) => {
        await signIn(page);
        await page.click('[data-nav=activity]');
        await page.click('[data-nav=media]');
        await expect(page).toHaveURL(/\/admin\/media$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/admin\/activity$/);
        await expect(page.locator('#topbar-title')).toHaveText('Activity');
        await page.goForward();
        await expect(page).toHaveURL(/\/admin\/media$/);
    });

    test('opening a Media folder is a history step, and Back returns to the folder list', async ({ page }) => {
        await signIn(page, '/admin/media');
        await expect(page.locator('#media-list .folder-btn')).toHaveCount(3);
        await page.locator('.folder-btn', { hasText: 'ledger' }).first().click();
        await expect(page).toHaveURL(/\/admin\/media\/ledger$/);
        await expect(page.locator('#media-crumbs')).toContainText('ledger');
        await page.goBack();
        await expect(page).toHaveURL(/\/admin\/media$/);
        await expect(page.locator('#media-list .folder-btn')).toHaveCount(3);
        await page.goForward();
        await expect(page.locator('#media-crumbs')).toContainText('ledger');
    });

    test('a deep link survives a refresh', async ({ page }) => {
        await signIn(page, '/admin/media/ledger');
        await expect(page.locator('#media-crumbs')).toContainText('ledger');
        await page.reload();
        await expect(page.locator('#media-crumbs')).toContainText('ledger');
        await expect(page.locator('#topbar-title')).toHaveText('Media');
    });

    test('the analytics range is in the URL and Back restores it', async ({ page }) => {
        await signIn(page, '/admin/analytics');
        await page.click('.seg button[data-days="7"]');
        await expect(page).toHaveURL(/\?days=7$/);
        await page.goBack();
        await expect(page).toHaveURL(/\/admin\/analytics$/);
        await expect(page.locator('.seg button[data-days="30"]')).toHaveAttribute('aria-pressed', 'true');
    });

    test('old #/ links and /admin.html redirect to the real path', async ({ page }) => {
        await signIn(page);
        await page.goto('/admin#/health');
        await expect(page).toHaveURL(/\/admin\/health$/);
        await page.goto('/admin.html?x=1');
        await expect(page).toHaveURL(/\/admin\?x=1$/);
    });

    test('the command palette jumps to a page', async ({ page }) => {
        await signIn(page);
        await page.keyboard.press('Control+k');
        await expect(page.locator('dialog.palette')).toBeVisible();
        await page.keyboard.type('media');
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/admin\/media$/);
    });
});

test.describe('loading', () => {
    test('the editor is not downloaded until Projects is opened', async ({ page }) => {
        await mockAdminApi(page);
        const requested = [];
        // Not editor-loader.js: that is the tiny loader, which is always present.
        page.on('request', r => { if (/\/editor(-[0-9a-f]{10})?\.js|projects-list|prism|codejar/i.test(r.url())) requested.push(r.url()); });
        await signIn(page, '/admin/analytics');
        await page.click('[data-nav=activity]');
        expect(requested).toEqual([]);
        await page.click('[data-nav=projects]');
        await expect.poll(() => requested.some(u => /\/editor(-[0-9a-f]{10})?\.js/.test(u))).toBe(true);
    });
});

test.describe('saving', () => {
    test('unpublishing asks first, commits the change, offers Undo, and Undo commits it back', async ({ page }) => {
        const { posts } = await mockAdminApi(page);
        await signIn(page, '/admin/settings');
        const row = page.locator('.orderlist li', { hasText: 'Spindex' });
        await row.locator('[data-act=toggle]').click();
        await page.click('#save-order');

        const dialog = page.locator('dialog.dlg');
        await expect(dialog).toContainText('Unpublish Spindex?');
        await dialog.getByRole('button', { name: 'Unpublish' }).click();

        await expect(page.locator('.toast')).toContainText('Unpublished Spindex');
        expect(posts).toHaveLength(1);
        const saved = Buffer.from(posts[0].content, 'base64').toString();
        expect(saved).toMatch(/id:\s*"spindex"[\s\S]{0,40}unpublished:\s*true/);
        expect(posts[0].message).toBe('admin: unpublish spindex');

        await page.locator('.toast-action', { hasText: 'Undo' }).click();
        await expect.poll(() => posts.length).toBe(2);
        expect(Buffer.from(posts[1].content, 'base64').toString()).not.toContain('unpublished: true');
        await expect(page.locator('dialog.dlg')).toHaveCount(0); // Undo does not ask again
    });

    test('Cancel on the unpublish dialog saves nothing', async ({ page }) => {
        const { posts } = await mockAdminApi(page);
        await signIn(page, '/admin/settings');
        await page.locator('.orderlist li', { hasText: 'Spindex' }).locator('[data-act=toggle]').click();
        await page.click('#save-order');
        await page.locator('dialog.dlg').getByRole('button', { name: 'Cancel' }).click();
        expect(posts).toHaveLength(0);
    });
});

test.describe('404s people hit', () => {
    test('Redirect opens the redirects tab with the address and a suggested destination filled in', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/seo?tab=404');
        await expect(page.locator('.nf-row')).toContainText('/project/ledgr');
        await page.locator('.nf-row a.btn', { hasText: 'Redirect' }).click();
        await expect(page.locator('[role=tab][aria-selected=true]')).toHaveText('Redirects');
        const rows = page.locator('.rrow');
        const last = rows.last();
        await expect(last.locator('[data-f=source]')).toHaveValue('/project/ledgr');
        await expect(last.locator('[data-f=destination]')).toHaveValue('/project/ledger/');
    });
});

test.describe('shell extras', () => {
    test.beforeEach(async ({ page }) => { await mockAdminApi(page); });

    test('g then a jumps to Analytics, and ? lists the shortcuts', async ({ page }) => {
        await signIn(page);
        await page.keyboard.press('g');
        await page.keyboard.press('a');
        await expect(page).toHaveURL(/\/admin\/analytics$/);
        await page.keyboard.press('?');
        await expect(page.locator('dialog.dlg')).toContainText('Keyboard shortcuts');
        await expect(page.locator('dialog.dlg')).toContainText('Analytics');
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog.dlg')).toHaveCount(0);
    });

    test('shortcuts stay out of the way while typing in a field', async ({ page }) => {
        await signIn(page, '/admin/media');
        await page.fill('#media-q', 'ga');
        await expect(page).not.toHaveURL(/analytics/);
    });

    test('the theme button cycles System, Light, Dark and remembers it', async ({ page }) => {
        await signIn(page);
        const html = page.locator('html');
        const label = page.locator('#theme-btn span');
        await expect(label).toHaveText('Theme: System');
        await page.click('#theme-btn');
        await expect(label).toHaveText('Theme: Light');
        await expect(html).toHaveAttribute('data-theme', 'light');
        await page.click('#theme-btn');
        await expect(html).toHaveAttribute('data-theme', 'dark');
        await page.reload();
        await expect(html).toHaveAttribute('data-theme', 'dark');
        await page.click('#theme-btn');
        await expect(html).not.toHaveAttribute('data-theme', /.+/);
    });

    test('the flag shows where saves go, and the skip link and route announcer exist', async ({ page }) => {
        await signIn(page);
        await expect(page.locator('#branch-flag')).toContainText('Saving to main');
        await expect(page.locator('#branch-flag')).toHaveClass(/is-prod/);
        await page.click('[data-nav=media]');
        await expect(page.locator('#route-announcer')).toHaveText('Media page');
        await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main');
    });
});

test.describe('file history', () => {
    test('History lists earlier versions and loads the one you pick, without saving anything', async ({ page }) => {
        const { posts } = await mockAdminApi(page);
        const fetched = [];
        page.on('request', r => { if (/api\/admin\/file\?/.test(r.url())) fetched.push(new URL(r.url())); });
        await signIn(page, '/admin/projects?file=content%2Fledger%2Findex.html');
        await expect(page.locator('#active-file-label')).toContainText('content/ledger/index.html');
        await page.click('#history-btn');
        const dialog = page.locator('dialog.dlg');
        await expect(dialog).toContainText('History of content/ledger/index.html');
        await expect(dialog.locator('.choose-row')).toHaveCount(2);
        await expect(dialog.locator('.choose-row').first()).toContainText('latest');
        await dialog.locator('.choose-row', { hasText: 'Older edit' }).click();
        await dialog.getByRole('button', { name: 'Load this version' }).click();
        // The stand-in editor always looks "changed", so the page asks before replacing it.
        await page.locator('dialog.dlg').getByRole('button', { name: 'Replace' }).click();
        await expect(page.locator('.toast')).toContainText('Loaded that version');
        expect(fetched.some(u => u.searchParams.get('branch') === 'b'.repeat(40))).toBe(true); // asked for that exact commit
        expect(posts).toHaveLength(0); // nothing was committed
    });
});

test.describe('search and suggestions', () => {
    test('Search shows Search Console numbers and easy wins', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/search');
        await expect(page.locator('#view-search h1')).toHaveText('Search');
        await expect(page.locator('#view-search .stat').first()).toContainText('12');
        await expect(page.locator('#view-search')).toContainText('wordpress rent plugin');
        await expect(page.locator('#view-search')).toContainText('2026-11-01 to 2026-11-21');
    });

    test('the dashboard lists what is worth doing', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page);
        const list = page.locator('.dash-today', { hasText: 'Worth doing' });
        await expect(list).toContainText('/project/ledgr was hit 3 times');
        await expect(list).toContainText('wordpress rent plugin');
        await expect(list).toContainText('1 project has no write-up');
    });
});

test.describe('search per project', () => {
    test('projects list their search numbers, check indexing, and open a detail view', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/search');
        const row = page.locator('#view-search tr:has([data-idx="ledger"])');
        await expect(row).toContainText('300');
        await page.click('#inspect-all');
        await expect(page.locator('[data-idx="ledger"]')).toContainText('Indexed');
        await row.getByRole('link').click();
        await expect(page).toHaveURL(/project=ledger/);
        await expect(page.locator('#view-search')).toContainText('ledger app');
        await expect(page.locator('#view-search')).toContainText('Submitted and indexed');
        await page.getByRole('link', { name: '← All projects' }).click();
        await expect(page).not.toHaveURL(/project=/);
    });
});

test.describe('performance, schedule, preview', () => {
    test('Performance lists each project with its numbers and notes', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/performance');
        const row = page.locator('#view-performance tr', { hasText: 'Ledger' }).first();
        await expect(row).toContainText('30');
        await expect(row).toContainText('Not edited in');
    });

    test('Search shows sitemap status', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/search');
        await expect(page.locator('#view-search')).toContainText('/sitemap.xml');
        await expect(page.locator('#view-search')).toContainText('12');
    });

    test('a change can be scheduled and cancelled from Settings', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/settings');
        await expect(page.locator('#sched-panel')).toContainText('Nothing scheduled');
        const when = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16);
        await page.locator('#sched-form select[name=project]').selectOption({ index: 0 });
        await page.locator('#sched-form input[name=at]').fill(when);
        await page.getByRole('button', { name: 'Schedule' }).click();
        await expect(page.locator('#sched-panel')).toContainText('Unpublish');
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.locator('#sched-panel')).toContainText('Nothing scheduled');
    });

    test('Preview shows the unsaved write-up in a sandboxed frame', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/projects?file=content%2Fledger%2Findex.html');
        await expect(page.locator('#active-file-label')).toContainText('content/ledger/index.html');
        await page.click('#preview-btn');
        const dlg = page.locator('dialog.dlg-preview');
        await expect(dlg).toContainText('Preview of content/ledger/index.html');
        await expect(dlg.locator('iframe')).toHaveAttribute('sandbox', '');
        await dlg.getByRole('button', { name: 'Phone' }).click();
        await expect(dlg.locator('iframe')).toHaveCSS('width', '390px');
    });

    test('the dashboard has a weekly summary', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page);
        await expect(page.locator('.dash-today', { hasText: 'This week' })).toContainText('page views');
    });
});

test.describe('progress and inspiration', () => {
    test('Progress shows the streak, takes ideas, and lists what is missing', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/progress');
        await expect(page.locator('#view-progress .stat').first()).toContainText('Weekly streak');
        await page.fill('#idea-form input[name=text]', 'redo TripDeck screenshots');
        await page.getByRole('button', { name: 'Add', exact: true }).click();
        await expect(page.locator('.rows.ideas')).toContainText('redo TripDeck screenshots');
        await page.getByRole('button', { name: 'Remove' }).click();
        await expect(page.locator('#view-progress')).toContainText('Empty. Anything you think of');
        await expect(page.locator('#view-progress')).toContainText('Journal');
    });

    test('the dashboard offers one small task, and Another shows a different one', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page);
        const card = page.locator('#next-up');
        await expect(card).toContainText('Sharpen');
        const first = await card.locator('.next-title').textContent();
        const another = page.getByRole('button', { name: 'Another idea' });
        if (await another.count()) {
            await another.click();
            await expect(page.locator('#next-up .next-title')).not.toHaveText(first);
        }
    });

    test('a project shows what changed since its last edit', async ({ page }) => {
        await mockAdminApi(page);
        await signIn(page, '/admin/search?project=ledger');
        await expect(page.locator('#impact-host')).toContainText('better');
    });
});
