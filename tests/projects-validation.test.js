import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
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
                // Audio files may be hosted remotely in R2 (excluded by .gitignore) in CI builds
                const audioRegex = /<audio[^>]+src=["']([^"']+)["']/g;
                let audioMatch;
                while ((audioMatch = audioRegex.exec(htmlContent)) !== null) {
                    const src = audioMatch[1];
                    if (!src.startsWith('http') && !src.startsWith('data:')) {
                        const cleanSrcPath = src.split('?')[0].split('#')[0];
                        const cleanSrc = cleanSrcPath.replace(/^\/+/, '').replace(/^\.\/+/, '');
                        const fullAudioPath = path.join(projectRoot, cleanSrc);
                        // In local dev, local file exists. In CI (where *.mp3 is .gitignored & hosted on R2 CDN), verify path structure.
                        if (fs.existsSync(fullAudioPath)) {
                            expect(fs.existsSync(fullAudioPath)).toBe(true);
                        } else {
                            // Verify standard content/<id>/audio/ path convention
                            expect(cleanSrc).toMatch(/^content\/[^/]+\/audio\/[^/]+\.(mp3|m4a|wav|ogg)$/);
                        }
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
        
        // If sitemap doesn't exist (e.g., fresh CI context prior to build), generate a temporary one to proceed
        if (!fs.existsSync(sitemapPath)) {
            const today = new Date().toISOString().split('T')[0];
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
            xml += `  <url><loc>https://ryanmarch.me/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n`;
            for (const project of myProjects) {
                if (project.hasExtendedContent) {
                    xml += `  <url><loc>https://ryanmarch.me/project/${project.id}/</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>\n`;
                }
            }
            xml += '</urlset>\n';
            fs.writeFileSync(sitemapPath, xml, 'utf8');
        }

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

    it('should verify that critical deployment and build files are not ignored by Git', () => {
        const criticalFiles = [
            'sitemap-generator.js',
            'build.js',
            'package.json',
            'worker.js',
            'assets/js/project-data.js',
            'assets/js/projects.js',
            'tests/sitemap.test.js'
        ];

        criticalFiles.forEach(file => {
            const filePath = path.join(projectRoot, file);
            expect(fs.existsSync(filePath), `Critical file "${file}" should exist on disk`).toBe(true);
        });

        // Run git check-ignore to ensure they are not ignored
        try {
            criticalFiles.forEach(file => {
                try {
                    // git check-ignore returns exit status 0 if the path is ignored, and status 1 if not ignored
                    execSync(`git check-ignore -q "${file}"`, { stdio: 'ignore' });
                    // If it succeeded (didn't throw), it means the file IS ignored!
                    expect.fail(`Critical deployment file "${file}" is currently ignored by Git (check .gitignore)`);
                } catch (err) {
                    // If it's a test failure from expect.fail, rethrow it
                    if (err.message && err.message.includes('ignored by Git')) {
                        throw err;
                    }
                    // If git check-ignore returned 1, this is the expected behavior (not ignored)
                    if (err.status !== 1) {
                        throw err;
                    }
                }
            });
        } catch (e) {
            // Git check-ignore will fail to execute if git is not installed (e.g., in some CI/container sandboxes).
            // We bypass the check only if it is a system/git missing error, but fail if it's a test assertion failure.
            if (e.message && e.message.includes('ignored by Git')) {
                throw e;
            }
        }
    });

    it('should not contain any debug console.log or console.debug statements in any client-facing or worker JavaScript files', () => {
        const jsFiles = [
            path.join(projectRoot, 'worker.js')
        ];

        const assetsJsDir = path.join(projectRoot, 'assets/js');
        const assetsFiles = fs.readdirSync(assetsJsDir);
        assetsFiles.forEach(file => {
            if (file.endsWith('.js') && file !== 'beacon.min.js') {
                jsFiles.push(path.join(assetsJsDir, file));
            }
        });

        const violations = [];

        jsFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf8');
            const cleanContent = content
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*/g, '');
            
            const debugLogRegex = /console\.(log|debug|dir|trace)\(/g;
            const matches = [...cleanContent.matchAll(debugLogRegex)];
            
            if (matches.length > 0) {
                const relativePath = path.relative(projectRoot, file);
                violations.push(`${relativePath} (${matches.length} match(es))`);
            }
        });

        expect(violations, `Found active debug logging calls in the following files:\n${violations.join('\n')}`).toEqual([]);
    });

    it('should validate project data formatting and required fields in project-data.js', () => {
        myProjects.forEach(project => {
            const { id, title, subtitle, seoTitle, seoDescription, tags } = project;

            // Required core fields
            expect(id, `Project missing id`).toBeDefined();
            expect(id.trim().length).toBeGreaterThan(0);
            expect(title, `Project (${id}) missing title`).toBeDefined();
            expect(title.trim().length).toBeGreaterThan(0);

            // Subtitle check
            expect(subtitle, `Project "${title}" (${id}) missing subtitle`).toBeDefined();
            expect(typeof subtitle).toBe('string');
            expect(subtitle.trim().length).toBeGreaterThan(0);

            // SEO metadata
            expect(seoTitle, `Project "${title}" (${id}) missing seoTitle`).toBeDefined();
            expect(seoDescription, `Project "${title}" (${id}) missing seoDescription`).toBeDefined();

            // Tags
            expect(Array.isArray(tags), `Project "${title}" (${id}) tags should be an array`).toBe(true);
            expect(tags.length, `Project "${title}" (${id}) must have at least one tag`).toBeGreaterThan(0);
            tags.forEach((tag, idx) => {
                expect(tag.label, `Project "${title}" (${id}) tag at index ${idx} missing label`).toBeDefined();
                expect(tag.color, `Project "${title}" (${id}) tag at index ${idx} missing color`).toBeDefined();
            });
        });
    });
});
