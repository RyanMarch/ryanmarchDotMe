// Content audits for the admin. Pure functions: no DOM, no network, no imports,
// so the Worker (server-side runs) and the admin UI (live validation) share them.
//
// A finding is { severity, check, id, message } where severity is
// 'error' (something is broken), 'warning' (worth fixing) or 'info' (nice to have).
// `id` is the project id (or a redirect source) the finding is about.

export const SEO_TITLE = { min: 20, max: 60 };
export const SEO_DESCRIPTION = { min: 70, max: 160 };
export const THIN_WORDS = 150;

const finding = (severity, check, id, message) => ({ severity, check, id, message });

/** Checks that need only the project's entry in project-data.js. */
export function auditProjectMeta(project) {
    const out = [];
    const id = project.id;
    const hasPage = Boolean(project.hasExtendedContent);

    // A card with `symbol` draws its own icon (see projects.js), so it needs no image file.
    if (!project.image && !project.symbol) out.push(finding('error', 'card-image', id, 'No card image set.'));
    if (!project.subtitle) out.push(finding('warning', 'subtitle', id, 'No subtitle for the homepage card.'));

    if (hasPage) {
        const t = (project.seoTitle || '').trim();
        if (!t) out.push(finding('warning', 'seo-title', id, 'No SEO title; the page falls back to the project name.'));
        else if (t.length > SEO_TITLE.max) out.push(finding('warning', 'seo-title', id, `SEO title is ${t.length} characters; search results cut off around ${SEO_TITLE.max}.`));
        else if (t.length < SEO_TITLE.min) out.push(finding('info', 'seo-title', id, `SEO title is only ${t.length} characters.`));

        const d = (project.seoDescription || '').trim();
        if (!d) out.push(finding('warning', 'seo-description', id, 'No SEO description.'));
        else if (d.length > SEO_DESCRIPTION.max) out.push(finding('warning', 'seo-description', id, `SEO description is ${d.length} characters; it gets truncated past ~${SEO_DESCRIPTION.max}.`));
        else if (d.length < SEO_DESCRIPTION.min) out.push(finding('info', 'seo-description', id, `SEO description is only ${d.length} characters.`));

        if (!project.ogImage) out.push(finding('warning', 'og-image', id, 'No social share (OG) image.'));
    }
    return out;
}

const IMG_TAG = /<img\b[^>]*>/gi;
const attr = (tag, name) => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
    return m ? (m[1] ?? m[2]) : null;
};

function stripComments(html) {
    return html.replace(/<!--[\s\S]*?-->/g, '');
}

/** Checks on a project's write-up HTML fragment. */
export function auditProjectHtml(project, rawHtml) {
    const out = [];
    const id = project.id;
    const html = stripComments(rawHtml);

    for (const tag of html.match(IMG_TAG) || []) {
        const src = attr(tag, 'src') || '(no src)';
        const alt = attr(tag, 'alt');
        const name = src.split('/').pop();
        if (alt === null) out.push(finding('warning', 'img-alt', id, `Image has no alt attribute: ${name}`));
        else if (alt.trim() && (/\.(png|jpe?g|avif|webp|gif|svg)$/i.test(alt.trim()) || /^(image|photo|screenshot|img)$/i.test(alt.trim()))) {
            out.push(finding('info', 'img-alt', id, `Alt text looks like a placeholder ("${alt.trim()}") on ${name}`));
        } else if (alt.length > 200) {
            out.push(finding('info', 'img-alt', id, `Alt text is ${alt.length} characters on ${name}; consider a caption instead.`));
        }
    }

    for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
        const tag = m[0];
        if (/target\s*=\s*["']_blank["']/i.test(tag) && !/rel\s*=\s*["'][^"']*noopener/i.test(tag)) {
            out.push(finding('info', 'link-rel', id, `External link opens a new tab without rel="noopener": ${(attr(tag, 'href') || '').slice(0, 60)}`));
        }
    }

    if (/<h1\b/i.test(html)) out.push(finding('warning', 'heading', id, 'Write-up contains an <h1>; the page already has one.'));

    const words = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    if (words < THIN_WORDS) out.push(finding('info', 'thin-content', id, `Write-up is only ${words} words.`));

    return out;
}

const normPath = p => {
    const clean = String(p).trim().replace(/\/+$/, '').toLowerCase();
    return clean === '' ? '/' : clean;
};

/** Checks on config/redirects.json against the real project list. */
export function auditRedirects(redirects, projects) {
    const out = [];
    const projectIds = new Set(projects.map(p => p.id.toLowerCase()));
    const sources = new Map();
    for (const r of redirects) sources.set(normPath(r.source), r);

    const seen = new Set();
    for (const r of redirects) {
        const src = normPath(r.source);
        const id = r.source;
        if (!r.source || !r.destination) {
            out.push(finding('error', 'redirect-incomplete', id || '(empty)', 'Redirect needs both a source and a destination.'));
            continue;
        }
        if (!String(r.source).startsWith('/')) out.push(finding('error', 'redirect-source', id, 'Source must start with "/".'));
        if (seen.has(src)) out.push(finding('error', 'redirect-duplicate', id, 'Duplicate source; only the first match is used.'));
        seen.add(src);

        const external = /^https?:\/\//i.test(r.destination);
        const dest = external ? null : normPath(r.destination.split(/[?#]/)[0]);

        if (dest === src) out.push(finding('error', 'redirect-loop', id, 'Redirects to itself.'));

        const hijacked = src.match(/^\/project\/([^/]+)$/);
        if (hijacked && projectIds.has(hijacked[1])) {
            out.push(finding('error', 'redirect-hijack', id, `Redirect takes over the live project page for "${hijacked[1]}".`));
        }

        if (dest) {
            const proj = dest.match(/^\/project\/([^/]+)$/);
            if (proj && !projectIds.has(proj[1])) out.push(finding('error', 'redirect-target', id, `Destination project "${proj[1]}" does not exist.`));

            const next = sources.get(dest);
            if (next && dest !== src) {
                const back = !/^https?:/i.test(next.destination) && normPath(next.destination.split(/[?#]/)[0]) === src;
                out.push(back
                    ? finding('error', 'redirect-loop', id, `Loops with ${next.source}.`)
                    : finding('warning', 'redirect-chain', id, `Chains through ${next.source}; point straight at the final page.`));
            }
        }
        if (r.permanent === false && !external) out.push(finding('info', 'redirect-temporary', id, 'Temporary (302) redirect to an internal page.'));
    }
    return out;
}

/** Checks the sitemap XML text against the projects that have pages. */
export function auditSitemap(xml, projects) {
    const out = [];
    const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()));
    const expected = new Set(projects.filter(p => p.hasExtendedContent).map(p => `https://ryanmarch.me/project/${p.id}/`));
    for (const url of expected) if (!locs.has(url)) out.push(finding('error', 'sitemap-missing', url.split('/').slice(-2, -1)[0], `Not in the sitemap: ${url}`));
    for (const url of locs) {
        const m = url.match(/\/project\/([^/]+)\/$/);
        if (m && !expected.has(url)) out.push(finding('warning', 'sitemap-extra', m[1], `Sitemap lists a page that has no write-up: ${url}`));
    }
    return out;
}

export function summarize(findings) {
    const counts = { error: 0, warning: 0, info: 0 };
    for (const f of findings) counts[f.severity] += 1;
    return counts;
}

export const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };
export const sortFindings = findings => [...findings].sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || String(a.id).localeCompare(String(b.id)));
