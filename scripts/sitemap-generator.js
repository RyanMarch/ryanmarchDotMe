import { execSync } from 'child_process';

/**
 * Gets the last modification date of a file from Git history.
 * Fallbacks to the build date if git is not available.
 */
export function getGitLastMod(filePath, fallbackDate) {
  try {
    const stdout = execSync(`git log -1 --format=%cs -- "${filePath}"`, { stdio: ['ignore', 'pipe', 'ignore'] });
    const dateStr = stdout.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
  } catch {
    // Fail silently, fallback to build date
  }
  return fallbackDate;
}

/**
 * Builds the sitemap XML string based on active projects.
 */
export function buildSitemapXml(projects, today, lastModGetter = getGitLastMod) {
  const homeLastMod = lastModGetter('index.html', today);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `  <url><loc>https://ryanmarch.me/</loc><lastmod>${homeLastMod}</lastmod><priority>1.0</priority></url>\n`;

  for (const project of projects) {
    if (project.hasExtendedContent) {
      const projectFile = `content/${project.id}/index.html`;
      const lastMod = lastModGetter(projectFile, today);
      xml += `  <url><loc>https://ryanmarch.me/project/${project.id}/</loc><lastmod>${lastMod}</lastmod><priority>0.8</priority></url>\n`;
    }
  }

  xml += '</urlset>\n';
  return xml;
}
