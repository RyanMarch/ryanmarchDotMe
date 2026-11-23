import { describe, it, expect } from 'vitest';
import { buildFolders, folderTitle, groupSets, parseImage } from '../public/assets/js/admin/media-sets.js';

const f = (path, size = 1000) => ({ path, size });
const D = 'content/demo/images/';

describe('groupSets', () => {
    const sets = groupSets([
        f(`${D}card.png`, 1000), f(`${D}card.avif`, 200), f(`${D}card-360.avif`, 50), f(`${D}card-640.avif`, 90),
        f(`${D}lonely.png`), f(`${D}jpegonly.jpg`),
        f(`${D}resized.png`), f(`${D}resized-640.avif`),
        f(`${D}og.jpg`), f(`${D}theme-evolv-dark.avif`), f(`${D}theme-evolv-dark.png`),
        f(`${D}avifonly.avif`), f(`${D}icon.svg`)
    ]);
    const by = name => sets.find(s => s.name === name);

    it('pairs a PNG with its full-size AVIF and keeps the resized copies in the same set', () => {
        expect(by('card').status).toBe('paired');
        expect(by('card').files.map(x => x.base)).toEqual(['card.avif', 'card.png', 'card-360.avif', 'card-640.avif']);
        expect(by('card').savings).toBe(80);
    });
    it('flags a PNG or JPG that has no AVIF', () => {
        expect(by('lonely').status).toBe('missing-avif');
        expect(by('jpegonly').status).toBe('missing-avif');
    });
    it('tells apart "only resized AVIFs exist" from "no AVIF at all"', () => expect(by('resized').status).toBe('resized-only'));
    it('does not treat names like theme-evolv-dark as size variants', () => {
        expect(by('theme-evolv-dark').status).toBe('paired');
    });
    it('leaves share images, AVIF-only pictures and other formats alone', () => {
        expect(by('og').status).toBe('other');
        expect(by('avifonly').status).toBe('avif-only');
        expect(by('icon').status).toBe('other');
    });
    it('treats WebP as a fallback format too', () => {
        const s = groupSets([f('assets/img/a.webp', 500), f('assets/img/a.avif', 100), f('assets/img/b.webp', 500)]);
        expect(s.find(x => x.name === 'a').status).toBe('paired');
        expect(s.find(x => x.name === 'b').status).toBe('missing-avif');
    });
    it('uses the AVIF as the preview when there is one', () => {
        expect(by('card').preview).toBe(`${D}card.avif`);
        expect(by('lonely').preview).toBe(`${D}lonely.png`);
    });
});

describe('parseImage', () => {
    it('splits a name into set, variant and format', () => {
        expect(parseImage(f('a/b/card-640.avif'))).toMatchObject({ set: 'card', variant: '640', ext: 'avif', dir: 'a/b' });
        expect(parseImage(f('a/b/x-sm.png'))).toMatchObject({ set: 'x', variant: 'sm' });
        expect(parseImage(f('a/b/plain.PNG'))).toMatchObject({ set: 'plain', variant: null, ext: 'png' });
    });
});

describe('buildFolders / folderTitle', () => {
    const files = [f('assets/img/a.webp'), f('content/zed/images/p.png'), f('content/alpha/images/q.png'), f('content/alpha/images/q.avif')];
    const projects = [{ id: 'alpha', title: 'Alpha App' }];
    it('lists site images first, then projects A to Z, with counts and issues', () => {
        const folders = buildFolders(files, projects);
        expect(folders.map(x => x.title)).toEqual(['Site images', 'Alpha App', 'zed']);
        expect(folders.map(x => x.missingAvif)).toEqual([1, 0, 1]);
        expect(folders[1]).toMatchObject({ images: 2, dir: 'content/alpha/images' });
    });
    it('names folders sensibly', () => {
        expect(folderTitle('assets/img')).toBe('Site images');
        expect(folderTitle('content/x/images', [{ id: 'x', title: 'X' }])).toBe('X');
        expect(folderTitle('content/x/images/sub', [{ id: 'x', title: 'X' }])).toBe('X / sub');
        expect(folderTitle('content/y/other')).toBe('content/y/other');
    });
});
