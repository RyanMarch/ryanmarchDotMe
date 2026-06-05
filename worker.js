import { myProjects } from './assets/js/project-data.js';
import redirects from './redirects.json';

/**
 * Cloudflare Worker for Ryan March | Product & Technology
 * Intercepts requests to /project/* and injects dynamic SEO/OG tags,
 * manages URL redirects, and serves a proper 404 page.
 */

class MetaRewriter {
    constructor(project) {
        this.project = project;
        this.fullTitle = this.project.seoTitle ? `${this.project.seoTitle} | Ryan March` : `${this.project.title} | Ryan March`;
        this.canonicalUrl = `https://ryanmarch.me/project/${this.project.id}/`;
    }

    element(element) {
        const tagName = element.tagName;

        if (tagName === 'title') {
            element.setInnerContent(this.fullTitle);
        } else if (tagName === 'meta') {
            const property = element.getAttribute('property');
            const name = element.getAttribute('name');

            if (property === 'og:title') {
                element.setAttribute('content', this.fullTitle);
            } else if (property === 'og:description') {
                element.setAttribute('content', this.project.seoDescription || this.project.subtitle);
            } else if (property === 'og:image') {
                if (this.project.image) {
                    const imageUrl = this.project.image.startsWith('http')
                        ? this.project.image
                        : `https://ryanmarch.me/${this.project.image.replace(/^\/+/, '')}`;
                    element.setAttribute('content', imageUrl);
                }
            } else if (name === 'description') {
                element.setAttribute('content', this.project.seoDescription || this.project.subtitle);
            }
        } else if (tagName === 'link') {
            const rel = element.getAttribute('rel');
            if (rel === 'canonical') {
                element.setAttribute('href', this.canonicalUrl);
            }
        }
    }
}

export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);

            // Redirect www to non-www
            if (url.hostname === 'www.ryanmarch.me') {
                return Response.redirect(`https://ryanmarch.me${url.pathname}${url.search}`, 301);
            }

            const path = url.pathname;

            const normalizePath = (p) => {
                const clean = p.trim().replace(/\/+$/, '');
                return clean === '' ? '/' : clean;
            };

            const cleanPath = normalizePath(path);

            // Redirect /admin or /admin/ to /admin.html
            if (cleanPath === '/admin') {
                return new Response(null, {
                    status: 301,
                    headers: {
                        'Location': `https://ryanmarch.me/admin.html${url.search}`,
                        'X-Robots-Tag': 'noindex, nofollow'
                    }
                });
            }

            // Handle API proxy for mobile admin
            if (cleanPath === '/api/admin/file') {
                // Check authorization: CF Access (production) or Bearer password (local dev fallback)
                const cfJwt = request.headers.get('cf-access-jwt-assertion') || request.headers.get('CF-Access-JWT-Assertion');
                const cfEmail = request.headers.get('cf-access-authenticated-user-email') || request.headers.get('CF-Access-Authenticated-User-Email');
                const authHeader = request.headers.get('Authorization');
                const validPassword = env.ADMIN_PASSWORD && authHeader === `Bearer ${env.ADMIN_PASSWORD}`;
                if (!cfJwt && !cfEmail && !validPassword) {
                    return new Response('Unauthorized', { status: 401 });
                }

                const filePath = url.searchParams.get('path');
                if (!filePath) {
                    return new Response('Missing path parameter', { status: 400 });
                }

                // Restrict files to content/ and specific global files to prevent arbitrary reads/writes
                const isAllowedPath =
                    filePath.startsWith('content/') ||
                    filePath === 'index.html' ||
                    filePath === 'assets/js/project-data.js' ||
                    filePath === 'sitemap.xml' ||
                    filePath === 'redirects.json' ||
                    filePath === 'robots.txt';

                if (!isAllowedPath) {
                    return new Response('Forbidden path', { status: 403 });
                }

                const githubRepo = env.GITHUB_REPO;
                const githubUserAgent = `${githubRepo.split('/').pop()}-Cloudflare-Worker`;
                const githubApiUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

                if (request.method === 'GET') {
                    // Fetch file from GitHub
                    const ghRes = await fetch(githubApiUrl, {
                        headers: {
                            'Authorization': `token ${env.GITHUB_PAT}`,
                            'User-Agent': githubUserAgent
                        }
                    });
                    if (!ghRes.ok) {
                        return new Response(await ghRes.text(), { status: ghRes.status });
                    }
                    const data = await ghRes.json();
                    return new Response(JSON.stringify({
                        content: data.content,
                        sha: data.sha
                    }), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-store, no-cache, must-revalidate'
                        }
                    });
                } else if (request.method === 'POST') {
                    // Commit file to GitHub
                    const body = await request.json();
                    const ghRes = await fetch(githubApiUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${env.GITHUB_PAT}`,
                            'User-Agent': githubUserAgent,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: body.message || `admin: update ${filePath}`,
                            content: body.content, // base64 encoded content
                            sha: body.sha // required if updating existing file
                        })
                    });
                    if (!ghRes.ok) {
                        return new Response(await ghRes.text(), { status: ghRes.status });
                    }
                    const data = await ghRes.json();
                    return new Response(JSON.stringify({
                        success: true,
                        sha: data.content.sha
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                } else {
                    return new Response('Method Not Allowed', { status: 405 });
                }
            }

            // 1. Check redirects first
            const redirectMatch = redirects.find(r => normalizePath(r.source).toLowerCase() === cleanPath.toLowerCase());
            if (redirectMatch) {
                const targetUrl = new URL(redirectMatch.destination, 'https://ryanmarch.me');
                for (const [key, value] of url.searchParams) {
                    targetUrl.searchParams.set(key, value);
                }
                return Response.redirect(targetUrl.toString(), redirectMatch.permanent ? 301 : 302);
            }

            // 1.5. Redirect old portfolio paths to their new counterparts
            if (cleanPath.startsWith('/portfolio/')) {
                const projectSlug = cleanPath.substring('/portfolio/'.length);
                if (projectSlug) {
                    return Response.redirect(`https://ryanmarch.me/project/${projectSlug}/${url.search}`, 301);
                }
            } else if (cleanPath === '/portfolio') {
                return Response.redirect(`https://ryanmarch.me/${url.search}`, 301);
            }

            // 1.7. Normalize trailing slash for project details (redirect /project/abc to /project/abc/)
            if (path.startsWith('/project/') && !path.endsWith('/')) {
                const projectMatch = cleanPath.match(/^\/project\/([^\/]+)$/i);
                if (projectMatch) {
                    const projectId = projectMatch[1];
                    const project = myProjects.find(p => p.id.toLowerCase() === projectId.toLowerCase());
                    if (project) {
                        return Response.redirect(`https://ryanmarch.me/project/${project.id}/${url.search}`, 301);
                    }
                }
            }

            // 1b. Internal rewrites for root-level favicon/manifest files
            if (cleanPath === '/favicon.ico') {
                return env.ASSETS.fetch(new Request(url.origin + '/assets/favicon/favicon.ico', request));
            }
            if (cleanPath === '/apple-touch-icon.png') {
                return env.ASSETS.fetch(new Request(url.origin + '/assets/favicon/apple-touch-icon.png', request));
            }
            if (cleanPath === '/site.webmanifest') {
                return env.ASSETS.fetch(new Request(url.origin + '/assets/favicon/site.webmanifest', request));
            }

            // 2. Validate route to determine if it should 404
            const isStaticAsset =
                cleanPath.startsWith('/assets/') ||
                cleanPath.startsWith('/content/') ||
                [
                    '/style.css',
                    '/robots.txt',
                    '/sitemap.xml',
                    '/favicon.ico',
                    '/404.html',
                    '/index.html',
                    '/admin.html'
                ].includes(cleanPath.toLowerCase());

            const projectMatch = cleanPath.match(/^\/project\/([^\/]+)$/i);
            let isValidProject = false;
            let project = null;
            if (projectMatch) {
                const projectId = projectMatch[1];
                project = myProjects.find(p => p.id.toLowerCase() === projectId.toLowerCase());
                if (project) {
                    isValidProject = true;
                }
            }

            const isValidRoute = cleanPath === '/' || isStaticAsset || isValidProject;

            if (!isValidRoute) {
                // Fetch and return the custom 404 page
                const response404 = await env.ASSETS.fetch(new Request(url.origin + '/404.html'));
                return new Response(response404.body, {
                    status: 404,
                    headers: {
                        ...Object.fromEntries(response404.headers),
                        'Content-Type': 'text/html; charset=utf-8'
                    }
                });
            }

            // Fetch the asset — for valid project routes, explicitly serve index.html
            // (we can't rely on SPA fallback since we removed not_found_handling)
            const assetRequest = isValidProject
                ? new Request(url.origin + '/index.html', request)
                : request;
            const response = await env.ASSETS.fetch(assetRequest);

            // If it's a valid project route and the response is HTML, rewrite the meta tags
            if (isValidProject && project && response.headers.get('content-type')?.includes('text/html')) {
                return new HTMLRewriter()
                    .on('title', new MetaRewriter(project))
                    .on('meta[property="og:title"]', new MetaRewriter(project))
                    .on('meta[property="og:description"]', new MetaRewriter(project))
                    .on('meta[property="og:image"]', new MetaRewriter(project))
                    .on('meta[name="description"]', new MetaRewriter(project))
                    .on('link[rel="canonical"]', new MetaRewriter(project))
                    .transform(response);
            }

            if (cleanPath === '/admin.html') {
                // Fetch the asset using '/admin' internally to bypass Workers Assets' clean URL redirect (.html -> extensionless)
                const rewrittenRequest = new Request(url.origin + '/admin', request);
                const assetResponse = await env.ASSETS.fetch(rewrittenRequest);
                const newHeaders = new Headers(assetResponse.headers);
                newHeaders.set('X-Robots-Tag', 'noindex, nofollow');
                return new Response(assetResponse.body, {
                    status: assetResponse.status,
                    statusText: assetResponse.statusText,
                    headers: newHeaders
                });
            }

            return response;
        } catch (err) {
            return new Response('Internal Server Error', {
                status: 500,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    }
};
