import { describe, it, expect, vi } from 'vitest';
import { buildSitemapXml, getGitLastMod } from '../dev/sitemap-generator.js';

describe('Sitemap XML Generation Tests', () => {
    const dummyProjects = [
        {
            id: 'project-with-details',
            title: 'Project With Details',
            hasExtendedContent: true
        },
        {
            id: 'project-without-details',
            title: 'Project Without Details',
            hasExtendedContent: false
        }
    ];

    it('should generate correctly formatted sitemap XML structure', () => {
        const today = '2026-06-15';
        const mockLastModGetter = vi.fn().mockReturnValue('2026-06-10');
        
        const xml = buildSitemapXml(dummyProjects, today, mockLastModGetter);

        // Verify standard sitemap header and schema definition
        expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
        expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

        // Verify root domain location, priority (1.0), and lastmod mapping
        expect(xml).toContain('<loc>https://ryanmarch.me/</loc>');
        expect(xml).toContain('<lastmod>2026-06-10</lastmod>');
        expect(xml).toContain('<priority>1.0</priority>');

        // Verify extended content project location, priority (0.8), and lastmod mapping
        expect(xml).toContain('<loc>https://ryanmarch.me/project/project-with-details/</loc>');
        expect(xml).toContain('<priority>0.8</priority>');

        // Verify project without extended content is excluded
        expect(xml).not.toContain('https://ryanmarch.me/project/project-without-details/');
        
        expect(mockLastModGetter).toHaveBeenCalledWith('index.html', today);
        expect(mockLastModGetter).toHaveBeenCalledWith('content/project-with-details/index.html', today);
        expect(mockLastModGetter).not.toHaveBeenCalledWith('content/project-without-details/index.html', today);
    });

    it('should fallback to the default today date in getGitLastMod when git command fails or is not available', () => {
        const fallback = '2026-06-15';
        // Test with a non-existent path to trigger the git execution error fallback
        const result = getGitLastMod('non-existent-file-path-xyz.html', fallback);
        expect(result).toBe(fallback);
    });
});
