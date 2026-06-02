const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const filesToMinify = [
  { path: 'assets/js/projects.js', loader: 'js' },
  { path: 'assets/js/theme.js', loader: 'js' },
  { path: 'assets/js/project-data.js', loader: 'js' }
];

async function build() {
  console.log('🏁 Starting in-place assets minification and CSS inlining...');
  
  // 1. Minify JS files in-place
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

  // 2. Minify style.css and inline it directly into index.html
  const cssPath = path.resolve(__dirname, '../style.css');
  const htmlPath = path.resolve(__dirname, '../index.html');
  
  if (fs.existsSync(cssPath) && fs.existsSync(htmlPath)) {
    try {
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      const minifiedCss = await esbuild.transform(cssContent, {
        minify: true,
        loader: 'css',
      });
      
      let htmlContent = fs.readFileSync(htmlPath, 'utf8');
      
      // Replace stylesheet link and preload link with minified style block
      const linkRegex = /<link rel="stylesheet" href="\/style\.css"[^>]*>/;
      const preloadRegex = /<link rel="preload" href="\/style\.css"[^>]*>/;
      
      htmlContent = htmlContent.replace(preloadRegex, '');
      htmlContent = htmlContent.replace(linkRegex, `<style>${minifiedCss.code.trim()}</style>`);
      
      fs.writeFileSync(htmlPath, htmlContent, 'utf8');
      console.log(`✅ Successfully inlined minified CSS directly into index.html!`);
    } catch (error) {
      console.error('❌ Failed to inline CSS:', error);
      process.exit(1);
    }
  }
  
  console.log('🎉 Build and inlining complete!');
}

build();
