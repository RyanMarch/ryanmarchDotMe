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
  console.log('🏁 Starting in-place assets minification...');
  
  for (const file of filesToMinify) {
    const absolutePath = path.resolve(__dirname, '..', file.path);
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
