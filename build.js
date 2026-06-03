const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const filesToMinify = [
  { path: 'style.css', loader: 'css' },
  { path: 'assets/js/projects.js', loader: 'js' },
  { path: 'assets/js/theme.js', loader: 'js' },
  { path: 'assets/js/project-data.js', loader: 'js' }
];

async function build() {
  const isCloudflare = process.env.CF_PAGES === '1' || process.env.CI === 'true';
  const hasForceFlag = process.argv.includes('--force') || process.argv.includes('-f');

  if (!isCloudflare && !hasForceFlag) {
    console.error('⚠️  Warning: Running "npm run build" locally will overwrite your source files with minified code in-place.');
    console.error('If you want to run this locally, use: npm run build -- --force');
    process.exit(1);
  }

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
