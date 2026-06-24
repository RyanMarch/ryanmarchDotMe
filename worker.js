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

class SchemaRewriter {
    constructor(project) {
        this.project = project;
    }

    element(element) {
        const tags = this.project.tags || [];
        const isSoftware = tags.some(t => {
            const label = (t.label || '').toLowerCase();
            return ['app', 'design tool', 'platform', 'backend', 'experimentation'].includes(label);
        });

        const schema = {
            "@context": "https://schema.org",
            "@type": isSoftware ? "SoftwareApplication" : "CreativeWork",
            "name": this.project.title,
            "description": this.project.seoDescription || this.project.subtitle,
            "url": `https://ryanmarch.me/project/${this.project.id}/`,
            "creator": {
                "@type": "Person",
                "name": "Ryan March",
                "url": "https://ryanmarch.me"
            }
        };

        if (tags.length > 0) {
            schema.keywords = tags.map(t => t.label).join(', ');
        }

        if (this.project.image) {
            schema.image = this.project.image.startsWith('http')
                ? this.project.image
                : `https://ryanmarch.me/${this.project.image.replace(/^\/+/, '')}`;
        }

        if (isSoftware) {
            let category = "DeveloperApplication";
            const tagLabels = tags.map(t => t.label.toLowerCase());
            if (tagLabels.includes("design tool")) {
                category = "DesignApplication";
            } else if (tagLabels.includes("app") && this.project.id.includes("weather")) {
                category = "WeatherApplication";
            } else if (tagLabels.includes("platform") || tagLabels.includes("backend")) {
                category = "BusinessApplication";
            }
            schema.applicationCategory = category;
            schema.operatingSystem = "Any";

            schema.offers = {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
            };
        }

        element.setAttribute('id', isSoftware ? 'schema-software' : 'schema-work');
        element.setInnerContent(JSON.stringify(schema, null, 2));
    }
}

class PreloadRewriter {
    constructor(project) {
        this.project = project;
    }

    element(element) {
        if (!this.project.image) {
            // Remove the preload link if there is no hero image
            element.remove();
            return;
        }

        // Resolve absolute path (with leading slash)
        const imagePath = this.project.image.startsWith('/')
            ? this.project.image
            : `/${this.project.image}`;

        element.setAttribute('href', imagePath);
        element.removeAttribute('imagesrcset');
        element.removeAttribute('imagesizes');
    }
}


export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);

            // Determine if running locally to bypass recursive routing loopback in wrangler dev
            const isLocal = request.headers.has('mf-original-hostname') || url.hostname.startsWith('localhost') || url.hostname.startsWith('127.0.0.1') || url.hostname === 'assets.local';
            const assetHost = isLocal ? 'http://assets.local' : url.origin;
            const redirectOrigin = isLocal ? url.origin : 'https://ryanmarch.me';

            // Redirect HTTP to HTTPS in production, cleaning www prefix if present
            if (!isLocal && (url.protocol === 'http:' || request.headers.get('x-forwarded-proto') === 'http')) {
                const cleanHostname = url.hostname.replace(/^www\./i, '');
                return Response.redirect(`https://${cleanHostname}${url.pathname}${url.search}`, 301);
            }

            // Redirect www to non-www (HTTPS requests in production)
            if (url.hostname === 'www.ryanmarch.me') {
                return Response.redirect(`https://ryanmarch.me${url.pathname}${url.search}`, 301);
            }

            const path = url.pathname;

            const normalizePath = (p) => {
                const clean = p.trim().replace(/\/+$/, '');
                return clean === '' ? '/' : clean;
            };

            const cleanPath = normalizePath(path);

            console.log('--- Worker Request Debug ---');
            console.log('Incoming path:', path);
            console.log('Normalized cleanPath:', cleanPath);
            console.log('Matches /portfolio prefix?:', cleanPath.startsWith('/portfolio'));
            console.log('----------------------------');

            // Redirect /admin or /admin/ to /admin.html
            if (cleanPath === '/admin') {
                return new Response(null, {
                    status: 301,
                    headers: {
                        'Location': `${redirectOrigin}/admin.html${url.search}`,
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

                let filePath = url.searchParams.get('path');
                let branch = url.searchParams.get('branch') || 'main';
                if (request.method === 'POST') {
                    try {
                        const body = await request.clone().json();
                        if (body && body.path) {
                            filePath = body.path;
                        }
                        if (body && body.branch) {
                            branch = body.branch;
                        }
                    } catch {
                        // Ignore body parsing failures
                    }
                }

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

                if (request.method === 'GET') {
                    // Fetch file from GitHub with ref branch parameter
                    const githubApiUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}?ref=${branch}`;
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
                    const githubApiUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;
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
                            sha: body.sha, // required if updating existing file
                            branch: branch
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

            // 1. Check legacy portfolio paths first
            if (cleanPath === '/portfolio' || cleanPath.startsWith('/portfolio/')) {
                const segments = cleanPath.split('/');
                const projectSlug = segments[2];

                if (projectSlug) {
                    const searchSuffix = url.search ? url.search : '';
                    return Response.redirect(`${redirectOrigin}/project/${projectSlug.toLowerCase()}/${searchSuffix}`, 301);
                } else {
                    return Response.redirect(`${redirectOrigin}/${url.search}`, 301);
                }
            }

            // 1.2. Check standard redirects next
            const redirectMatch = redirects.find(r => normalizePath(r.source).toLowerCase() === cleanPath.toLowerCase());
            if (redirectMatch) {
                const targetUrl = new URL(redirectMatch.destination, redirectOrigin);
                for (const [key, value] of url.searchParams) {
                    targetUrl.searchParams.set(key, value);
                }
                return Response.redirect(targetUrl.toString(), redirectMatch.permanent ? 301 : 302);
            }

            // 1.7. Normalize trailing slash for project details
            const projectNormalizeMatch = cleanPath.match(/^\/project\/([^/]+)$/i);
            if (projectNormalizeMatch) {
                const projectId = projectNormalizeMatch[1];
                const project = myProjects.find(p => p.id.toLowerCase() === projectId.toLowerCase());
                // If they visited a valid project path, force redirect to a clean trailing-slash format
                if (project && !path.endsWith('/')) {
                    return Response.redirect(`${redirectOrigin}/project/${project.id}/${url.search}`, 301);
                }
            }

            // 1b. Internal rewrites for root-level favicon/manifest files
            if (cleanPath === '/favicon.ico') {
                return env.ASSETS.fetch(new Request(`${assetHost}/assets/favicon/favicon.ico`, request));
            }
            if (cleanPath === '/apple-touch-icon.png') {
                return env.ASSETS.fetch(new Request(`${assetHost}/assets/favicon/apple-touch-icon.png`, request));
            }
            if (cleanPath === '/site.webmanifest') {
                return env.ASSETS.fetch(new Request(`${assetHost}/assets/favicon/site.webmanifest`, request));
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
                    '/404',
                    '/index.html',
                    '/admin.html'
                ].includes(cleanPath.toLowerCase());

            const projectMatch = cleanPath.match(/^\/project\/([^/]+)$/i);
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
                const response404 = await fetch(url.origin + '/404');
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
            const assetUrl = new URL(url.pathname + url.search, assetHost);
            const assetRequest = isValidProject
                ? new Request(`${assetHost}/`, request)
                : new Request(assetUrl.toString(), request);
            const response = await env.ASSETS.fetch(assetRequest);

            // If it's a valid project route and the response is HTML, rewrite the meta tags and drop homepage blocks
            if (isValidProject && project && response.headers.get('content-type')?.includes('text/html')) {
                return new HTMLRewriter()
                    .on('title', new MetaRewriter(project))
                    .on('meta[property="og:title"]', new MetaRewriter(project))
                    .on('meta[property="og:description"]', new MetaRewriter(project))
                    .on('meta[property="og:image"]', new MetaRewriter(project))
                    .on('meta[name="description"]', new MetaRewriter(project))
                    .on('link[rel="canonical"]', new MetaRewriter(project))
                    .on('script#schema-data', new SchemaRewriter(project))
                    .on('link#lcp-preload', new PreloadRewriter(project))
                    // Strip out the heavy homepage nodes so Google doesn't flag duplicate content
                    .on('.top-row', { element(el) { el.remove(); } })
                    .on('.filter-container', { element(el) { el.remove(); } })
                    .on('#projects-grid', { element(el) { el.remove(); } })
                    .transform(response);
            }

            if (cleanPath === '/admin.html') {
                // Fetch the asset using '/admin' internally to bypass Workers Assets' clean URL redirect (.html -> extensionless)
                // We use the hostname inside assetHost to prevent recursion loops
                const rewrittenRequest = new Request(`${assetHost}/admin`, request);
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
            return new Response(`Worker Error: ${err.message}\nStack: ${err.stack}`, {
                status: 500,
                headers: { 'Content-Type': 'text/plain' }
            });
        }
    }
};
