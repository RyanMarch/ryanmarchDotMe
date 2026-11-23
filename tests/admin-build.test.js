import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bundleAdmin, patchAdminHtml, patchHeaders } from '../scripts/build.js';

const repo = path.resolve(import.meta.dirname, '..');
let tmp;
let manifest;
const hashes = { 'assets/js/project-data.js': 'data111', 'assets/js/admin-project-parser.js': 'parse222' };
const dist = () => path.join(tmp, 'assets/js/admin/dist');
const read = url => fs.readFileSync(path.join(tmp, url), 'utf8');
const allDistFiles = () => fs.readdirSync(dist(), { recursive: true }).filter(f => f.endsWith('.js')).map(f => path.join('/assets/js/admin/dist', f));

describe('admin bundle', () => {
    beforeAll(async () => {
        // Build a copy, so the real source tree is never touched.
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-build-'));
        fs.cpSync(path.join(repo, 'public/assets/js/admin'), path.join(tmp, 'assets/js/admin'), { recursive: true });
        manifest = await bundleAdmin({ siteDir: tmp, hashes });
    }, 60000);
    afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('produces hashed entry files and a hashed editor script', () => {
        expect(manifest.main).toMatch(/^\/assets\/js\/admin\/dist\/main-[A-Z0-9]+\.js$/);
        expect(manifest.core).toMatch(/^\/assets\/js\/admin\/dist\/core-[A-Z0-9]+\.js$/);
        expect(manifest.editor).toMatch(/^\/assets\/js\/admin\/dist\/editor-[0-9a-f]{10}\.js$/);
        for (const url of [manifest.main, manifest.core, manifest.editor]) expect(fs.existsSync(path.join(tmp, url))).toBe(true);
    });

    it('splits each page into its own lazily-loaded chunk', () => {
        const chunks = allDistFiles().filter(f => f.includes('/chunks/'));
        expect(chunks.length).toBeGreaterThanOrEqual(8);
        const main = read(manifest.main);
        // The shell loads pages with dynamic import(), not by inlining them.
        expect((main.match(/import\(/g) || []).length).toBeGreaterThanOrEqual(8);
    });

    it("keeps the site's shared files external and adds their content hash at bundle time", () => {
        const text = allDistFiles().map(read).join('\n');
        expect(text).toContain('/assets/js/project-data.js?v=data111');
        expect(text).toContain('/assets/js/admin-project-parser.js?v=parse222');
        expect(text).not.toMatch(/\/assets\/js\/project-data\.js["']/); // never without its hash
    });

    it('points the lazy editor loader at the hashed editor file', () => {
        const text = allDistFiles().map(read).join('\n');
        expect(text).toContain(manifest.editor);
        expect(text).not.toContain('/assets/js/admin/editor.js');
    });

    it('minifies the editor without renaming the globals its inline handlers call', () => {
        const editor = read(manifest.editor);
        for (const name of ['loadFile', 'saveFile', 'toggleNewProjectForm', 'uploadImage', 'createNewProject']) expect(editor).toContain(`function ${name}(`);
        expect(editor.length).toBeLessThan(fs.statSync(path.join(repo, 'public/assets/js/admin/editor.js')).size * 0.75);
    });

    it('preloads the shared chunks both entry files import', () => {
        expect(manifest.preload.length).toBeGreaterThan(0);
        for (const url of manifest.preload) expect(fs.existsSync(path.join(tmp, url))).toBe(true);
    });

    it('is deterministic: the same input gives the same file names', async () => {
        const again = await bundleAdmin({ siteDir: tmp, hashes });
        expect(again.main).toBe(manifest.main);
        expect(again.editor).toBe(manifest.editor);
    });

    it('changes the bundle name when a shared file hash changes, so a stale copy is never reused', async () => {
        const next = await bundleAdmin({ siteDir: tmp, hashes: { ...hashes, 'assets/js/project-data.js': 'data999' } });
        expect(next.core).not.toBe(manifest.core);
    });
});

describe('patchAdminHtml / patchHeaders', () => {
    const html = fs.readFileSync(path.join(repo, 'public/admin.html'), 'utf8');
    const m = { main: '/assets/js/admin/dist/main-AAA.js', core: '/assets/js/admin/dist/core-BBB.js', preload: ['/assets/js/admin/dist/chunks/chunk-CCC.js'] };

    it('swaps in the bundled scripts and adds modulepreload links', () => {
        const out = patchAdminHtml(html, m);
        expect(out).toContain('<script type="module" src="/assets/js/admin/dist/core-BBB.js"></script>');
        expect(out).toContain('<script type="module" src="/assets/js/admin/dist/main-AAA.js"></script>');
        expect(out).toContain('<link rel="modulepreload" href="/assets/js/admin/dist/chunks/chunk-CCC.js">');
        expect(out).not.toContain('/assets/js/admin/core.js');
        expect(out.indexOf('modulepreload')).toBeLessThan(out.indexOf('core-BBB'));
    });
    it('fails loudly if admin.html changes shape', () => {
        expect(() => patchAdminHtml('<html></html>', m)).toThrow(/script tag/);
    });
    it('makes the admin stylesheet immutable only at build time', () => {
        const headers = fs.readFileSync(path.join(repo, 'public/_headers'), 'utf8');
        expect(headers).toMatch(/\/assets\/css\/admin\.css\s+Cache-Control: no-cache/);
        expect(patchHeaders(headers)).toMatch(/\/assets\/css\/admin\.css\s+Cache-Control: public, max-age=31536000, immutable/);
        expect(() => patchHeaders('nothing here')).toThrow();
    });
    it('serves the built folder immutable (and runs after the admin no-cache rule)', () => {
        const headers = fs.readFileSync(path.join(repo, 'public/_headers'), 'utf8');
        expect(headers).toMatch(/\/assets\/js\/admin\/dist\/\*\s+! Cache-Control\s+Cache-Control: public, max-age=31536000, immutable/);
        expect(headers.indexOf('/assets/js/admin/dist/*')).toBeGreaterThan(headers.indexOf('/assets/js/admin/*'));
    });
});
