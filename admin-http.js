// Small helpers shared by the admin API modules.

export const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
};

export function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export async function ghJson(env, path, fetchImpl = fetch) {
    const res = await fetchImpl(`https://api.github.com/repos/${env.GITHUB_REPO}/${path}`, {
        headers: {
            'Authorization': `token ${env.GITHUB_PAT}`,
            'User-Agent': `${env.GITHUB_REPO.split('/').pop()}-Cloudflare-Worker`,
            'Accept': 'application/vnd.github+json'
        }
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    return res.json();
}

export const safeBranch = value => (/^[\w./-]+$/.test(value || '') ? value : 'main');
