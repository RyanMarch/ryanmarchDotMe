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

const b64urlJson = part => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));

/**
 * The signed-in person's email, for commit attribution. Only call this after isAdminRequest said yes:
 * it reads the (already verified) Access token, or the header Access adds. Null for the local password.
 */
export function adminEmail(request) {
    try {
        const jwt = request.headers.get('cf-access-jwt-assertion');
        const email = jwt ? b64urlJson(jwt.split('.')[1]).email : request.headers.get('cf-access-authenticated-user-email');
        return typeof email === 'string' && /^[^\s@<>]+@[^\s@<>]+$/.test(email) ? email : null;
    } catch {
        return null;
    }
}

/** Adds an "Edited-by" trailer under the first line, which keeps the "admin:" prefix the Activity page filters on. */
export function withEditor(message, email) {
    return email ? `${message}\n\nEdited-by: ${email}` : message;
}

