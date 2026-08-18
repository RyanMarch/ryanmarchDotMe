import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { myProjects } from './assets/js/project-data.js';
import { buildSitemapXml } from './sitemap-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToMinify = [
  { path: 'style.css', loader: 'css' },
  { path: 'assets/js/projects.js', loader: 'js' },
  { path: 'assets/js/theme.js', loader: 'js' },
  { path: 'assets/js/project-data.js', loader: 'js' },
  { path: 'assets/js/audio-player.js', loader: 'js' },
  { path: 'assets/js/lightbox.js', loader: 'js' },
  { path: 'assets/js/brochure.js', loader: 'js' }
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
function rewriteAssetRefs(content, webPath, hash) {
  const pattern = new RegExp(`(["'])${escapeRegex(webPath)}(?:\\?v=[^"']*)?(["'])`, 'g');
  return content.replace(pattern, `$1${webPath}?v=${hash}$2`);
}

async function generateSitemap() {
  console.log('🗺️ Generating sitemap.xml...');
  const sitemapPath = path.resolve(__dirname, 'sitemap.xml');
  const today = new Date().toISOString().split('T')[0];
  const xml = buildSitemapXml(myProjects, today);
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log('✅ Generated sitemap.xml successfully!');
}

async function versionAssets() {
  console.log('🔖 Hashing static assets for cache-busting...');

  // projects.js imports its sibling modules with their own ?v= query strings,
  // so hash those "leaf" files first, then patch projects.js's imports before
  // hashing projects.js itself — otherwise its hash would be stale.
  const leafFiles = filesToMinify.filter((f) => f.path !== 'assets/js/projects.js');
  const hashes = {};

  for (const file of leafFiles) {
    const absolutePath = path.resolve(__dirname, file.path);
    const content = fs.readFileSync(absolutePath, 'utf8');
    hashes[file.path] = hashContent(content);
  }

  const projectsPath = path.resolve(__dirname, 'assets/js/projects.js');
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

  for (const htmlFile of htmlFilesToVersion) {
    const absolutePath = path.resolve(__dirname, htmlFile);
    if (!fs.existsSync(absolutePath)) continue;
    let html = fs.readFileSync(absolutePath, 'utf8');
    for (const [filePath, hash] of Object.entries(hashes)) {
      html = rewriteAssetRefs(html, '/' + filePath, hash);
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

  console.log('🏁 Starting in-place assets minification...');

  for (const file of filesToMinify) {
    const absolutePath = path.resolve(__dirname, file.path);
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

build();
