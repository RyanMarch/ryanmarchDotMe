// Keeps the homepage's <link id="lcp-preload"> pointed at the image the first grid card
// actually renders. build.js runs this on every deploy; `npm run sync-lcp` runs it by hand;
// tests/lcp-preload.test.js fails if index.html drifts out of sync.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildImageSrcset } from '../assets/js/image-utils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// projects.js appends cards in array order and diverts "Archive" projects to a separate grid,
// so the first card in the main grid is the first non-archived project.
export function findLcpProject(projects) {
    return projects.find(p => !p.tags?.some(t => t.label.toLowerCase() === 'archive')) || null;
}

export function buildPreloadTag(project) {
    const href = `/${project.image.replace(/^\/+/, '')}`;
    const responsive = buildImageSrcset(project);
    const attrs = [`rel="preload"`, `id="lcp-preload"`, `href="${href}"`, `as="image"`];
    if (responsive) {
        attrs.push(`imagesrcset="${responsive.srcset.split(', ').map(c => '/' + c.replace(/^\/+/, '')).join(', ')}"`);
        attrs.push(`imagesizes="${responsive.sizes}"`);
    }
    attrs.push(`fetchpriority="high"`);
    return `<link ${attrs.join(' ')}>`;
}

const PRELOAD_PATTERN = /<link\b[^>]*\bid="lcp-preload"[^>]*>/;

export function syncLcpPreload(html, projects) {
    const project = findLcpProject(projects);
    const tag = project?.image ? buildPreloadTag(project) : '';
    return html.replace(PRELOAD_PATTERN, tag);
}

export function syncIndexHtml(projects, indexPath = path.join(root, 'index.html')) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const updated = syncLcpPreload(html, projects);
    if (updated !== html) fs.writeFileSync(indexPath, updated, 'utf8');
    return updated !== html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const { myProjects } = await import('../assets/js/project-data.js');
    const changed = syncIndexHtml(myProjects);
    console.log(changed ? '✅ Updated index.html LCP preload' : '✅ index.html LCP preload already up to date');
}
