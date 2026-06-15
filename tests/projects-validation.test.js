import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { myProjects } from '../assets/js/project-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../');

describe('Project Case Studies Validation', () => {
    it('should validate every project in project-data.js has consistent properties and assets', () => {
        myProjects.forEach(project => {
            const { id, title, hasExtendedContent, image, symbol } = project;

            const contentDir = path.join(projectRoot, 'content', id);
            const indexHtmlPath = path.join(contentDir, 'index.html');

            if (hasExtendedContent) {
                // Verify folder and index.html exist
                expect(fs.existsSync(contentDir), `Directory for project "${title}" (${id}) should exist at "/content/${id}"`).toBe(true);
                expect(fs.existsSync(indexHtmlPath), `index.html for project "${title}" (${id}) should exist at "/content/${id}/index.html"`).toBe(true);

                // Read the html fragment and strip HTML comments
                const rawHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
                expect(rawHtmlContent.trim().length, `index.html for project "${title}" is empty`).toBeGreaterThan(0);
                const htmlContent = rawHtmlContent.replace(/<!--[\s\S]*?-->/g, '');

                // Validate images inside the html fragment
                const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
                let imgMatch;
                while ((imgMatch = imgRegex.exec(htmlContent)) !== null) {
                    const src = imgMatch[1];
                    if (!src.startsWith('http') && !src.startsWith('data:')) {
                        const cleanSrcPath = src.split('?')[0].split('#')[0];
                        const cleanSrc = cleanSrcPath.replace(/^\/+/, '');
                        const fullImgPath = path.join(projectRoot, cleanSrc);
                        expect(fs.existsSync(fullImgPath), `Image file "${src}" referenced in project "${title}" index.html does not exist on disk`).toBe(true);
                    }
                }

                // Validate audio files inside the html fragment
                const audioRegex = /<audio[^>]+src=["']([^"']+)["']/g;
                let audioMatch;
                while ((audioMatch = audioRegex.exec(htmlContent)) !== null) {
                    const src = audioMatch[1];
                    if (!src.startsWith('http') && !src.startsWith('data:')) {
                        const cleanSrcPath = src.split('?')[0].split('#')[0];
                        const cleanSrc = cleanSrcPath.replace(/^\/+/, '').replace(/^\.\/+/, '');
                        const fullAudioPath = path.join(projectRoot, cleanSrc);
                        expect(fs.existsSync(fullAudioPath), `Audio file "${src}" referenced in project "${title}" index.html does not exist on disk`).toBe(true);
                    }
                }
            } else {
                // If hasExtendedContent is false, verify no content directory exists
                expect(fs.existsSync(contentDir), `Project "${title}" hasExtendedContent is false but directory "/content/${id}" exists`).toBe(false);
            }

            // Verify homepage grid image exists (if provided)
            if (image) {
                if (!image.startsWith('http') && !image.startsWith('data:')) {
                    const cleanImage = image.replace(/^\/+/, '');
                    const fullGridImgPath = path.join(projectRoot, cleanImage);
                    expect(fs.existsSync(fullGridImgPath), `Homepage image "${image}" for project "${title}" does not exist on disk`).toBe(true);
                }
            } else {
                // If no image, verify a symbol is provided
                expect(symbol, `Project "${title}" has no image and is missing a valid fallback symbol`).toBeDefined();
                expect(typeof symbol).toBe('string');
                expect(symbol.length).toBeGreaterThan(0);
            }
        });
    });

    it('should verify sitemap.xml is consistent with projects in project-data.js', () => {
        const sitemapPath = path.join(projectRoot, 'sitemap.xml');
        expect(fs.existsSync(sitemapPath), 'sitemap.xml must exist in the project root').toBe(true);

        const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

        myProjects.forEach(project => {
            const locUrl = `https://ryanmarch.me/project/${project.id}/`;
            if (project.hasExtendedContent) {
                expect(sitemapContent.includes(locUrl), `sitemap.xml should include project "${project.title}" URL: ${locUrl}`).toBe(true);
            } else {
                expect(sitemapContent.includes(locUrl), `sitemap.xml should NOT include project "${project.title}" URL: ${locUrl}`).toBe(false);
            }
        });
    });
});
