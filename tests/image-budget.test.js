import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { myProjects } from '../assets/js/project-data.js';
import { imageVariantPath } from '../assets/js/image-utils.js';
import baseline from './image-budget-baseline.json';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_AVIF_WIDTH = 2400;

// AVIF is an ISO-BMFF container; the `ispe` box holds the pixel size, so no image library is needed.
function avifSize(file) {
    const buf = fs.readFileSync(file);
    const i = buf.indexOf('ispe');
    return i === -1 ? null : { width: buf.readUInt32BE(i + 8), height: buf.readUInt32BE(i + 12) };
}

function listAvifs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? listAvifs(full) : e.name.endsWith('.avif') ? [full] : [];
    });
}

describe('Image budget', () => {
    const oversized = listAvifs(path.join(root, 'content'))
        .filter(f => (avifSize(f)?.width ?? 0) > MAX_AVIF_WIDTH)
        .map(f => path.relative(root, f))
        .sort();

    it(`no new AVIF is wider than ${MAX_AVIF_WIDTH}px (shrink with \`npm run image-variants -- <file>\`)`, () => {
        const fresh = oversized.filter(f => !baseline.includes(f));
        expect(fresh, `Oversized images not in tests/image-budget-baseline.json:\n${fresh.join('\n')}`).toEqual([]);
    });

    it('baseline only lists images that are still oversized (remove entries once fixed)', () => {
        const stale = baseline.filter(f => !oversized.includes(f));
        expect(stale, `Fixed or deleted images still in the baseline:\n${stale.join('\n')}`).toEqual([]);
    });
});

describe('Responsive project images', () => {
    myProjects.filter(p => p.imageWidths).forEach(project => {
        it(`${project.id}: variants exist and match the declared size`, () => {
            const widths = [...project.imageWidths].sort((a, b) => a - b);
            const largest = widths[widths.length - 1];
            expect(project.imageWidth, 'imageWidth should equal the largest imageWidths entry').toBe(largest);

            widths.forEach(w => {
                const rel = w === largest ? project.image : imageVariantPath(project.image, w);
                const file = path.join(root, rel);
                expect(fs.existsSync(file), `${rel} is missing`).toBe(true);
                expect(avifSize(file)?.width, `${rel} should be ${w}px wide`).toBe(w);
            });

            const actual = avifSize(path.join(root, project.image));
            const declared = project.imageWidth / project.imageHeight;
            expect(Math.abs(actual.width / actual.height - declared) < 0.02, 'imageHeight does not match the image aspect ratio').toBe(true);
        });
    });
});

describe('Card image dimensions', () => {
    myProjects.filter(p => p.image?.endsWith('.avif')).forEach(project => {
        it(`${project.id}: imageWidth/imageHeight match the AVIF`, () => {
            const actual = avifSize(path.join(root, project.image));
            expect(actual, `${project.image} is missing or not a valid AVIF`).not.toBeNull();
            const ratioOff = Math.abs(actual.width / actual.height - project.imageWidth / project.imageHeight);
            expect(ratioOff < 0.02, `declared ${project.imageWidth}x${project.imageHeight} but file is ${actual.width}x${actual.height}`).toBe(true);
        });
    });
});

describe('Social share images', () => {
    myProjects.filter(p => p.ogImage).forEach(project => {
        it(`${project.id}: ogImage is a JPEG/PNG file`, () => {
            expect(/\.(jpe?g|png)$/i.test(project.ogImage), 'crawlers do not reliably render AVIF/WebP').toBe(true);
            expect(fs.existsSync(path.join(root, project.ogImage)), `${project.ogImage} is missing`).toBe(true);
        });
    });
});
