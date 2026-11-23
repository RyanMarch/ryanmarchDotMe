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
