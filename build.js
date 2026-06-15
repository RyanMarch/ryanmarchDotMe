import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { myProjects } from './assets/js/project-data.js';
import { buildSitemapXml } from './dev/sitemap-generator.js';

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

async function generateSitemap() {
  console.log('🗺️ Generating sitemap.xml...');
  const sitemapPath = path.resolve(__dirname, 'sitemap.xml');
  const today = new Date().toISOString().split('T')[0];
  const xml = buildSitemapXml(myProjects, today);
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log('✅ Generated sitemap.xml successfully!');
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
}

build();
