import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { myProjects } from '../assets/js/project-data.js';
import { findLcpProject, syncLcpPreload } from '../scripts/lcp-preload.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Homepage LCP preload', () => {
    it('index.html preloads the image of the first grid card (run `npm run sync-lcp` to fix)', () => {
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        expect(syncLcpPreload(html, myProjects)).toBe(html);
    });

    it('skips archived projects when choosing the first card', () => {
        const projects = [
            { id: 'old', image: 'old.avif', tags: [{ label: 'Archive' }] },
            { id: 'new', image: 'new.avif', tags: [{ label: 'Project' }] }
        ];
        expect(findLcpProject(projects).id).toBe('new');
    });

    it('emits srcset/sizes only for projects with imageWidths', () => {
        const base = { id: 'p', image: 'content/p/images/hero.avif', imageWidth: 1000, imageHeight: 500, tags: [] };
        const plain = syncLcpPreload('<link id="lcp-preload" href="x">', [base]);
        expect(plain).toContain('href="/content/p/images/hero.avif"');
        expect(plain).not.toContain('imagesrcset');

        const responsive = syncLcpPreload('<link id="lcp-preload" href="x">', [{ ...base, imageWidths: [400, 1000] }]);
        expect(responsive).toContain('imagesrcset="/content/p/images/hero-400.avif 400w, /content/p/images/hero.avif 1000w"');
        expect(responsive).toContain('imagesizes="(max-width: 1050px) 360px, 640px"');
    });
});
