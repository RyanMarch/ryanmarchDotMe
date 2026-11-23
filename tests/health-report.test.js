import { describe, it, expect } from 'vitest';
import { buildReport, reportFilename } from '../public/assets/js/admin/health-report.js';

const now = new Date('2026-11-23T12:00:00Z');
const projects = [{ id: 'ledger', title: 'Ledger' }, { id: 'spindex', title: 'Spindex' }];
const findings = [
    { severity: 'warning', check: 'seo-title', id: 'ledger', message: 'SEO title is 68 characters; search results cut off around 60.' },
    { severity: 'error', check: 'card-image', id: 'spindex', message: 'No card image set.' },
    { severity: 'info', check: 'thin-content', id: 'ledger', message: 'Write-up is only 90 words.' },
    { severity: 'error', check: 'redirect-target', id: '/old', message: 'Destination project "gone" does not exist.' },
    { severity: 'warning', check: 'img-alt', id: 'ledger', message: 'Image has no alt attribute: a.png' }
];

describe('buildReport', () => {
    const md = buildReport({ findings, projects, mode: 'full', now });

    it('opens with the date, source and counts', () => {
        expect(md).toContain('# Content health report: ryanmarch.me');
        expect(md).toContain('Generated 2026-11-23 from the admin\'s full audit.');
        expect(md).toContain('**2 errors, 2 warnings, 1 note.**');
        expect(md).not.toContain('quick check:');
    });
    it('tells the agent where things live and what not to do', () => {
        expect(md).toContain('`public/assets/js/project-data.js`');
        expect(md).toContain('`public/content/<id>/index.html`');
        expect(md).toContain('never edit it by hand');
        expect(md).toContain('npm test');
    });
    it('groups findings by project with titles and ids, errors first', () => {
        const spindex = md.indexOf('### Spindex (`spindex`)');
        const ledger = md.indexOf('### Ledger (`ledger`)');
        expect(spindex).toBeGreaterThan(-1);
        expect(spindex).toBeLessThan(ledger); // spindex has the error
        const ledgerBlock = md.slice(ledger, md.indexOf('## Site-wide'));
        expect(ledgerBlock.indexOf('**WARNING** `seo-title`')).toBeLessThan(ledgerBlock.indexOf('**NOTE** `thin-content`'));
    });
    it('puts non-project findings (redirects, sitemap) in their own section', () => {
        const site = md.slice(md.indexOf('## Site-wide'));
        expect(site).toContain('`redirect-target`');
        expect(md.slice(0, md.indexOf('## Site-wide'))).not.toContain('redirect-target');
    });
    it('gives a concrete fix with the real file path for each finding', () => {
        expect(md).toContain('Fix: Set `seoTitle`');
        expect(md).toContain('20-60 characters');
        expect(md).toContain('`public/content/ledger/index.html`, give the image an `alt`');
    });
    it('flags a quick check as incomplete', () => {
        expect(buildReport({ findings, projects, mode: 'quick', now })).toContain('This was the quick check');
    });
    it('honours the Errors filter', () => {
        const only = buildReport({ findings, projects, mode: 'full', filter: 'error', now });
        expect(only).toContain('(showing errors only)');
        expect(only).toContain('**2 errors, 0 warnings, 0 notes.**');
        expect(only).not.toContain('seo-title');
    });
    it('says so when there is nothing to fix', () => {
        expect(buildReport({ findings: [], projects, mode: 'full', now })).toContain('Nothing to fix.');
    });
});

describe('reportFilename', () => {
    it('is dated', () => expect(reportFilename(now)).toBe('content-health-2026-11-23.md'));
});
