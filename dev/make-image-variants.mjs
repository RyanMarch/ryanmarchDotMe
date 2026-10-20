#!/usr/bin/env node
/**
 * make-image-variants.mjs
 *
 * Turns one oversized hero/screenshot into the responsive set the site expects:
 *
 *   <name>-360.avif, <name>-640.avif   smaller renditions (srcset candidates)
 *   <name>.avif                        largest rendition (the project's `image`)
 *   <name>.png                         fallback for the largest rendition
 *   og.jpg (with --og)                 1200x630 social share image (crawlers don't render AVIF)
 *
 * Usage:
 *   npm run image-variants -- content/my-project/images/hero.png
 *   npm run image-variants -- content/my-project/images/hero.avif --widths 360,640,1200 --og --project my-project
 *
 * Options:
 *   --widths a,b,c   target widths in px (default 360,640,1200). Widths larger than the source are skipped.
 *   --og-only        only write og.jpg (skip the AVIF/PNG variants); handy for existing projects
 *   --og             also write og.jpg next to the source (source is letterboxed onto its own background colour)
 *   --project <id>   write image, imageWidth, imageHeight, imageWidths (and ogImage) into assets/js/project-data.js
 *   --og-bg <colour> letterbox colour for og.jpg (default: sampled from the image corner, black if transparent)
 *   --quality <n>    AVIF quality 0-100 (default 60)
 *
 * Requires ImageMagick (`magick`) built with AVIF support (brew install imagemagick).
 * The source file may be overwritten (e.g. shrinking hero.avif in place); it is read into memory first.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const projectRoot = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'public');

function parseArgs(argv) {
    const args = { widths: [360, 640, 1200], og: false, project: null, quality: 60, source: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--og') args.og = true;
        else if (a === '--og-only') { args.og = true; args.ogOnly = true; }
        else if (a === '--widths') args.widths = argv[++i].split(',').map(Number).filter(Boolean);
        else if (a === '--project') args.project = argv[++i];
        else if (a === '--quality') args.quality = Number(argv[++i]);
        else if (a === '--og-bg') args.ogBg = argv[++i];
        else if (!a.startsWith('--')) args.source = a;
    }
    return args;
}

function magick(args) {
    return execFileSync('magick', args, { encoding: 'utf8' }).trim();
}

function fail(msg) {
    console.error(`❌ ${msg}`);
    process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (!args.source) fail('Usage: npm run image-variants -- <image> [--widths 360,640,1200] [--og] [--project <id>]');

// Accept site-style paths ("/content/x/images/y.avif") as well as ordinary file paths.
const siteRelative = path.join(projectRoot, args.source);
const sourcePath = !fs.existsSync(args.source) && fs.existsSync(siteRelative) ? siteRelative : path.resolve(process.cwd(), args.source);
if (!fs.existsSync(sourcePath)) fail(`Source not found: ${args.source}`);
try { magick(['-version']); } catch { fail('ImageMagick (`magick`) is required: brew install imagemagick'); }

const dir = path.dirname(sourcePath);
const name = path.basename(sourcePath, path.extname(sourcePath));

// Work from a temp copy so the source can be overwritten safely.
const tmp = path.join(os.tmpdir(), `variants-${process.pid}${path.extname(sourcePath)}`);
fs.copyFileSync(sourcePath, tmp);

try {
    const [srcW, srcH] = magick(['identify', '-format', '%w %h', `${tmp}[0]`]).split(' ').map(Number);
    const widths = [...new Set(args.widths)].filter(w => w <= srcW).sort((a, b) => a - b);
    if (!args.ogOnly && widths.length === 0) fail(`Source is only ${srcW}px wide; every requested width is larger.`);
    const largest = widths[widths.length - 1] ?? srcW;

    const kb = f => `${Math.round(fs.statSync(f).size / 1024)} KB`;
    const rel = f => path.relative(projectRoot, f);
    const encodeAvif = (w, out) => magick([`${tmp}[0]`, '-resize', `${w}x`, '-strip', '-quality', String(args.quality), '-define', 'heic:speed=4', out]);

    console.log(`Source: ${rel(sourcePath)} (${srcW}x${srcH})`);
    for (const w of args.ogOnly ? [] : widths) {
        const out = path.join(dir, w === largest ? `${name}.avif` : `${name}-${w}.avif`);
        encodeAvif(w, out);
        console.log(`  ✅ ${rel(out)}  ${w}px  ${kb(out)}`);
    }

    // The PNG only serves browsers without AVIF support, so keep it small rather than matching the largest AVIF.
    const pngW = Math.min(largest, 800);
    const png = path.join(dir, `${name}.png`);
    if (!args.ogOnly) {
        magick([`${tmp}[0]`, '-resize', `${pngW}x`, '-strip', '-define', 'png:compression-level=9', png]);
        console.log(`  ✅ ${rel(png)}  ${pngW}px  ${kb(png)} (fallback)`);
    }

    const largestH = Math.round(largest * srcH / srcW);
    let ogRel = null;
    if (args.og) {
        // Sample the corner for the letterbox colour; JPEG has no alpha, so fall back to black when it's transparent.
        const sampled = magick([`${tmp}[0]`, '-format', '%[pixel:p{4,4}]', 'info:']);
        const bg = args.ogBg || (/srgba\(.*,0\)$/.test(sampled) || sampled === 'none' ? 'black' : sampled);
        const ogPath = path.join(dir, 'og.jpg');
        magick([`${tmp}[0]`, '-resize', '1200x630>', '-background', bg, '-gravity', 'center', '-extent', '1200x630', '-strip', '-quality', '88', ogPath]);
        ogRel = rel(ogPath);
        console.log(`  ✅ ${ogRel}  1200x630  ${kb(ogPath)} (letterboxed on ${bg})`);
    }

    const imageRel = rel(path.join(dir, `${name}.avif`));
    const fields = args.ogOnly
        ? { ogImage: ogRel }
        : { image: imageRel, imageWidth: largest, imageHeight: largestH, imageWidths: widths, ...(ogRel && { ogImage: ogRel }) };

    if (args.project) {
        const dataPath = path.join(projectRoot, 'assets/js/project-data.js');
        let data = fs.readFileSync(dataPath, 'utf8');
        const start = data.indexOf(`id: "${args.project}"`);
        if (start === -1) fail(`No project with id "${args.project}" in project-data.js`);
        const endMarker = data.indexOf('\n    }', start);
        let block = data.slice(start, endMarker);

        const fmt = v => (Array.isArray(v) ? `[${v.join(', ')}]` : typeof v === 'string' ? `"${v}"` : String(v));
        for (const [key, value] of Object.entries(fields)) {
            const line = new RegExp(`^(\\s*)${key}: .*?(,?)$`, 'm');
            if (line.test(block)) {
                block = block.replace(line, `$1${key}: ${fmt(value)}$2`);
            } else {
                // Insert after the previous field we wrote (or after `image:`), keeping the trailing comma valid.
                const lines = block.split('\n');
                const prevKeys = Object.keys(fields);
                const prev = prevKeys[prevKeys.indexOf(key) - 1];
                const findLine = k => lines.findIndex(l => new RegExp(`^\\s*${k}:`).test(l));
                const idx = prev ? findLine(prev) : [findLine('imageWidths'), findLine('imageHeight'), findLine('image')].find(i => i !== -1) ?? -1;
                if (idx === -1) fail(`Could not place "${key}" in the "${args.project}" entry; add it by hand.`);
                const indent = lines[idx].match(/^\s*/)[0];
                lines.splice(idx + 1, 0, `${indent}${key}: ${fmt(value)},`);
                block = lines.join('\n');
            }
        }
        data = data.slice(0, start) + block + data.slice(endMarker);
        fs.writeFileSync(dataPath, data, 'utf8');
        console.log(`\n✅ Updated "${args.project}" in assets/js/project-data.js`);
    } else {
        console.log('\nAdd to the project entry in assets/js/project-data.js (or re-run with --project <id>):');
        for (const [k, v] of Object.entries(fields)) console.log(`    ${k}: ${fmt2(v)},`);
    }
} finally {
    fs.rmSync(tmp, { force: true });
}

function fmt2(v) {
    return Array.isArray(v) ? `[${v.join(', ')}]` : typeof v === 'string' ? `"${v}"` : String(v);
}
