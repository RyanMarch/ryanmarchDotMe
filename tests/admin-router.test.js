import { describe, it, expect } from 'vitest';
import { fromHash, href, parse } from '../public/assets/js/admin/router.js';
import { dirFromSlug, folderSlug } from '../public/assets/js/admin/media-sets.js';

const at = (pathname, search = '') => parse({ pathname, search });

describe('parse', () => {
    it('reads the view, the rest of the path and the query', () => {
        expect(at('/admin/media/ledger', '?show=missing')).toMatchObject({ view: 'media', rest: ['ledger'] });
        expect(at('/admin/media/ledger', '?show=missing').query.get('show')).toBe('missing');
        expect(at('/admin/projects')).toMatchObject({ view: 'projects', rest: [] });
    });
    it('treats /admin and unknown paths as the dashboard', () => {
        expect(at('/admin').view).toBe('dashboard');
        expect(at('/admin/').view).toBe('dashboard');
        expect(at('/admin/nonsense/thing')).toMatchObject({ view: 'dashboard', rest: [] });
    });
    it('decodes path segments', () => expect(at('/admin/media/a%20b').rest).toEqual(['a b']));
});

describe('href', () => {
    it('builds clean paths, omitting empty and default query values', () => {
        expect(href('dashboard')).toBe('/admin');
        expect(href('media')).toBe('/admin/media');
        expect(href('media', ['ledger'], { show: 'missing', q: '' })).toBe('/admin/media/ledger?show=missing');
        expect(href('analytics', [], { days: '', tor: 'hide' })).toBe('/admin/analytics?tor=hide');
        expect(href('projects', [], { file: 'content/ledger/index.html' })).toBe('/admin/projects?file=content%2Fledger%2Findex.html');
    });
    it('round-trips through parse', () => {
        const url = new URL(href('media', ['forecast-weather', 'zipic'], { q: 'a b' }), 'https://x.test');
        const r = parse({ pathname: url.pathname, search: url.search });
        expect(r).toMatchObject({ view: 'media', rest: ['forecast-weather', 'zipic'] });
        expect(r.query.get('q')).toBe('a b');
    });
});

describe('fromHash (old #/links)', () => {
    it('maps hash routes to paths', () => {
        expect(fromHash('#/media')).toBe('/admin/media');
        expect(fromHash('#/dashboard')).toBe('/admin');
        expect(fromHash('#/media/ledger?show=large')).toBe('/admin/media/ledger?show=large');
    });
    it('ignores anything else', () => {
        expect(fromHash('')).toBeNull();
        expect(fromHash('#section')).toBeNull();
        expect(fromHash('#/nope')).toBeNull();
    });
});

describe('folder slugs', () => {
    const dirs = ['assets/img', 'content/ledger/images', 'content/forecast-weather/images/zipic'];
    it('turns folders into short URL segments and back', () => {
        expect(folderSlug('assets/img')).toEqual(['site-images']);
        expect(folderSlug('content/ledger/images')).toEqual(['ledger']);
        expect(folderSlug('content/forecast-weather/images/zipic')).toEqual(['forecast-weather', 'zipic']);
        for (const d of dirs) expect(dirFromSlug(folderSlug(d), dirs)).toBe(d);
    });
    it('returns nothing for a slug that matches no folder', () => {
        expect(dirFromSlug(['nope'], dirs)).toBe('');
        expect(dirFromSlug([], dirs)).toBe('');
    });
});
