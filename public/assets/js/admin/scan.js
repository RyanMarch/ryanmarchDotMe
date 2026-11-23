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
