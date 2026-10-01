// Shared by projects.js (homepage cards), worker.js (per-project <link rel="preload">)
// and scripts/build.js (homepage LCP preload) so all three agree on one srcset.
//
// A project opts in with `imageWidths: [360, 640, 1200]` in project-data.js.
// `image` is the largest rendition; every smaller width lives next to it as
// `<name>-<width>.<ext>`. `dev/make-image-variants.mjs` generates the files.

// Card images are capped by CSS at 320px tall on desktop and 180px on tablet/mobile
// (.destination-image-standalone / .destination-icon), so their rendered width is
// that height times the image's aspect ratio.
const CARD_MAX_HEIGHT_DESKTOP = 320;
const CARD_MAX_HEIGHT_COMPACT = 180;

export function imageVariantPath(imagePath, width) {
    const dot = imagePath.lastIndexOf('.');
    return `${imagePath.slice(0, dot)}-${width}${imagePath.slice(dot)}`;
}

export function buildImageSrcset(project) {
    const widths = project.imageWidths;
    if (!project.image || !Array.isArray(widths) || widths.length < 2) return null;

    const sorted = [...widths].sort((a, b) => a - b);
    const largest = sorted[sorted.length - 1];
    const srcset = sorted
        .map(w => `${w === largest ? project.image : imageVariantPath(project.image, w)} ${w}w`)
        .join(', ');

    const aspect = project.imageWidth && project.imageHeight ? project.imageWidth / project.imageHeight : 1;
    const sizes = `(max-width: 1050px) ${Math.round(CARD_MAX_HEIGHT_COMPACT * aspect)}px, ${Math.round(CARD_MAX_HEIGHT_DESKTOP * aspect)}px`;

    return { srcset, sizes };
}
