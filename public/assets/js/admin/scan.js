// Pulls media references out of a project write-up (an HTML fragment).
// Pure: used by the Worker (per-project scans) and by tests.

const MEDIA_CDN = 'https://media.ryanmarch.me/';

const stripComments = html => html.replace(/<!--[\s\S]*?-->/g, '');
const attrOf = (tag, name) => {
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
    return m ? (m[1] ?? m[2]) : null;
};
const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Site-relative image path ("content/x/images/a.avif"), or null for external/data URLs. */
export function localPath(src) {
    if (!src || /^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return null;
    return src.split(/[?#]/)[0].replace(/^\.?\/+/, '');
}

/** Mirrors audio-player.js: relative project audio paths resolve to the R2 CDN. */
export function resolveAudioSrc(raw) {
    return raw.replace(/(?:\.\/)?content\/[^/]+\/audio\/([^"]+\.mp3)/g, `${MEDIA_CDN}$1`);
}

export function scanProjectHtml(rawHtml) {
    const html = stripComments(rawHtml);
    const images = new Set();

    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
        const p = localPath(attrOf(m[0], 'src'));
        if (p) images.add(p);
    }
    for (const m of html.matchAll(/\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
        for (const candidate of (m[1] ?? m[2]).split(',')) {
            const p = localPath(candidate.trim().split(/\s+/)[0]);
            if (p) images.add(p);
        }
    }

    const audio = [];
    for (const m of html.matchAll(/<div\b[^>]*custom-audio-player[^>]*>([\s\S]*?)<\/div>/gi)) {
        const start = m[0].match(/<div\b[^>]*>/i)[0];
        const inner = m[1].match(/<audio\b[^>]*>/i)?.[0] || '';
        const raw = attrOf(inner, 'src') || attrOf(start, 'data-src');
        if (!raw) continue;
        audio.push({
            src: resolveAudioSrc(decode(raw)),
            title: decode(attrOf(start, 'data-title') || ''),
            subtitle: decode(attrOf(start, 'data-subtitle') || '')
        });
    }
    // Bare <audio> tags outside a custom player.
    for (const m of html.matchAll(/<audio\b[^>]*>/gi)) {
        const raw = attrOf(m[0], 'src');
        const src = raw && resolveAudioSrc(decode(raw));
        if (src && !audio.some(a => a.src === src)) audio.push({ src, title: '', subtitle: '' });
    }

    const videos = [];
    const seen = new Set();
    for (const m of html.matchAll(/(?:youtube-nocookie\.com\/embed\/|youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/gi)) {
        if (!seen.has(m[1])) { seen.add(m[1]); videos.push({ id: m[1] }); }
    }

    return { images: [...images], audio, videos };
}

/** The R2 object key behind a CDN URL, or null if it isn't one of ours. */
export function r2KeyFromUrl(src) {
    return src.startsWith(MEDIA_CDN) ? decodeURIComponent(src.slice(MEDIA_CDN.length).split(/[?#]/)[0]) : null;
}

/* ───── Which repo images are referenced? ───── */

/** "content/x/images/card-640.avif" and "card.png" both reduce to "content/x/images/card". */
export function imageStem(path) {
    return path.replace(/^\/+/, '').replace(/\.[a-z0-9]+$/i, '').replace(/-(?:\d{2,4}|small|sm|lg|large)$/i, '').toLowerCase();
}

/** Stems of every image the site data and the scanned write-ups point at. */
export function referencedStems(projects, scans) {
    const stems = new Set();
    const add = p => { if (p) stems.add(imageStem(p)); };
    for (const p of projects) { add(p.image); add(p.ogImage); }
    for (const s of scans) for (const img of s.images || []) add(img);
    return stems;
}

/** Names the audio format from a file's first bytes, or null when they match no known audio format. */
export function audioSignature(b) {
    if (!b || b.length < 4) return null;
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3'; // ID3 tag
    if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) return 'mp3'; // MPEG frame sync
    if (b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'm4a'; // "ftyp"
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'wav'; // "RIFF"
    if (b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'ogg'; // "OggS"
    if (b[0] === 0x66 && b[1] === 0x4C && b[2] === 0x61 && b[3] === 0x43) return 'flac'; // "fLaC"
    return null;
}

// This site and its media host. Your other apps on ryanmarch.me subdomains (filenamer., iconstudio. ...) are checked like any outside link.
const OWN_HOSTS = /^(www\.|media\.)?ryanmarch\.me$/i;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\]|.*\.(local|internal|localhost)$)/i;

/** The distinct outside web links in a write-up (not this site, not mailto/tel/#, nothing private), in order. */
export function externalLinks(rawHtml, limit = 40) {
    const html = stripComments(rawHtml);
    const seen = new Set();
    const out = [];
    for (const m of html.matchAll(/<a\b[^>]*>/gi)) {
        const href = attrOf(m[0], 'href');
        if (!href || !/^https?:\/\//i.test(href.trim())) continue;
        let url;
        try { url = new URL(decode(href.trim())); } catch { continue; }
        if (OWN_HOSTS.test(url.hostname) || PRIVATE_HOST.test(url.hostname)) continue;
        url.hash = '';
        const key = url.toString();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(key);
        if (out.length >= limit) break;
    }
    return out;
}

/** How a link answered: ok, broken (gone or unreachable), or unverified (the site refuses automated checks). */
export function classifyLink(status) {
    if (status >= 200 && status < 400) return 'ok';
    if (status === 404 || status === 410 || status === 0) return 'broken';
    return 'unverified';
}
