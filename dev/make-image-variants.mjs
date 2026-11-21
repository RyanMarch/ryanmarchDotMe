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
 *   npm run image-variants -- raw/hero.png --icon raw/icon.png --out content/my-project/images/card --og --project my-project
 *
 * Options:
 *   --widths a,b,c      target widths in px (default 360,640,1200). Widths larger than the source are skipped.
 *   --og-only           only write og.jpg (skip the AVIF/PNG variants); handy for existing projects
 *   --og                also write og.jpg next to the output (source is letterboxed onto its own background colour)
 *   --project <id>      write image, imageWidth, imageHeight, imageWidths (and ogImage) into assets/js/project-data.js
 *   --og-bg <colour>    letterbox colour for og.jpg (default: sampled from the image corner, #18181b if transparent)
 *   --quality <n>       AVIF quality 0-100 (default 60)
 *   --out <path|name>   output path or basename (default: next to source with source's basename)
 *   --icon <path>               composite an app icon (PNG or SVG) onto the bottom-right corner with rounded corners and shadow
 *   --icon-size <n>             icon size as a fraction of base height (default 0.38)
 *   --icon-bg <colour>          optional solid square background behind a transparent icon before rounding
 *   --icon-inner-border <col>   optional thin inset rounded border inside the icon (e.g. '#94a3b8')
 *   --icon-rim <colour>         optional subtle outer hairline border around the icon for contrast on dark surfaces
 *   --icon-raw                  preserve the icon's own alpha shape (skip square rounding mask; great for shaped icons/badges)
 *   --icon-align <pos>          horizontal placement at the bottom: right (default), center, or left
 *   --icon-overhang <x[,y]>     how far the icon extends past the base's horizontal/bottom edges as a fraction of icon size
 *                               (defaults to 0.16,0.16 for opaque shots, 0,0 for transparent cutouts)
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
    const args = {
        widths: [360, 640, 1200],
        og: false,
        project: null,
        quality: 60,
        source: null,
        out: null,
        icon: null,
        iconSize: 0.38,
        iconBg: null,
        iconInnerBorder: null,
        iconRim: null,
        iconRaw: false,
        iconAlign: 'right',
        iconOverhang: null
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--og') args.og = true;
        else if (a === '--og-only') { args.og = true; args.ogOnly = true; }
        else if (a === '--widths') args.widths = argv[++i].split(',').map(Number).filter(Boolean);
        else if (a === '--project') args.project = argv[++i];
        else if (a === '--quality') args.quality = Number(argv[++i]);
        else if (a === '--og-bg') args.ogBg = argv[++i];
        else if (a === '--out') args.out = argv[++i];
        else if (a === '--icon') args.icon = argv[++i];
        else if (a === '--icon-size') args.iconSize = Number(argv[++i]);
        else if (a === '--icon-bg') args.iconBg = argv[++i];
        else if (a === '--icon-inner-border') args.iconInnerBorder = argv[++i];
        else if (a === '--icon-rim') args.iconRim = argv[++i];
        else if (a === '--icon-raw') args.iconRaw = true;
        else if (a === '--icon-align') args.iconAlign = argv[++i];
        else if (a === '--icon-overhang') {
            const parts = argv[++i].split(',').map(Number);
            args.iconOverhang = [parts[0], parts[1] ?? parts[0]];
        }
        else if (!a.startsWith('--')) args.source = a;
    }
    return args;
}

function resolveInputPath(p) {
    const siteRelative = path.join(projectRoot, p);
    return !fs.existsSync(p) && fs.existsSync(siteRelative) ? siteRelative : path.resolve(process.cwd(), p);
}

function magick(args) {
    return execFileSync('magick', args, { encoding: 'utf8' }).trim();
}

function fail(msg) {
    console.error(`❌ ${msg}`);
    process.exit(1);
}

function compositeIcon(basePath, iconPath, outPath, { iconSize, iconBg, iconInnerBorder, iconRim, iconRaw, iconAlign, iconOverhang }) {
    const [rawW, rawH, cornersOpaque] = magick([
        'identify',
        '-format', '%w %h %[fx:(p{2,2}.a>0.99&&p{w-3,2}.a>0.99&&p{2,h-3}.a>0.99&&p{w-3,h-3}.a>0.99)?1:0]',
        `${basePath}[0]`
    ]).split(' ');
    const srcW = Number(rawW);
    const srcH = Number(rawH);
    const isOpaque = cornersOpaque === '1';

    // Cap working canvas at 1600px wide so corner radii and drop shadows stay visually consistent.
    const workW = Math.min(srcW, 1600);
    const workH = Math.round(workW * srcH / srcW);
    const iconPx = Math.round(workH * iconSize);
    const iconRadius = Math.round(iconPx * 0.22);
    const iconShadowBlur = Math.max(8, Math.round(iconPx * 0.055));
    const iconShadowY = Math.max(4, Math.round(iconPx * 0.032));
    const [overhangXFrac, overhangYFrac] = iconOverhang ?? (isOpaque ? [0.16, 0.16] : [0, 0]);
    const overhangX = Math.round(iconPx * overhangXFrac);
    const overhangY = Math.round(iconPx * overhangYFrac);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-comp-'));
    try {
        const iconPrepared = path.join(tmpDir, 'icon.png');
        const iconShadowed = path.join(tmpDir, 'icon-shadow.png');
        const basePrepared = path.join(tmpDir, 'base.png');
        const isSvg = path.extname(iconPath).toLowerCase() === '.svg';
        let effectiveIconPath = iconPath;
        let rasterizedSvg = false;
        if (isSvg) {
            const rawSvg = fs.readFileSync(iconPath, 'utf8');
            // If the SVG is a wrapper around an embedded base64 PNG (e.g. RealFaviconGenerator), extract the PNG directly to preserve alpha.
            const embeddedPng = rawSvg.match(/href="data:image\/png;base64,([^"]+)"/i);
            if (embeddedPng && !iconBg) {
                effectiveIconPath = path.join(tmpDir, 'embedded-icon.png');
                fs.writeFileSync(effectiveIconPath, Buffer.from(embeddedPng[1], 'base64'));
                rasterizedSvg = true;
            } else {
                // Expand CSS var(..., fallback) and percentage root sizes so headless SVG renderers preserve colors/scale.
                let svgSrc = rawSvg
                    .replace(/var\([^,)]+,\s*([^)]+)\)/g, '$1')
                    .replace(/\b(width|height)="100%"/g, '$1="512"');
                // Inject --icon-bg directly inside the SVG so QuickLook doesn't flatten transparent areas onto white.
                if (iconBg) {
                    svgSrc = svgSrc.replace(/(<svg\b[^>]*>)/i, `$1<rect width="100%" height="100%" fill="${iconBg}"/>`);
                }
                effectiveIconPath = path.join(tmpDir, 'icon.svg');
                fs.writeFileSync(effectiveIconPath, svgSrc, 'utf8');
                // On macOS, QuickLook (`qlmanage`) renders SVG gradients and filters accurately via WebKit.
                try {
                    execFileSync('qlmanage', ['-t', '-s', '1024', '-o', tmpDir, effectiveIconPath], { stdio: 'ignore' });
                    const qlOut = path.join(tmpDir, 'icon.svg.png');
                    if (fs.existsSync(qlOut)) {
                        effectiveIconPath = qlOut;
                        rasterizedSvg = true;
                    }
                } catch {
                    // Fall back to ImageMagick SVG rasterizer on non-macOS hosts.
                }
            }
        }

        // 1. Rasterize / resize icon into a clean square (with optional solid background + padding).
        if (iconRaw) {
            magick([
                ...(isSvg && !rasterizedSvg ? ['-background', 'none', '-density', '400'] : []),
                `${effectiveIconPath}[0]`,
                '-trim', '+repage',
                '-resize', `${iconPx}x${iconPx}`,
                iconPrepared
            ]);
            magick([
                iconPrepared,
                '-compose', 'Over',
                '(',
                '+clone', '-background', 'black',
                '-shadow', `55x${iconShadowBlur}+0+${iconShadowY}`,
                ')',
                '+swap', '-background', 'none', '-layers', 'merge', '+repage',
                iconShadowed
            ]);
        } else {
            if (iconBg) {
                const inner = Math.round(iconPx * (iconInnerBorder ? 0.80 : 0.86));
                magick([
                    ...(isSvg && !rasterizedSvg ? ['-background', 'none', '-density', '400'] : []),
                    `${effectiveIconPath}[0]`,
                    '-resize', `${inner}x${inner}`,
                    '-background', iconBg,
                    '-gravity', 'center',
                    '-extent', `${iconPx}x${iconPx}`,
                    iconPrepared
                ]);
            } else {
                magick([
                    ...(isSvg && !rasterizedSvg ? ['-background', 'none', '-density', '400'] : []),
                    `${effectiveIconPath}[0]`,
                    '-resize', `${iconPx}x${iconPx}^`,
                    '-gravity', 'center',
                    '-extent', `${iconPx}x${iconPx}`,
                    iconPrepared
                ]);
            }

            // 2. Apply optional inner border, rounded-square alpha mask, optional outer rim, and soft drop shadow.
            const iconDrawOps = [];
            if (iconInnerBorder) {
                const inset = Math.round(iconPx * 0.068);
                const innerR = Math.max(4, Math.round(iconRadius - inset * 0.65));
                const sw = Math.max(2, Math.round(iconPx * 0.016));
                iconDrawOps.push(
                    '-fill', 'none',
                    '-stroke', iconInnerBorder,
                    '-strokewidth', String(sw),
                    '-draw', `roundrectangle ${inset},${inset} ${iconPx - 1 - inset},${iconPx - 1 - inset} ${innerR},${innerR}`
                );
            }
            const rimOps = [];
            if (iconRim) {
                const sw = Math.max(2, Math.round(iconPx * 0.01));
                const pad = Math.ceil(sw / 2);
                rimOps.push(
                    '-fill', 'none',
                    '-stroke', iconRim,
                    '-strokewidth', String(sw),
                    '-draw', `roundrectangle ${pad},${pad} ${iconPx - 1 - pad},${iconPx - 1 - pad} ${iconRadius},${iconRadius}`
                );
            }

            magick([
                iconPrepared,
                ...iconDrawOps,
                '-alpha', 'set',
                '(',
                '-size', `${iconPx}x${iconPx}`, 'xc:none',
                '-fill', 'white',
                '-draw', `roundrectangle 0,0 ${iconPx - 1},${iconPx - 1} ${iconRadius},${iconRadius}`,
                ')',
                '-compose', 'DstIn', '-composite',
                '-compose', 'Over',
                ...rimOps,
                '(',
                '+clone', '-background', 'black',
                '-shadow', `60x${iconShadowBlur}+0+${iconShadowY}`,
                ')',
                '+swap', '-background', 'none', '-layers', 'merge', '+repage',
                iconShadowed
            ]);
        }

        // 3. Prepare base image: opaque screenshots get rounded corners and soft shadow; both modes support overhang.
        const margin = Math.round(workW * 0.02);
        if (isOpaque) {
            const baseRadius = Math.round(workW * 0.018);
            const baseShadowBlur = Math.max(6, Math.round(workW * 0.01));
            const baseShadowY = Math.max(3, Math.round(workW * 0.005));

            magick([
                `${basePath}[0]`,
                '-resize', `${workW}x${workH}!`,
                '-alpha', 'set',
                '(',
                '-size', `${workW}x${workH}`, 'xc:none',
                '-fill', 'white',
                '-draw', `roundrectangle 0,0 ${workW - 1},${workH - 1} ${baseRadius},${baseRadius}`,
                ')',
                '-compose', 'DstIn', '-composite',
                '-compose', 'Over',
                '(',
                '+clone', '-background', 'black',
                '-shadow', `35x${baseShadowBlur}+0+${baseShadowY}`,
                ')',
                '+swap', '-background', 'none', '-layers', 'merge', '+repage',
                basePrepared
            ]);
        } else {
            magick([`${basePath}[0]`, '-resize', `${workW}x${workH}!`, basePrepared]);
        }

        const [bW, bH] = magick(['identify', '-format', '%w %h', basePrepared]).split(' ').map(Number);
        const [iW, iH] = magick(['identify', '-format', '%w %h', iconShadowed]).split(' ').map(Number);
        const baseX = iconAlign === 'left' ? margin + overhangX : margin;
        const canvasW = Math.max(bW + (iconAlign === 'center' ? 0 : overhangX), iW) + margin * 2;
        const canvasH = Math.max(bH + overhangY, iH) + margin * 2;
        // Position the icon's visible body relative to the base's bottom edge so shadow padding doesn't shift it.
        const shadowPadX = Math.max(0, Math.round((iW - iconPx) / 2));
        const shadowPadTop = Math.max(0, Math.round((iH - iconPx) / 2) - iconShadowY);
        const rawIconX = iconAlign === 'center'
            ? baseX + Math.round((bW - iconPx) / 2) + overhangX
            : iconAlign === 'left'
                ? margin
                : baseX + bW - iconPx + overhangX;
        const iconX = Math.max(0, rawIconX - shadowPadX);
        const iconY = Math.max(0, margin + bH - iconPx + overhangY - shadowPadTop);

        magick([
            '-size', `${canvasW}x${canvasH}`, 'xc:none',
            basePrepared, '-gravity', 'NorthWest', '-geometry', `+${baseX}+${margin}`, '-compose', 'Over', '-composite',
            iconShadowed, '-gravity', 'NorthWest', '-geometry', `+${iconX}+${iconY}`, '-compose', 'Over', '-composite',
            '-trim', '+repage',
            outPath
        ]);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

const args = parseArgs(process.argv.slice(2));
if (!args.source) fail('Usage: npm run image-variants -- <image> [--widths 360,640,1200] [--icon <path>] [--out <path|name>] [--og] [--project <id>]');

const sourcePath = resolveInputPath(args.source);
if (!fs.existsSync(sourcePath)) fail(`Source not found: ${args.source}`);
const iconPath = args.icon ? resolveInputPath(args.icon) : null;
if (iconPath && !fs.existsSync(iconPath)) fail(`Icon not found: ${args.icon}`);
try { magick(['-version']); } catch { fail('ImageMagick (`magick`) is required: brew install imagemagick'); }

let dir = path.dirname(sourcePath);
let name = path.basename(sourcePath, path.extname(sourcePath));
if (args.out) {
    if (args.out.includes('/') || args.out.includes(path.sep)) {
        const outBase = path.isAbsolute(args.out)
            ? args.out
            : args.out.startsWith('content/') || args.out.startsWith('assets/')
                ? path.join(projectRoot, args.out)
                : path.resolve(process.cwd(), args.out);
        dir = path.dirname(outBase);
        name = path.basename(outBase, path.extname(outBase));
    } else {
        name = path.basename(args.out, path.extname(args.out));
    }
    fs.mkdirSync(dir, { recursive: true });
}

// Work from a temp copy so the source can be overwritten safely.
const tmp = path.join(os.tmpdir(), `variants-${process.pid}${iconPath ? '.png' : path.extname(sourcePath)}`);
if (iconPath) {
    compositeIcon(sourcePath, iconPath, tmp, {
        iconSize: args.iconSize,
        iconBg: args.iconBg,
        iconInnerBorder: args.iconInnerBorder,
        iconRim: args.iconRim,
        iconRaw: args.iconRaw,
        iconAlign: args.iconAlign,
        iconOverhang: args.iconOverhang
    });
} else {
    fs.copyFileSync(sourcePath, tmp);
}

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
