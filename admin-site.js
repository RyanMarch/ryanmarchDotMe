/**
 * Admin API handlers for site content that lives outside project-data.js:
 * embed scans, the media library (repo images + R2), repo activity, and a
 * configuration status page. Routed from admin-api.js.
 */
import { ghJson, jsonResponse, safeBranch } from './admin-http.js';
import { r2KeyFromUrl, scanProjectHtml } from './public/assets/js/admin/scan.js';

const ID_PATTERN = /^[a-z0-9_-]+$/i;
const IMAGE_EXT = /\.(avif|webp|png|jpe?g|gif|svg|ico)$/i;

/* ───────────── /scan?project= ───────────── */

async function headStatus(fetchImpl, url) {
    try {
        let res = await fetchImpl(url, { method: 'HEAD' });
        if (res.status === 405 || res.status === 403) res = await fetchImpl(url, { headers: { Range: 'bytes=0-0' } });
        return res.status;
    } catch {
        return 0;
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
        ...a, key: r2KeyFromUrl(a.src), status: await headStatus(fetchImpl, a.src)
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

export async function handleActivity(request, env, url, fetchImpl) {
    const out = { commits: null, runs: null, checks: null, deploys: null };
    const branch = safeBranch(url.searchParams.get('branch'));
    out.branch = branch;

    if (env.GITHUB_REPO && env.GITHUB_PAT) {
        const settle = async (key, path, map) => {
            try { out[key] = map(await ghJson(env, path, fetchImpl)); } catch (err) { out[`${key}Error`] = err.message; }
        };
        await Promise.all([
            settle('commits', `commits?sha=${encodeURIComponent(branch)}&per_page=30`, list => list.map(c => ({
                sha: c.sha.slice(0, 7),
                message: (c.commit.message || '').split('\n')[0],
                author: c.commit.author?.name || '',
                date: c.commit.author?.date,
                url: c.html_url
            }))),
            settle('runs', `actions/runs?branch=${encodeURIComponent(branch)}&per_page=6`, d => (d.workflow_runs || []).map(r => ({
                name: r.name, status: r.status, conclusion: r.conclusion, date: r.created_at, url: r.html_url, sha: (r.head_sha || '').slice(0, 7)
            }))),
            settle('checks', `commits/${encodeURIComponent(branch)}/check-runs?per_page=10`, d => (d.check_runs || []).map(c => ({
                name: c.name, app: c.app?.name || '', status: c.status, conclusion: c.conclusion, url: c.html_url
            })))
        ]);
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
