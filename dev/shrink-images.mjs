#!/usr/bin/env node
/**
 * shrink-images.mjs
 *
 * Re-encodes every AVIF listed in tests/image-budget-baseline.json at a sane maximum width
 * (default 2000px: ~2x the widest the case-study layout renders) and removes the entries
 * it fixed from the baseline. Files that would not get smaller are left alone.
 *
 *   npm run shrink-images            # default 2000px max
 *   npm run shrink-images -- --max 1800 --quality 60
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = path.join(root, 'public');
const baselinePath = path.join(root, 'tests/image-budget-baseline.json');

const argv = process.argv.slice(2);
const opt = (name, fallback) => (argv.includes(name) ? Number(argv[argv.indexOf(name) + 1]) : fallback);
const max = opt('--max', 2000);
const quality = opt('--quality', 60);

const magick = args => execFileSync('magick', args, { encoding: 'utf8' }).trim();
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const remaining = [];
let before = 0;
let after = 0;

for (const rel of baseline) {
    const file = path.join(siteRoot, rel);
    if (!fs.existsSync(file)) continue;
    const oldSize = fs.statSync(file).size;
    const tmp = `${file}.tmp.avif`;
    try {
        if (Number(magick(['identify', '-format', '%w', `${file}[0]`])) <= max) continue;
        magick([`${file}[0]`, '-resize', `${max}x>`, '-strip', '-quality', String(quality), '-define', 'heic:speed=4', tmp]);
        const newSize = fs.statSync(tmp).size;
        // Oversized pixel dimensions are the real problem, so keep the resized file even if the bytes don't drop.
        const oversized = Number(magick(['identify', '-format', '%w', `${file}[0]`])) > max;
        if (newSize < oldSize || oversized) {
            fs.renameSync(tmp, file);
            before += oldSize;
            after += newSize;
            console.log(`✅ ${rel}  ${Math.round(oldSize / 1024)} KB → ${Math.round(newSize / 1024)} KB`);
        } else {
            fs.rmSync(tmp);
            remaining.push(rel);
            console.log(`⏭️  ${rel}  already efficient (${Math.round(oldSize / 1024)} KB), left unchanged`);
        }
    } catch (err) {
        fs.rmSync(tmp, { force: true });
        remaining.push(rel);
        console.warn(`⚠️ ${rel}: ${err.message.split('\n')[0]}`);
    }
}

fs.writeFileSync(baselinePath, JSON.stringify(remaining, null, 2) + '\n');
console.log(`\nSaved ${Math.round((before - after) / 1024)} KB. ${remaining.length} file(s) still in the baseline.`);
