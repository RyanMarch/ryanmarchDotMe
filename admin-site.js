/**
 * Admin API handlers for site content that lives outside project-data.js:
 * embed scans, the media library (repo images + R2), repo activity, and a
 * configuration status page. Routed from admin-api.js.
 */
import { adminEmail, ghJson, jsonResponse, safeBranch, withEditor } from './admin-http.js';
import { audioSignature, imageStem, r2KeyFromUrl, scanProjectHtml } from './public/assets/js/admin/scan.js';

const ID_PATTERN = /^[a-z0-9_-]+$/i;
const IMAGE_EXT = /\.(avif|webp|png|jpe?g|gif|svg|ico)$/i;

/* ───────────── /scan?project= ───────────── */

/**
 * Asks for the first bytes of an audio file and reports what came back: status, content type, total size,
 * whether byte ranges work (a player needs them to seek), and the format named by the file's own header.
 * Reads only the first chunk, never the whole file.
 */
export async function probeAudio(fetchImpl, url) {
    try {
        const res = await fetchImpl(url, { headers: { Range: 'bytes=0-11' } });
        const out = {
            status: res.status,
            type: (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(),
            ranges: res.status === 206 || /bytes/i.test(res.headers.get('accept-ranges') || ''),
            bytes: null
        };
        const total = res.headers.get('content-range')?.match(/\/(\d+)$/)?.[1] ?? (res.status === 200 ? res.headers.get('content-length') : null);
        if (total !== null && total !== undefined && total !== '') out.bytes = Number(total);
        if (res.ok && res.body) {
            const reader = res.body.getReader();
            const { value } = await reader.read();
            await reader.cancel().catch(() => {});
            if (value && value.length) out.signature = audioSignature(value);
            else if (out.bytes === null || out.bytes === 0) out.bytes = 0;
        } else if (res.body) {
            await res.body.cancel().catch(() => {});
        }
        return out;
    } catch {
        return { status: 0 };
    }
}

export async function handleScan(request, env, url, fetchImpl, ctx) {
    const id = url.searchParams.get('project');
    const project = ID_PATTERN.test(id || '') && ctx.projects.find(p => p.id === id);
    if (!project) return jsonResponse({ error: 'not_found', message: `No project "${id}".` }, 404);
    if (!project.hasExtendedContent) return jsonResponse({ project: id, images: [], audio: [], videos: [] });
    if (!ctx.assetFetch) return jsonResponse({ error: 'not_configured', message: 'Asset access unavailable.' }, 501);

    const res = await ctx.assetFetch(`/content/${id}/`);
    if (!res.ok) return jsonResponse({ error: 'not_found', message: `No write-up at /content/${id}/ (${res.status}).` }, 404);
    const scan = scanProjectHtml(await res.text());

    // Check each embed against the live source (bounded, to stay inside subrequest limits).
    const audio = await Promise.all(scan.audio.slice(0, 8).map(async a => ({
        ...a, key: r2KeyFromUrl(a.src), ...(await probeAudio(fetchImpl, a.src))
    })));
    const videos = await Promise.all(scan.videos.slice(0, 8).map(async v => {
        try {
            const r = await fetchImpl(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v.id}`)}`);
            const info = r.ok ? await r.json() : null;
            return { ...v, status: r.status, title: info?.title || '' };
        } catch {
            return { ...v, status: 0, title: '' };
        }
    }));
    return jsonResponse({ project: id, images: scan.images, audio, videos });
}

/* ───────────── /media and /media/r2 ───────────── */

async function listR2(bucket) {
    const objects = [];
    let cursor;
    for (let page = 0; page < 5; page++) {
        const res = await bucket.list({ limit: 1000, cursor });
        for (const o of res.objects) objects.push({ key: o.key, size: o.size, uploaded: o.uploaded?.toISOString?.() || o.uploaded });
        if (!res.truncated) break;
        cursor = res.cursor;
    }
    return objects;
}

export async function handleMedia(request, env, url, fetchImpl) {
    const out = { repo: null, r2: { available: Boolean(env.MEDIA), objects: [] } };

    if (env.GITHUB_REPO && env.GITHUB_PAT) {
        const branch = safeBranch(url.searchParams.get('branch'));
        try {
            const tree = await ghJson(env, `git/trees/${encodeURIComponent(branch)}?recursive=1`, fetchImpl);
            const files = (tree.tree || [])
                .filter(t => t.type === 'blob' && t.path.startsWith('public/') && IMAGE_EXT.test(t.path)
                    && (t.path.startsWith('public/content/') || t.path.startsWith('public/assets/img/')))
                .map(t => ({ path: t.path.slice('public/'.length), size: t.size || 0 }));
            out.repo = { branch, files, truncated: Boolean(tree.truncated) };
        } catch (err) {
            out.repoError = err.message;
        }
    }
    if (env.MEDIA) {
        try { out.r2.objects = await listR2(env.MEDIA); } catch (err) { out.r2.error = err.message; }
    }
    return jsonResponse(out);
}

/* ───────────── DELETE /media/image?path= (repo images only) ───────────── */

// Only image files in a project's images folder or the global image folder. Never HTML, data or config.
export const DELETABLE_IMAGE = /^(?:assets\/img|content\/[a-z0-9_-]+\/images)\/[A-Za-z0-9._-]+\.(?:avif|webp|png|jpe?g|gif|svg)$/i;

export async function handleImageDelete(request, env, url, fetchImpl, ctx = {}) {
    if (!env.GITHUB_REPO || !env.GITHUB_PAT) return jsonResponse({ error: 'not_configured', message: 'GitHub access is not configured.' }, 501);
    const path = url.searchParams.get('path') || '';
    const branch = safeBranch(url.searchParams.get('branch'));
    if (!DELETABLE_IMAGE.test(path) || path.includes('..')) {
        return jsonResponse({ error: 'bad_path', message: 'Only image files in a project images folder or assets/img can be deleted here.' }, 400);
    }

    // A project's card and share images must be changed on the project first, or its page breaks.
    const stem = imageStem(path);
    const owner = (ctx.projects || []).find(p => [p.image, p.ogImage].some(img => img && imageStem(img) === stem));
    if (owner) {
        return jsonResponse({ error: 'in_use', message: `This is the card or share image for ${owner.title}. Change that project's image first.` }, 409);
    }

    const headers = {
        'Authorization': `token ${env.GITHUB_PAT}`,
        'User-Agent': `${env.GITHUB_REPO.split('/').pop()}-Cloudflare-Worker`,
        'Accept': 'application/vnd.github+json'
    };
    const api = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/public/${path}`;
    const found = await fetchImpl(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
    if (found.status === 404) return jsonResponse({ error: 'not_found', message: `${path} does not exist on ${branch}.` }, 404);
    if (!found.ok) return jsonResponse({ error: 'github_error', message: `GitHub returned ${found.status}.` }, 502);
    const { sha } = await found.json();

    const res = await fetchImpl(api, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: withEditor(`admin: delete image ${path}`, adminEmail(request)), sha, branch })
    });
    if (!res.ok) return jsonResponse({ error: 'github_error', message: `GitHub returned ${res.status}.` }, res.status === 403 ? 403 : 502);
    const done = await res.json().catch(() => ({}));
    return jsonResponse({ deleted: path, branch, commit: done.commit?.sha || null });
}

/* ───────────── GET /build?sha= (is a commit built and live?) ───────────── */

/** A REST check-run in the same shape GraphQL gives, so one normaliser serves both. */
export const normalizeRestCheck = c => normalizeCheck({
    __typename: 'CheckRun',
    name: c.name,
    status: String(c.status || '').toUpperCase(),
    conclusion: String(c.conclusion || '').toUpperCase(),
    detailsUrl: c.html_url || c.details_url || '',
    checkSuite: { app: { name: c.app?.name || '' } }
});

export async function handleBuild(request, env, url, fetchImpl) {
    if (!env.GITHUB_REPO || !env.GITHUB_PAT) return jsonResponse({ error: 'not_configured', message: 'GitHub access is not configured.' }, 501);
    const sha = url.searchParams.get('sha') || '';
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) return jsonResponse({ error: 'bad_sha', message: 'A commit id is required.' }, 400);
    try {
        const data = await ghJson(env, `commits/${sha}/check-runs?per_page=30`, fetchImpl);
        const checks = (data.check_runs || []).map(normalizeRestCheck);
        const state = !checks.length ? 'none' : checks.some(c => c.state === 'failed') ? 'failed' : checks.some(c => c.state === 'pending') ? 'pending' : 'ok';
        return jsonResponse({ sha: sha.slice(0, 7), state, checks });
    } catch (err) {
        const denied = /GitHub (401|403|404)/.test(err.message);
        return jsonResponse({ error: denied ? 'needs_checks_permission' : 'github_error', message: denied ? 'The GitHub token needs Checks (read) access.' : err.message }, denied ? 403 : 502);
    }
}

const R2_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', zip: 'application/zip', aup3: 'application/octet-stream' };
const R2_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
export const R2_MAX_BYTES = 95 * 1024 * 1024;

export async function handleR2(request, env, url) {
    if (!env.MEDIA) return jsonResponse({ error: 'not_configured', message: 'The MEDIA R2 binding is not configured.' }, 501);
    const key = url.searchParams.get('key') || '';
    if (!R2_KEY.test(key)) return jsonResponse({ error: 'bad_key', message: 'Use letters, numbers, dots, dashes and underscores (max 120 characters).' }, 400);

    if (request.method === 'DELETE') {
        const existing = await env.MEDIA.head(key);
        if (!existing) return jsonResponse({ error: 'not_found', message: `${key} does not exist.` }, 404);
        await env.MEDIA.delete(key);
        return jsonResponse({ deleted: key });
    }

    // PUT: upload
    const ext = key.split('.').pop().toLowerCase();
    if (!R2_TYPES[ext]) return jsonResponse({ error: 'bad_type', message: `Allowed types: ${Object.keys(R2_TYPES).join(', ')}.` }, 400);
    const length = Number(request.headers.get('content-length') || 0);
    if (!length) return jsonResponse({ error: 'empty', message: 'Empty upload.' }, 400);
    if (length > R2_MAX_BYTES) return jsonResponse({ error: 'too_large', message: 'Files over 95 MB must be uploaded with dev/upload_media.py.' }, 413);
    if (url.searchParams.get('overwrite') !== '1' && (await env.MEDIA.head(key))) {
        return jsonResponse({ error: 'exists', message: `${key} already exists.` }, 409);
    }
    await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: R2_TYPES[ext] } });
    return jsonResponse({ uploaded: key, size: length });
}

/* ───────────── /activity ───────────── */

const HISTORY_QUERY = `query($owner: String!, $name: String!, $ref: String!) {
  repository(owner: $owner, name: $name) {
    ref(qualifiedName: $ref) {
      target { ... on Commit { history(first: 30) { nodes {
        oid message committedDate url author { name }
        statusCheckRollup { state contexts(first: 12) { nodes {
          __typename
          ... on CheckRun { name status conclusion detailsUrl checkSuite { app { name } } }
          ... on StatusContext { context state targetUrl }
        } } }
      } } } }
    }
  }
}`;

const FAILED = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR']);
const OK = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED']);

/** One check or status → { name, state: 'ok' | 'failed' | 'pending', url }. */
export function normalizeCheck(node) {
    if (node.__typename === 'StatusContext') {
        return { name: node.context, state: node.state === 'SUCCESS' ? 'ok' : FAILED.has(node.state) ? 'failed' : 'pending', url: node.targetUrl || '' };
    }
    const label = /workers builds/i.test(node.name) || /cloudflare/i.test(node.checkSuite?.app?.name || '') ? 'Build' : node.checkSuite?.app?.name === 'GitHub Actions' ? 'Tests' : node.name;
    const state = node.status !== 'COMPLETED' ? 'pending' : OK.has(node.conclusion) ? 'ok' : FAILED.has(node.conclusion) ? 'failed' : 'ok';
    return { name: label, state, url: node.detailsUrl || '' };
}

async function historyWithChecks(env, branch, fetchImpl) {
    const [owner, name] = env.GITHUB_REPO.split('/');
    const res = await fetchImpl('https://api.github.com/graphql', {
        method: 'POST',
        headers: { 'Authorization': `bearer ${env.GITHUB_PAT}`, 'User-Agent': `${name}-Cloudflare-Worker`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: HISTORY_QUERY, variables: { owner, name, ref: `refs/heads/${branch}` } })
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const data = await res.json();
    const nodes = data?.data?.repository?.ref?.target?.history?.nodes;
    if (!nodes) throw new Error(data?.errors?.[0]?.message || 'no history');
    return nodes.map(n => ({
        sha: n.oid.slice(0, 7),
        message: (n.message || '').split('\n')[0],
        author: n.author?.name || '',
        date: n.committedDate,
        url: n.url,
        checks: n.statusCheckRollup ? n.statusCheckRollup.contexts.nodes.map(normalizeCheck) : null
    }));
}

export async function handleActivity(request, env, url, fetchImpl) {
    const out = { branch: null, commits: null, checksAvailable: false, pending: null, deploys: null };
    const branch = safeBranch(url.searchParams.get('branch'));
    out.branch = branch;

    if (env.GITHUB_REPO && env.GITHUB_PAT) {
        try {
            out.commits = await historyWithChecks(env, branch, fetchImpl);
        } catch {
            // GraphQL unavailable for this token: fall back to plain commits (no per-commit check status).
            try {
                const list = await ghJson(env, `commits?sha=${encodeURIComponent(branch)}&per_page=30`, fetchImpl);
                out.commits = list.map(c => ({ sha: c.sha.slice(0, 7), message: (c.commit.message || '').split('\n')[0], author: c.commit.author?.name || '', date: c.commit.author?.date, url: c.html_url, checks: null }));
            } catch (err) { out.commitsError = err.message; }
        }
        out.checksAvailable = Boolean(out.commits?.some(c => c.checks));
        if (branch === 'main') {
            try {
                const cmp = await ghJson(env, 'compare/main...develop', fetchImpl);
                out.pending = { ahead: cmp.ahead_by || 0 };
            } catch { /* no develop branch, or no access */ }
        }
    }

    if (env.CF_API_TOKEN && env.CF_ACCOUNT_ID) {
        const script = env.CF_WORKER_NAME || 'ryanmarchdotme';
        try {
            const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${script}/deployments`, {
                headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` }
            });
            const body = await res.json();
            if (!res.ok || body.success === false) {
                out.deploysError = res.status === 403 || res.status === 401
                    ? 'The Cloudflare token needs Workers Scripts: Read to show deployments.'
                    : `Cloudflare returned ${res.status}.`;
            } else {
                out.deploys = (body.result?.deployments || []).slice(0, 6).map(d => ({
                    id: (d.id || '').slice(0, 8), created: d.created_on, source: d.source, message: d.annotations?.['workers/message'] || '',
                    versions: (d.versions || []).map(v => ({ id: (v.version_id || '').slice(0, 8), percentage: v.percentage }))
                }));
            }
        } catch (err) {
            out.deploysError = err.message;
        }
    }
    return jsonResponse(out);
}

/* ───────────── /status ───────────── */

export async function handleStatus(request, env) {
    const has = (...names) => names.every(n => Boolean(env[n]));
    return jsonResponse({
        items: [
            { key: 'analytics', label: 'Cloudflare analytics', ok: has('CF_API_TOKEN', 'CF_ACCOUNT_ID'), detail: 'CF_API_TOKEN, CF_ACCOUNT_ID', host: env.CF_ANALYTICS_HOST || 'ryanmarch.me' },
            { key: 'github', label: 'GitHub access (editor, commits)', ok: has('GITHUB_REPO', 'GITHUB_PAT'), detail: 'GITHUB_REPO, GITHUB_PAT' },
            { key: 'r2', label: 'R2 media bucket', ok: Boolean(env.MEDIA), detail: 'MEDIA binding (ryanmarchdotme-media)' },
            { key: 'kv', label: 'KV cache for analytics', ok: Boolean(env.ADMIN_KV), detail: 'ADMIN_KV binding (optional)', optional: true },
            { key: 'access', label: 'Access sign-in verification', ok: has('CF_ACCESS_TEAM_DOMAIN', 'CF_ACCESS_AUD'), detail: 'CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD (recommended)', optional: true },
            { key: 'password', label: 'Admin password fallback', ok: !has('ADMIN_PASSWORD'), invert: true, detail: has('ADMIN_PASSWORD') ? 'ADMIN_PASSWORD is set; remove it in production' : 'Not set (good)', optional: false }
        ]
    });
}
