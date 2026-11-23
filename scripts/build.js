import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { myProjects } from '../public/assets/js/project-data.js';
import { buildSitemapXml } from './sitemap-generator.js';
import { syncIndexHtml } from './lcp-preload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');
const siteDir = path.join(__dirname, 'public');

export const filesToMinify = [
  { path: 'assets/css/style.css', loader: 'css' },
  { path: 'assets/css/admin.css', loader: 'css' },
  { path: 'assets/js/projects.js', loader: 'js' },
  { path: 'assets/js/theme.js', loader: 'js' },
  { path: 'assets/js/project-data.js', loader: 'js' },
  { path: 'assets/js/admin-project-parser.js', loader: 'js' },
  { path: 'assets/js/image-utils.js', loader: 'js' },
  { path: 'assets/js/global-audio.js', loader: 'js' },
  { path: 'assets/js/audio-player.js', loader: 'js' },
  { path: 'assets/js/mini-player.js', loader: 'js' },
  { path: 'assets/js/global-video.js', loader: 'js' },
  { path: 'assets/js/video-player.js', loader: 'js' },
  { path: 'assets/js/video-mini-player.js', loader: 'js' },
  { path: 'assets/js/lightbox.js', loader: 'js' },
  { path: 'assets/js/brochure.js', loader: 'js' },
  { path: 'assets/js/events.js', loader: 'js' }
];

// HTML shells that reference the assets above and need their ?v= query
// strings kept in sync with content hashes.
const htmlFilesToVersion = ['index.html', '404.html', 'admin.html'];

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 10);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Swaps any existing ?v=... on href/src="<webPath>" for the current hash.
export function rewriteAssetRefs(content, webPath, hash) {
  const pattern = new RegExp(`(["'])${escapeRegex(webPath)}(?:\\?v=[^"']*)?(["'])`, 'g');
  return content.replace(pattern, `$1${webPath}?v=${hash}$2`);
}

// Adds ?v=<hash> to absolute imports of the site's shared files (/assets/js/project-data.js ...).
// (The admin bundle does this at bundle time through its esbuild plugin; this helper is the same rule as plain text.)
export function rewriteModuleImports(content, hashes) {
  let out = content;
  for (const [filePath, hash] of Object.entries(hashes)) {
    if (!filePath.startsWith('assets/js/')) continue;
    const specifier = '/' + filePath;
    const pattern = new RegExp(`(from\\s*['"])${escapeRegex(specifier)}(?:\\?v=[^'"]*)?(['"])`, 'g');
    out = out.replace(pattern, `$1${specifier}?v=${hash}$2`);
  }
  return out;
}

async function generateSitemap() {
  console.log('🗺️ Generating sitemap.xml...');
  const sitemapPath = path.resolve(siteDir, 'sitemap.xml');
  const today = new Date().toISOString().split('T')[0];
  const xml = buildSitemapXml(myProjects, today);
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log('✅ Generated sitemap.xml successfully!');
}

const ADMIN_SRC = 'assets/js/admin';
const ADMIN_DIST = 'assets/js/admin/dist';

/**
 * Bundles the admin's ES modules into a few hashed files under assets/js/admin/dist/ (served immutable).
 *   - main.js and core.js are the entry points; each page of the admin is a lazily-loaded chunk.
 *   - editor.js is a classic script (its functions are globals used by inline handlers), so it is only
 *     minified, never renamed, and gets a hashed file name of its own.
 *   - Imports of the site's shared files (/assets/js/project-data.js ...) stay external but gain their ?v= hash
 *     at bundle time, so the bundle's own hash changes whenever one of them does.
 * Returns the URLs the page needs.
 */
export async function bundleAdmin({ siteDir: givenSiteDir, hashes = {} }) {
  const siteDir = fs.realpathSync(givenSiteDir); // esbuild reports paths relative to the real directory
  const srcDir = path.join(siteDir, ADMIN_SRC);
  const distDir = path.join(siteDir, ADMIN_DIST);
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const editor = await esbuild.transform(fs.readFileSync(path.join(srcDir, 'editor.js'), 'utf8'), {
    loader: 'js',
    minifyWhitespace: true,
    minifySyntax: true
  });
  const editorName = `editor-${hashContent(editor.code)}.js`;
  fs.writeFileSync(path.join(distDir, editorName), editor.code, 'utf8');
  const editorUrl = `/${ADMIN_DIST}/${editorName}`;

  const versionedSharedImports = {
    name: 'versioned-shared-imports',
    setup(build) {
      build.onResolve({ filter: /^\/assets\// }, (args) => {
        const bare = args.path.split('?')[0];
        const hash = hashes[bare.slice(1)];
        return { path: hash ? `${bare}?v=${hash}` : bare, external: true };
      });
    }
  };

  const result = await esbuild.build({
    absWorkingDir: siteDir,
    entryPoints: { main: path.join(srcDir, 'main.js'), core: path.join(srcDir, 'core.js') },
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    outdir: distDir,
    entryNames: '[name]-[hash]',
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    external: ['https://*'],
    define: { __ADMIN_EDITOR_URL__: JSON.stringify(editorUrl) },
    plugins: [versionedSharedImports],
    logLevel: 'silent'
  });

  const outputs = result.metafile.outputs;
  const url = (file) => '/' + file.split(path.sep).join('/');
  const entry = (name) => {
    const file = Object.keys(outputs).find((k) => outputs[k].entryPoint === `${ADMIN_SRC}/${name}.js`);
    if (!file) throw new Error(`Admin bundle has no output for ${name}.js`);
    return file;
  };
  const mainFile = entry('main');
  const coreFile = entry('core');

  // Everything the entries import statically, so the page can preload it instead of discovering it one hop at a time.
  const preload = new Set();
  const walk = (file) => {
    for (const imp of outputs[file]?.imports || []) {
      if (imp.kind !== 'import-statement' || imp.external || preload.has(imp.path)) continue;
      preload.add(imp.path);
      walk(imp.path);
    }
  };
  walk(mainFile);
  walk(coreFile);

  return { main: url(mainFile), core: url(coreFile), editor: editorUrl, preload: [...preload].map(url) };
}

/** Points admin.html at the bundled entry files and preloads their shared chunks. */
export function patchAdminHtml(html, manifest) {
  const tag = (name) => `<script type="module" src="/${ADMIN_SRC}/${name}.js"></script>`;
  for (const name of ['core', 'main']) {
    if (!html.includes(tag(name))) throw new Error(`admin.html no longer has the ${name}.js script tag the build rewrites`);
  }
  const preloads = manifest.preload.map((u) => `<link rel="modulepreload" href="${u}">`).join('\n    ');
  return html
    .replace(tag('core'), `${preloads ? `${preloads}\n    ` : ''}<script type="module" src="${manifest.core}"></script>`)
    .replace(tag('main'), `<script type="module" src="${manifest.main}"></script>`);
}

/** The admin stylesheet is hashed at build time, so it can be cached forever; in dev it stays no-cache. */
export function patchHeaders(text) {
  const dev = '/assets/css/admin.css\n  Cache-Control: no-cache';
  if (!text.includes(dev)) throw new Error('_headers no longer has the admin.css rule the build rewrites');
  return text.replace(dev, '/assets/css/admin.css\n  Cache-Control: public, max-age=31536000, immutable');
}

async function versionAssets() {
  console.log('🔖 Hashing static assets for cache-busting...');

  // projects.js imports its sibling modules with their own ?v= query strings,
  // so hash those "leaf" files first, then patch projects.js's imports before
  // hashing projects.js itself — otherwise its hash would be stale.
  const leafFiles = filesToMinify.filter((f) => f.path !== 'assets/js/projects.js');
  const hashes = {};

  for (const file of leafFiles) {
    const absolutePath = path.resolve(siteDir, file.path);
    const content = fs.readFileSync(absolutePath, 'utf8');
    hashes[file.path] = hashContent(content);
  }

  const projectsPath = path.resolve(siteDir, 'assets/js/projects.js');
  let projectsContent = fs.readFileSync(projectsPath, 'utf8');
  for (const [filePath, hash] of Object.entries(hashes)) {
    if (filePath.startsWith('assets/js/')) {
      const moduleSpecifier = './' + path.basename(filePath);
      const pattern = new RegExp(`(from\\s*['"])${escapeRegex(moduleSpecifier)}(?:\\?v=[^'"]*)?(['"])`, 'g');
      projectsContent = projectsContent.replace(pattern, `$1${moduleSpecifier}?v=${hash}$2`);
    }
  }
  fs.writeFileSync(projectsPath, projectsContent, 'utf8');
  hashes['assets/js/projects.js'] = hashContent(projectsContent);

  console.log('📦 Bundling the admin...');
  const manifest = await bundleAdmin({ siteDir, hashes });
  console.log(`✅ Admin bundle: ${manifest.main}, ${manifest.core}, ${manifest.editor}`);

  const adminHtmlPath = path.resolve(siteDir, 'admin.html');
  fs.writeFileSync(adminHtmlPath, patchAdminHtml(fs.readFileSync(adminHtmlPath, 'utf8'), manifest), 'utf8');

  const headersPath = path.resolve(siteDir, '_headers');
  fs.writeFileSync(headersPath, patchHeaders(fs.readFileSync(headersPath, 'utf8')), 'utf8');

  for (const htmlFile of htmlFilesToVersion) {
    const absolutePath = path.resolve(siteDir, htmlFile);
    if (!fs.existsSync(absolutePath)) continue;
    let html = fs.readFileSync(absolutePath, 'utf8');
    for (const [filePath, hash] of Object.entries(hashes)) {
      html = rewriteAssetRefs(html, '/' + filePath, hash);
      html = rewriteAssetRefs(html, './' + filePath, hash);
    }
    fs.writeFileSync(absolutePath, html, 'utf8');
  }

  console.log('✅ Asset versioning complete!');
}

async function build() {
  const isCloudflare = process.env.CF_PAGES === '1' || process.env.CI === 'true';
  const hasForceFlag = process.argv.includes('--force') || process.argv.includes('-f');

  if (!isCloudflare && !hasForceFlag) {
    console.error('⚠️  Warning: Running "npm run build" locally will overwrite your source files with minified code in-place.');
    console.error('If you want to run this locally, use: npm run build -- --force');
    process.exit(1);
  }

  // Generate sitemap FIRST before minifying project-data.js in-place
  await generateSitemap();

  console.log('🖼️ Syncing homepage LCP preload...');
  syncIndexHtml(myProjects);

  console.log('🏁 Starting in-place assets minification...');

  for (const file of filesToMinify) {
    const absolutePath = path.resolve(siteDir, file.path);
    if (!fs.existsSync(absolutePath)) {
      console.warn(`⚠️ File not found: ${file.path}`);
      continue;
    }

    try {
      const originalContent = fs.readFileSync(absolutePath, 'utf8');
      const minified = await esbuild.transform(originalContent, {
        minify: true,
        loader: file.loader,
      });
      fs.writeFileSync(absolutePath, minified.code, 'utf8');
      console.log(`✅ Minified ${file.path}`);
    } catch (error) {
      console.error(`❌ Failed to minify ${file.path}:`, error);
      process.exit(1);
    }
  }

  console.log('🎉 Minification complete!');

  await versionAssets();
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  build();
}
