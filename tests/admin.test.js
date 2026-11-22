import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { myProjects } from '../public/assets/js/project-data.js';
import { parseProjectDataSource } from '../public/assets/js/admin-project-parser.js';
import { filesToMinify, rewriteAssetRefs, rewriteModuleImports } from '../scripts/build.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'public');

describe('Admin Project Parser & Mobile Admin Invariants', () => {
    it('parses public/assets/js/project-data.js identically to the live ES module export', () => {
        const source = fs.readFileSync(path.join(publicDir, 'assets/js/project-data.js'), 'utf8');
        const parsed = parseProjectDataSource(source);

        expect(parsed).toEqual(myProjects);
        expect(parsed.some(p => p.id === 'ledger' && p.hasExtendedContent)).toBe(true);
    });

    it('handles single quotes, escapes, comments, trailing commas, and primitives in parseProjectDataSource', () => {
        const sample = `
            /* leading block comment */
            export const myProjects = [
                {
                    id: 'sample-one',
                    "title": 'It\\'s "quoted" \\n line',
                    // commented out object: { id: "ignored" },
                    url: "https://example.com/a//b",
                    count: -42.5,
                    exponent: 1e3,
                    empty: null,
                    featured: true,
                    hasExtendedContent: false,
                    tags: [
                        // { label: "Disabled", color: "gray" },
                        { label: 'Active', color: 'gold', },
                    ],
                },
            ];
        `;

        const parsed = parseProjectDataSource(sample);
        expect(parsed).toEqual([
            {
                id: 'sample-one',
                title: 'It\'s "quoted" \n line',
                url: 'https://example.com/a//b',
                count: -42.5,
                exponent: 1000,
                empty: null,
                featured: true,
                hasExtendedContent: false,
                tags: [{ label: 'Active', color: 'gold' }]
            }
        ]);
    });

    it('throws descriptive errors for malformed project-data.js sources', () => {
        expect(() => parseProjectDataSource('')).toThrow();
        expect(() => parseProjectDataSource('export const other = [];')).toThrow();
        expect(() => parseProjectDataSource('export const myProjects = [{ id: "unterminated" ')).toThrow();
        expect(() => parseProjectDataSource('export const myProjects = [{ id: "bad\nline" }];')).toThrow();
    });

    it('versions shared assets imported by the admin modules (admin.html, projects-list.js, build.js)', () => {
        const adminHtml = fs.readFileSync(path.join(publicDir, 'admin.html'), 'utf8');
        const projectsList = fs.readFileSync(path.join(publicDir, 'assets/js/admin/projects-list.js'), 'utf8');

        expect(projectsList).toContain("from '/assets/js/project-data.js'");
        expect(projectsList).toContain("from '/assets/js/admin-project-parser.js'");
        expect(filesToMinify.some(f => f.path === 'assets/js/admin-project-parser.js')).toBe(true);

        let rewritten = adminHtml;
        rewritten = rewriteAssetRefs(rewritten, '/assets/css/style.css', 'csshash123');
        expect(rewritten).toContain('/assets/css/style.css?v=csshash123');

        const patched = rewriteModuleImports(projectsList, {
            'assets/js/project-data.js': 'datahash456',
            'assets/js/admin-project-parser.js': 'parserhash789'
        });
        expect(patched).toContain("from '/assets/js/project-data.js?v=datahash456'");
        expect(patched).toContain("from '/assets/js/admin-project-parser.js?v=parserhash789'");
        // Re-running replaces the previous hash instead of stacking query strings.
        expect(rewriteModuleImports(patched, { 'assets/js/project-data.js': 'new' }))
            .toContain("from '/assets/js/project-data.js?v=new'");
    });

    it('configures no-store caching for /admin and /admin.html and immutable caching for admin-project-parser.js', () => {
        const headers = fs.readFileSync(path.join(publicDir, '_headers'), 'utf8');

        expect(headers).toMatch(/\/admin\s+X-Robots-Tag:\s*noindex,\s*nofollow\s+Cache-Control:\s*no-store/);
        expect(headers).toMatch(/\/admin\.html\s+X-Robots-Tag:\s*noindex,\s*nofollow\s+Cache-Control:\s*no-store/);
        expect(headers).toMatch(/\/assets\/js\/admin-project-parser\.js\s+Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/);
    });

    it('keeps mobile safe-area padding, a drawer nav, and in-flow file and tag lists', () => {
        const adminHtml = fs.readFileSync(path.join(publicDir, 'admin.html'), 'utf8');
        const css = fs.readFileSync(path.join(publicDir, 'assets/css/admin.css'), 'utf8');
        const projectsList = fs.readFileSync(path.join(publicDir, 'assets/js/admin/projects-list.js'), 'utf8');

        expect(adminHtml).toContain('viewport-fit=cover');
        expect(adminHtml).toContain('id="menu-btn"');
        expect(adminHtml).toMatch(/id="menu-btn"[^>]*aria-expanded="false"/);
        expect(css).toMatch(/\.card\s*\{[^}]*overflow:\s*visible;/s);
        expect(css).toMatch(/@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*env\(safe-area-inset-top/);
        expect(css).toMatch(/@media\s*\(pointer:\s*coarse\)/);
        expect(adminHtml).toContain('id="file-search-results" class="file-search-results"');
        expect(adminHtml).toContain('id="new-project-tag-results" class="tag-search-results hidden"');
        expect(adminHtml).toContain('id="edit-project-tag-results" class="tag-search-results hidden"');
        expect(projectsList).toContain('syncProjectsForBranch');
        expect(projectsList).toContain('parseProjectDataSource');
    });

    it('loads the admin scripts in an order that lets the editor globals exist first', () => {
        const adminHtml = fs.readFileSync(path.join(publicDir, 'admin.html'), 'utf8');
        const editor = adminHtml.indexOf('/assets/js/admin/editor.js');
        const list = adminHtml.indexOf('/assets/js/admin/projects-list.js');
        const main = adminHtml.indexOf('/assets/js/admin/main.js');
        expect(editor).toBeGreaterThan(-1);
        expect(editor).toBeLessThan(list);
        expect(list).toBeLessThan(main);
    });
});
