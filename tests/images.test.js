import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { myProjects } from '../assets/js/project-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../');

// Helper to recursively get files with specific extensions
function getFilesRecursively(dir, extensions) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== '.wrangler' && file !== 'dev') {
                results = results.concat(getFilesRecursively(filePath, extensions));
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            if (extensions.includes(ext)) {
                results.push(filePath);
            }
        }
    });
    return results;
}

// Helper to check if a path is an image
function isImagePath(urlPath) {
    const ext = path.extname(urlPath.split('?')[0].split('#')[0]).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.avif'].includes(ext);
}

describe('Images and Media Path Validations', () => {
    it('should validate all image references in all HTML files', () => {
        const htmlFiles = getFilesRecursively(projectRoot, ['.html']);

        htmlFiles.forEach(htmlFile => {
            const relativeHtmlPath = path.relative(projectRoot, htmlFile);
            const content = fs.readFileSync(htmlFile, 'utf8');

            // 1. Check all <img> tags
            const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
            let match;
            while ((match = imgRegex.exec(content)) !== null) {
                const src = match[1];
                if (!src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('//') && !src.includes('${') && !src.includes('{{')) {
                    const cleanPath = src.split('?')[0].split('#')[0];
                    // Resolve relative path to root or directory of HTML file
                    let resolvedPath;
                    if (cleanPath.startsWith('/') || cleanPath.startsWith('content/') || cleanPath.startsWith('assets/')) {
                        resolvedPath = path.join(projectRoot, cleanPath);
                    } else {
                        resolvedPath = path.resolve(path.dirname(htmlFile), cleanPath);
                    }

                    expect(fs.existsSync(resolvedPath), 
                        `Image file "${src}" referenced in "${relativeHtmlPath}" does not exist on disk (resolved: ${path.relative(projectRoot, resolvedPath)})`
                    ).toBe(true);
                }
            }

            // 2. Check all <link> elements for icons
            const linkRegex = /<link[^>]+href=["']([^"']+)["']/g;
            while ((match = linkRegex.exec(content)) !== null) {
                const href = match[1];
                if (isImagePath(href) && !href.startsWith('http') && !href.startsWith('data:') && !href.startsWith('//') && !href.includes('${') && !href.includes('{{')) {
                    const cleanPath = href.split('?')[0].split('#')[0];
                    let resolvedPath;
                    if (cleanPath.startsWith('/') || cleanPath.startsWith('content/') || cleanPath.startsWith('assets/')) {
                        resolvedPath = path.join(projectRoot, cleanPath);
                    } else {
                        resolvedPath = path.resolve(path.dirname(htmlFile), cleanPath);
                    }

                    expect(fs.existsSync(resolvedPath), 
                        `Icon/Link image file "${href}" referenced in "${relativeHtmlPath}" does not exist on disk`
                    ).toBe(true);
                }
            }

            // 3. Check open graph / twitter meta images
            const metaRegex = /<meta[^>]+content=["']([^"']+)["']/g;
            while ((match = metaRegex.exec(content)) !== null) {
                const contentVal = match[1];
                if (isImagePath(contentVal) && !contentVal.startsWith('http') && !contentVal.startsWith('data:') && !contentVal.startsWith('//') && !contentVal.includes('${') && !contentVal.includes('{{')) {
                    const cleanPath = contentVal.split('?')[0].split('#')[0];
                    let resolvedPath;
                    if (cleanPath.startsWith('/') || cleanPath.startsWith('content/') || cleanPath.startsWith('assets/')) {
                        resolvedPath = path.join(projectRoot, cleanPath);
                    } else {
                        resolvedPath = path.resolve(path.dirname(htmlFile), cleanPath);
                    }

                    expect(fs.existsSync(resolvedPath), 
                        `Meta image file "${contentVal}" referenced in "${relativeHtmlPath}" does not exist on disk`
                    ).toBe(true);
                }
            }
        });
    });

    it('should validate all image references in CSS files', () => {
        const cssFiles = getFilesRecursively(projectRoot, ['.css']);

        cssFiles.forEach(cssFile => {
            const relativeCssPath = path.relative(projectRoot, cssFile);
            const content = fs.readFileSync(cssFile, 'utf8');

            const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
            let match;
            while ((match = urlRegex.exec(content)) !== null) {
                const urlPath = match[1];
                if (isImagePath(urlPath) && !urlPath.startsWith('http') && !urlPath.startsWith('data:') && !urlPath.startsWith('//')) {
                    const cleanPath = urlPath.split('?')[0].split('#')[0];
                    let resolvedPath;
                    if (cleanPath.startsWith('/')) {
                        resolvedPath = path.join(projectRoot, cleanPath);
                    } else {
                        resolvedPath = path.resolve(path.dirname(cssFile), cleanPath);
                    }

                    expect(fs.existsSync(resolvedPath), 
                        `CSS image "${urlPath}" referenced in "${relativeCssPath}" does not exist on disk`
                    ).toBe(true);
                }
            }
        });
    });

    it('should validate all images defined in project-data.js', () => {
        myProjects.forEach(project => {
            const { title, image, symbol } = project;

            // Check main project image
            if (image) {
                if (!image.startsWith('http') && !image.startsWith('data:') && !image.startsWith('//')) {
                    const cleanPath = image.split('?')[0].split('#')[0].replace(/^\/+/, '');
                    const resolvedPath = path.join(projectRoot, cleanPath);
                    expect(fs.existsSync(resolvedPath), 
                        `Project "${title}" references image "${image}" in project-data.js which does not exist on disk`
                    ).toBe(true);
                }
            }

            // Check hardcoded assets in symbol configurations
            if (symbol === 'hub') {
                const resolvedPath = path.join(projectRoot, 'assets/img/rentpress-logo.svg');
                expect(fs.existsSync(resolvedPath), 
                    `Symbol logo assets/img/rentpress-logo.svg for project "${title}" does not exist on disk`
                ).toBe(true);
            }
        });
    });
});
