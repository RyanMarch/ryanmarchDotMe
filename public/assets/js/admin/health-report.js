// Turns Content health findings into a Markdown report that a person or an AI agent can work through.
// Pure (no DOM, no network) so it is easy to test.

import { SEO_DESCRIPTION, SEO_TITLE, summarize } from './audit.js';

const FIX = {
    'card-image': p => `Set \`image\` in this project's entry in \`public/assets/js/project-data.js\` to a file that exists under \`public/content/${p}/images/\` (\`npm run image-variants\` creates the .avif/.png set and writes the project data).`,
    'subtitle': () => 'Add a one-sentence `subtitle` to the project entry in `public/assets/js/project-data.js`. It is the homepage card text.',
    'seo-title': () => `Set \`seoTitle\` in the project entry in \`public/assets/js/project-data.js\` to ${SEO_TITLE.min}-${SEO_TITLE.max} characters. Lead with what it is; keep the project name.`,
    'seo-description': () => `Set \`seoDescription\` in the project entry in \`public/assets/js/project-data.js\` to ${SEO_DESCRIPTION.min}-${SEO_DESCRIPTION.max} characters. Plain sentence(s) describing the project; no keyword stuffing.`,
    'og-image': p => `Add \`ogImage\` to the project entry: a 1200x630 JPEG at \`public/content/${p}/images/og.jpg\` (\`npm run image-variants -- <source> --og --project ${p}\`).`,
    'img-alt': p => `In \`public/content/${p}/index.html\`, give the image an \`alt\` that describes what it shows (not the file name). Use \`alt=""\` only for purely decorative images. Put long explanations in the caption, not the alt.`,
    'link-rel': p => `In \`public/content/${p}/index.html\`, add \`rel="noopener"\` to links that use \`target="_blank"\`.`,
    'heading': p => `In \`public/content/${p}/index.html\`, change the \`<h1>\` to \`<h2>\`; the page template already renders the only h1.`,
    'thin-content': p => `Informational. \`public/content/${p}/index.html\` is short; expand it only if there is more worth saying.`,
    'writeup-missing': p => `\`public/content/${p}/index.html\` is missing or unreadable. Create it, or set \`hasExtendedContent: false\` on the project if it is link-only.`,
    'link-broken': p => `In \`public/content/${p}/index.html\`, update the link to where the page lives now, point it at an archived copy, or remove it. The address answers 404/410 or does not resolve.`,
    'redirect-incomplete': () => 'In `config/redirects.json`, give the entry both a `source` and a `destination`, or remove it.',
    'redirect-source': () => 'In `config/redirects.json`, start the `source` with "/".',
    'redirect-duplicate': () => 'In `config/redirects.json`, remove the duplicate; only the first matching entry is used.',
    'redirect-loop': () => 'In `config/redirects.json`, make the redirect point somewhere other than itself or back at the page that redirects to it.',
    'redirect-chain': () => 'In `config/redirects.json`, point the `destination` straight at the final page instead of at another redirect.',
    'redirect-hijack': () => 'This redirect shadows a live project page. Remove it from `config/redirects.json`, or unpublish the project if the page should go away.',
    'redirect-target': () => 'In `config/redirects.json`, point the `destination` at a project that exists and is published, or at another real page.',
    'redirect-temporary': () => 'Informational. Change `permanent` to true in `config/redirects.json` if the move is permanent.',
    'sitemap-missing': () => 'Do not edit `sitemap.xml`; it is generated at build time from `project-data.js`. Make sure the project has `hasExtendedContent: true` and is not `unpublished`.',
    'sitemap-extra': () => 'Do not edit `sitemap.xml`; it is generated at build time. The project is probably missing `hasExtendedContent: true` or has no write-up.'
};

const LABEL = { error: 'ERROR', warning: 'WARNING', info: 'NOTE' };
const ORDER = { error: 0, warning: 1, info: 2 };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function section(findings, projectIds) {
    return findings.map(f => {
        const fix = FIX[f.check]?.(projectIds.has(f.id) ? f.id : '<id>');
        return `- **${LABEL[f.severity]}** \`${f.check}\`: ${f.message}${fix ? `\n  - Fix: ${fix}` : ''}`;
    }).join('\n');
}

/**
 * @param {object} o
 * @param {Array}  o.findings  [{ severity, check, id, message }]
 * @param {Array}  o.projects  the project list (for titles)
 * @param {'quick'|'full'} o.mode
 * @param {string} [o.filter]  'all' | 'error' | 'warning'
 * @param {string} [o.repo]
 * @param {Date}   [o.now]
 */
export function buildReport({ findings, projects = [], mode = 'quick', filter = 'all', repo = 'RyanMarch/ryanmarchDotMe', now = new Date() }) {
    const shown = findings
        .filter(f => filter === 'all' || f.severity === filter)
        .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || String(a.id).localeCompare(String(b.id)));
    const c = summarize(shown);
    const titles = new Map(projects.map(p => [p.id, p.title]));
    const ids = new Set(titles.keys());

    const byProject = new Map();
    const site = [];
    for (const f of shown) {
        if (ids.has(f.id)) {
            if (!byProject.has(f.id)) byProject.set(f.id, []);
            byProject.get(f.id).push(f);
        } else {
            site.push(f);
        }
    }

    const out = [];
    out.push('# Content health report: ryanmarch.me', '');
    out.push(`Generated ${now.toISOString().slice(0, 10)} from the admin's ${mode === 'full' ? 'full audit' : 'quick check'}${filter === 'all' ? '' : ` (showing ${filter === 'error' ? 'errors' : 'warnings'} only)`}.`);
    out.push(`**${plural(c.error, 'error')}, ${plural(c.warning, 'warning')}, ${plural(c.info, 'note')}.**`);
    if (mode !== 'full') out.push('', '> This was the quick check: it covers project data, SEO text and redirects only. Run the full audit in the admin for write-up and image checks.');

    out.push('', '## Instructions', '',
        `Repository: \`${repo}\`, a static site served by a Cloudflare Worker. Site files live under \`public/\`.`, '',
        '- Project data and SEO fields: `public/assets/js/project-data.js` (one object per project, keyed by `id`).',
        '- Write-ups: `public/content/<id>/index.html` (an HTML fragment, not a full page).',
        '- Redirects: `config/redirects.json`.',
        '- `sitemap.xml` is generated at build time; never edit it by hand.',
        '',
        'Work through the findings below. Keep the existing voice and meaning of the copy; change as little as needed. Do not rename or delete files, and do not touch projects that are not listed. When finished, run `npm test` and `npm run lint`, and summarise what changed per project.',
        'A finding marked NOTE is optional.');

    if (byProject.size) {
        out.push('', '## Projects');
        for (const [id, list] of byProject) {
            out.push('', `### ${titles.get(id)} (\`${id}\`)`, '', section(list, ids));
        }
    }
    if (site.length) {
        out.push('', '## Site-wide (redirects and sitemap)', '', section(site, ids));
    }
    if (!shown.length) out.push('', '## Findings', '', 'Nothing to fix.');
    return `${out.join('\n')}\n`;
}

export const reportFilename = (now = new Date()) => `content-health-${now.toISOString().slice(0, 10)}.md`;
