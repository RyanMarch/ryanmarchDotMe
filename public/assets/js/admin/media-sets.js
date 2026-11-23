// Groups repo image files into folders and "sets" (one picture in several formats).
// Pure functions so the Media view and the tests share them.
//
// Site convention (dev/make-image-variants.mjs): name.avif is the full-size AVIF, name.png (or
// .jpg) is its fallback, and name-360.avif / name-640.avif are smaller renditions.

const FALLBACK = new Set(['png', 'jpg', 'jpeg', 'webp']);
const VARIANT = /^(.*)-(\d{3,4}|sm)$/;
// Social share images are JPEG on purpose (crawlers don't render AVIF).
const IS_SHARE = name => /(^|-)og(-image)?$/i.test(name);

export const dirOf = path => path.split('/').slice(0, -1).join('/');

export function parseImage(file) {
    const base = file.path.split('/').pop();
    const dot = base.lastIndexOf('.');
    const ext = (dot === -1 ? '' : base.slice(dot + 1)).toLowerCase();
    const name = dot === -1 ? base : base.slice(0, dot);
    const m = name.match(VARIANT);
    return { ...file, dir: dirOf(file.path), base, ext, name, set: m ? m[1] : name, variant: m ? m[2] : null };
}

/** One entry per picture in a folder, with its pairing status. */
export function groupSets(files) {
    const sets = new Map();
    for (const f of files.map(parseImage)) {
        const key = `${f.dir}/${f.set}`;
        if (!sets.has(key)) sets.set(key, { key, dir: f.dir, name: f.set, files: [] });
        sets.get(key).files.push(f);
    }
    return [...sets.values()].map(s => {
        const main = ext => s.files.find(f => f.ext === ext && !f.variant);
        const fallback = s.files.find(f => FALLBACK.has(f.ext) && !f.variant && f.ext !== 'webp')
            || s.files.find(f => f.ext === 'webp' && !f.variant);
        const avif = main('avif');
        const resizedAvif = s.files.some(f => f.ext === 'avif' && f.variant);
        let status = 'other';
        if (fallback && !IS_SHARE(s.name)) status = avif ? 'paired' : resizedAvif ? 'resized-only' : 'missing-avif';
        else if (!fallback && avif) status = 'avif-only';
        const files2 = [...s.files].sort((a, b) => (a.variant ? 1 : 0) - (b.variant ? 1 : 0) || a.ext.localeCompare(b.ext) || a.base.localeCompare(b.base, undefined, { numeric: true }));
        const preview = (avif || fallback || files2[0]).path;
        const savings = status === 'paired' && fallback.size > 0 ? Math.round((1 - avif.size / fallback.size) * 100) : null;
        return { ...s, files: files2, status, fallback, avif, preview, savings, bytes: s.files.reduce((n, f) => n + f.size, 0) };
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** Display name for a folder: the project title for content/<id>/images, "Site images" for assets/img. */
export function folderTitle(dir, projects = []) {
    if (dir === 'assets/img') return 'Site images';
    const m = dir.match(/^content\/([^/]+)\/images(?:\/(.+))?$/);
    if (m) return `${projects.find(p => p.id === m[1])?.title || m[1]}${m[2] ? ` / ${m[2]}` : ''}`;
    return dir;
}

/** Folders with counts, for the browser's top level. Site images first, then A to Z. */
export function buildFolders(files, projects = []) {
    const byDir = new Map();
    for (const f of files) {
        const d = dirOf(f.path);
        if (!byDir.has(d)) byDir.set(d, []);
        byDir.get(d).push(f);
    }
    return [...byDir].map(([dir, list]) => {
        const sets = groupSets(list);
        return {
            dir,
            title: folderTitle(dir, projects),
            images: list.length,
            bytes: list.reduce((n, f) => n + f.size, 0),
            missingAvif: sets.filter(s => s.status === 'missing-avif').length,
            resizedOnly: sets.filter(s => s.status === 'resized-only').length
        };
    }).sort((a, b) => (a.dir === 'assets/img' ? -1 : b.dir === 'assets/img' ? 1 : a.title.localeCompare(b.title)));
}

/** URL segments for a folder: assets/img → ["site-images"], content/ledger/images → ["ledger"], .../images/sub → ["ledger","sub"]. */
export function folderSlug(dir) {
    if (dir === 'assets/img') return ['site-images'];
    const m = dir.match(/^content\/([^/]+)\/images(?:\/(.+))?$/);
    if (m) return [m[1], ...(m[2] ? m[2].split('/') : [])];
    return ['dir', dir];
}

/** The folder a URL points at, or '' when it matches none of `dirs`. */
export function dirFromSlug(rest, dirs) {
    if (!rest.length) return '';
    const key = rest.join('/');
    return dirs.find(d => folderSlug(d).join('/') === key) || '';
}
