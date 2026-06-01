import { myProjects } from './assets/js/project-data.js';

/**
 * Cloudflare Worker for Ryan March | Product & Technology
 * Intercepts requests to /project/* and injects dynamic SEO/OG tags
 */

class MetaRewriter {
    constructor(project) {
        this.project = project;
        this.fullTitle = `${this.project.title} | Ryan March`;
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
                element.setAttribute('content', this.project.subtitle);
            } else if (name === 'description') {
                element.setAttribute('content', this.project.subtitle);
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
        const url = new URL(request.url);
        const path = url.pathname;

        // Fetch the original asset from Cloudflare Pages / Static handling
        const response = await env.ASSETS.fetch(request);

        // Check if the route is a project route
        const projectMatch = path.match(/^\/project\/([^\/]+)\/?/);

        // If it's a project route and the response is HTML, rewrite the meta tags
        if (projectMatch && response.headers.get('content-type')?.includes('text/html')) {
            const projectId = projectMatch[1];
            const project = myProjects.find(p => p.id === projectId);

            if (project) {
                // Return the rewritten HTML
                return new HTMLRewriter()
                    .on('title', new MetaRewriter(project))
                    .on('meta[property="og:title"]', new MetaRewriter(project))
                    .on('meta[property="og:description"]', new MetaRewriter(project))
                    .on('meta[name="description"]', new MetaRewriter(project))
                    .on('link[rel="canonical"]', new MetaRewriter(project))
                    .transform(response);
            }
        }

        // Return unchanged response for all other paths
        return response;
    }
};
