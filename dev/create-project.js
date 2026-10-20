#!/usr/bin/env node

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const projectRoot = path.join(repoRoot, 'public');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function getCurrentBranch() {
    try {
        return execSync('git branch --show-current', { cwd: repoRoot, encoding: 'utf8' }).trim();
    } catch {
        return '';
    }
}

function runGit(cmd) {
    return execSync(cmd, { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' });
}

async function main() {
    console.log('\n=============================================');
    console.log('  🚀 Project Scaffolding Assistant');
    console.log('=============================================\n');

    // 1. Gather Project Info
    let rawTitle = await askQuestion('Project Title: ');
    rawTitle = rawTitle.trim();
    if (!rawTitle) {
        console.error('❌ Project title is required.');
        process.exit(1);
    }

    const defaultSlug = slugify(rawTitle);
    const slugInput = await askQuestion(`Project Slug (default: "${defaultSlug}"): `);
    const slug = slugInput.trim() ? slugify(slugInput.trim()) : defaultSlug;

    if (!slug) {
        console.error('❌ A valid project slug is required.');
        process.exit(1);
    }

    // Check if project already exists
    const projectDataPath = path.join(projectRoot, 'assets/js/project-data.js');
    const projectDataContent = fs.readFileSync(projectDataPath, 'utf8');
    if (projectDataContent.includes(`id: "${slug}"`) || projectDataContent.includes(`id: '${slug}'`)) {
        console.error(`❌ Project with slug "${slug}" already exists in assets/js/project-data.js.`);
        process.exit(1);
    }

    const subtitleInput = await askQuestion('Subtitle / Tagline: ');
    const subtitle = subtitleInput.trim() || 'A short description of this project.';

    const sizeInput = await askQuestion('Card Size (small / medium / large / tall, default: medium): ');
    const validSizes = ['small', 'medium', 'large', 'tall', 'wide'];
    const size = validSizes.includes(sizeInput.trim().toLowerCase()) ? sizeInput.trim().toLowerCase() : 'medium';

    const rawTags = await askQuestion('Tags (comma-separated, e.g. "Web App, Design", default: "Project"): ');
    const tagList = rawTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

    if (tagList.length === 0) {
        tagList.push('Project');
    }

    const tagsArrayCode = tagList.map(tag => {
        let color = 'gray';
        const lower = tag.toLowerCase();
        if (lower.includes('web') || lower.includes('app')) color = 'teal';
        else if (lower.includes('design') || lower.includes('travel') || lower.includes('brand')) color = 'purple';
        else if (lower.includes('recent')) color = 'gold';
        else if (lower.includes('marketing')) color = 'orange';
        else if (lower.includes('audio')) color = 'indigo';
        return `            { label: "${tag}", color: "${color}" }`;
    }).join(',\n');

    // 2. Branch Handling
    const currentBranch = getCurrentBranch();
    const suggestedBranch = `feature/${slug}`;

    console.log(`\nCurrent Git Branch: ${currentBranch || '(detached/none)'}`);
    const branchChoice = await askQuestion(`Create and checkout new branch "${suggestedBranch}"? (Y/n): `);
    const shouldCreateBranch = !branchChoice.trim() || branchChoice.trim().toLowerCase().startsWith('y');

    if (shouldCreateBranch) {
        try {
            // Check if suggested branch exists
            let branchExists = false;
            try {
                runGit(`git rev-parse --verify ${suggestedBranch}`);
                branchExists = true;
            } catch {
                branchExists = false;
            }

            if (branchExists) {
                console.log(`Checking out existing branch "${suggestedBranch}"...`);
                runGit(`git checkout ${suggestedBranch}`);
            } else {
                console.log(`Creating branch "${suggestedBranch}" from ${currentBranch || 'HEAD'}...`);
                runGit(`git checkout -b ${suggestedBranch}`);
            }
            console.log(`Switched to branch "${suggestedBranch}".`);
        } catch (err) {
            console.warn(`⚠️ Git branch creation failed: ${err.message}. Proceeding on current branch.`);
        }
    }

    // 3. Create Content & Image Directories
    const contentDir = path.join(projectRoot, 'content', slug);
    const imagesDir = path.join(contentDir, 'images');

    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    // 4. Create Starter index.html
    const indexHtmlPath = path.join(contentDir, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
        const starterHtml = `<h2 class="project-title">${rawTitle}</h2>
<p class="project-subtitle">${subtitle}</p>
<p class="project-description">Product Manager • 2026</p>

<h4 id="introduction" class="section-divider"><span>The Product</span></h4>
<p>
    Write a brief overview of ${rawTitle}.
</p>

<h4 id="the-challenge" class="section-divider"><span>The Challenge</span></h4>
<p>
    Describe the core problem or opportunity identified.
</p>

<h4 id="the-solution" class="section-divider"><span>The Solution</span></h4>
<p>
    Detail the product execution, user experience considerations, and technical implementation.
</p>

<h4 id="outcomes" class="section-divider"><span>Outcomes & Impact</span></h4>
<p>
    Highlight key metrics, user feedback, or takeaways.
</p>
`;
        fs.writeFileSync(indexHtmlPath, starterHtml, 'utf8');
        console.log(`Created: content/${slug}/index.html`);
        console.log(`Created: content/${slug}/images/`);
    }

    // 5. Register in project-data.js (with fallback symbol so vitest passes before an image is added)
    const newProjectEntry = `    {
        id: "${slug}",
        title: "${rawTitle}",
        subtitle: "${subtitle}",
        seoTitle: "${rawTitle}",
        seoDescription: "${subtitle}",
        tags: [
${tagsArrayCode}
        ],
        featured: false,
        size: "${size}",
        symbol: "★",
        image: "",
        actionText: "View Project",
        actionUrl: "",
        hasExtendedContent: true,
        showLaunchButton: false
    },
`;

    // Insert at beginning of myProjects array
    const targetPattern = /export const myProjects = \[\r?\n/;
    if (targetPattern.test(projectDataContent)) {
        const updatedData = projectDataContent.replace(targetPattern, (match) => match + newProjectEntry);
        fs.writeFileSync(projectDataPath, updatedData, 'utf8');
        console.log(`Updated: assets/js/project-data.js`);
    } else {
        console.warn('⚠️ Could not locate `export const myProjects = [` in assets/js/project-data.js. Please add manually.');
    }

    console.log('\n=============================================');
    console.log(`  🎉 Project "${rawTitle}" successfully scaffolded!`);
    console.log('=============================================');
    console.log(`Folder: content/${slug}/`);
    console.log(`HTML:   content/${slug}/index.html`);
    console.log('When you have a preview hero image, save the full-size file in content/' + slug + '/images/ and run:');
    console.log(`        npm run image-variants -- content/${slug}/images/<file> --og --project ${slug}`);
    console.log('It creates the responsive sizes + share image and updates assets/js/project-data.js.\n');

    rl.close();
}

main().catch(err => {
    console.error('Fatal error during project creation:', err);
    process.exit(1);
});
