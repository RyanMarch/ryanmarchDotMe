# Ryan March Personal Site (`ryanmarch.me`)

Welcome to the documentation for **ryanmarch.me**, a personal landing page, bento-box portfolio, and case study showcase for Ryan March (Product Manager & Creative Technologist). 

This site is built with **modern vanilla technologies** (HTML, CSS, JavaScript, and Cloudflare Pages) to deliver an incredibly fast, premium user experience featuring sleek dark/light/system theme toggles, smooth grid filtering animations (FLIP technique), custom interactive media players, and lazy-loaded galleries.

---

## Table of Contents
1. [Quick Start: Rebuild and Run Locally](#quick-start-rebuild-and-run-locally)
2. [How to Add a New Project (For Anyone)](#how-to-add-a-new-project-for-anyone)
   - [Step 1: Define the Project Data](#step-1-define-the-project-data)
   - [Step 2: Add Case Study Assets (Optional)](#step-2-add-case-study-assets-optional)
   - [Step 3: Create the Case Study HTML (Optional)](#step-3-create-the-case-study-html-optional)
   - [Step 4: Build and Verify](#step-4-build-and-verify)
3. [Project Architecture & How Things Work](#project-architecture--how-things-work)
   - [How the Build Script Works](#how-the-build-script-works)
   - [On-Save Auto-Compilation (The VS Code Magic)](#on-save-auto-compilation-the-vs-code-magic)
4. [Tools and Infrastructure](#tools-and-infrastructure)
5. [AI Chatbot Cheat Sheet (Bonus Points)](#ai-chatbot-cheat-sheet-bonus-points)

---

## Quick Start: Rebuild and Run Locally

For everyday editing and adding projects, **you do not need to use terminal commands or run Python manually**. The project is designed to integrate with VS Code extensions to automate everything in the background.

### Recommended Workflow (Zero Terminal)
This workflow uses two popular VS Code extensions that automate hosting and building:

1. **Install the Extensions:**
   - **Live Server** (by Ritwick Dey): Hosts your website locally and auto-refreshes the browser.
   - **Trigger Task on Save** (by Gerald L.): Triggers our background compiler on save.

2. **Open in VS Code:**
   Open the root `ryanmarchDotMe` directory in your VS Code workspace.

3. **Start the Local Server:**
   Click the **"Go Live"** button in the bottom status bar of VS Code (or right-click `index.html` and choose **"Open with Live Server"**). This will automatically launch your site at `http://127.0.0.1:5500`.

4. **Edit and Save:**
   Every time you edit project data or case study drafts and hit **Save (`Cmd+S`)**, the compiler runs in the background and your browser automatically refreshes to display the new content.

---

### Terminal Fallback (Without VS Code Extensions)
If you are running outside of VS Code or don't have the extensions installed, you can easily host and build using native Python 3 terminal commands:

1. **Prerequisites:**
   Make sure you have **Python 3** installed on your system.

2. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd ryanmarchDotMe
   ```

3. **Start the local development server:**
   Run the following Python command to start a lightweight local web server:
   ```bash
   python3 -m http.server 8000
   ```
   Open `http://localhost:8000` in your web browser.

4. **Compile the static pages:**
   Open a separate terminal window/tab in the project directory and run:
   ```bash
   python3 dev/generate.py
   ```

---

## How to Add a New Project (For Anyone)

Adding a new project to the site is designed to be straightforward, even if you are not deeply technical. Follow this step-by-step guide to add new content.

### Step 1: Define the Project Data
All projects shown on the homepage are defined in a single file: `assets/js/project-data.js`. 

1. Open `assets/js/project-data.js` in your editor.
2. Add a new project object inside the `myProjects` array at the top. Here is a blank template and an explanation of the fields:

```javascript
{
    id: "my-awesome-project",            // Unique slug (used in file names and URLs)
    title: "My Awesome Project",         // The title shown on the home grid and case study
    subtitle: "Brief description line",   // A catchy one-line tagline
    tags: [
        { label: "Recently Updated", color: "gold" },
        { label: "Design Tool", color: "purple" },
        { label: "Project", color: "gray", priority: "low" }
    ],
    featured: false,                     // true = takes prominence, gets a larger preview
    size: "medium",                      // Sizing: "small", "medium", "large", "tall", or "wide"
    image: "content/my-awesome-project/images/hero.webp", // Preview image path (or "" if none)
    imageClass: "destination-icon",      // Visual class styling (leave as "destination-icon")
    actionText: "Launch Tool",           // Button text (e.g., "Launch App", "View Film")
    actionUrl: "https://my-tool.com",    // External link (if hasExtendedContent is false)
    sourceUrl: "",                       // Optional GitHub/source code link
    hasExtendedContent: true             // true = generates a full case study page; false = links out immediately
}
```

#### Bento Grid Sizing Guide
Use the `size` property to define the grid dimensions of each project card:

| Size | Dimensions (W x H) | Best Used For |
| :--- | :--- | :--- |
| `small` | **1 x 1** | Archive items, minor compositions. Hides preview images, focuses on text. |
| `medium` | **2 x 1** | Standard horizontal cards (e.g., standard projects, single videos). |
| `large` | **2 x 2** | Prominent projects. Displays a larger preview image. |
| `tall` | **1 x 2** | Tall vertical cards (perfect for mockups displaying double phone screens). |
| `wide` | **3 x 1** | Ultra-wide featured panels. |

#### Tag Colors Reference
Valid tag `color` settings include: `blue`, `green`, `purple`, `orange`, `rose`, `cyan`, `amber`, `gold`, `white`, and `gray`. You can add `priority: "low"` to a tag to de-emphasize it on mobile views.

---

### Step 2: Add Case Study Assets (Optional)
If your project has **extended content** (`hasExtendedContent: true`), you should save its assets inside a dedicated subfolder:
1. Create a folder inside `content/` with your project's unique `id`: `content/my-awesome-project/`
2. Create an `images/` folder inside it: `content/my-awesome-project/images/`
3. Save any images, icons, or visual assets for the case study there. 

---

### Step 3: Create the Case Study HTML (Optional)
If `hasExtendedContent` is `true`, the compiler expects a matching HTML file in the `content/` folder: `content/<id>.html`.

1. Create a new file under `content/` named after your project `id` (e.g., `content/my-awesome-project.html`).
2. Populate the file with HTML fragments. Use the highly structured, copy-pasteable template below to ensure consistent typography and premium features:

```html
<!-- Header Details -->
<h2 class="project-title">My Awesome Project</h2>
<p class="project-subtitle">Case Study Subtitle</p>
<p class="project-description">Category • Date • Client/Role</p>

<!-- Table of Contents is generated AUTOMATICALLY based on <h4> tags below! -->

<h4 id="introduction" class="section-divider"><span>Introduction</span></h4>
<p>
    Write a brief introduction about what this project is, what problem it solves, and why you built it.
    Use HTML styling tags like <strong>bold text</strong> or <em>italics</em> where appropriate.
</p>

<!-- Premium Image Gallery (w/ Auto-Lightbox) -->
<div class="project-gallery">
    <div class="gallery-item">
        <img alt="Write a descriptive alt text here for accessibility" 
             src="content/my-awesome-project/images/hero.webp" 
             loading="lazy" />
        <div class="gallery-caption">This caption appears beneath the image and inside the lightbox.</div>
    </div>
</div>

<h4 id="the-journey" class="section-divider"><span>The Journey</span></h4>
<p>
    Provide depth about your engineering and design process. You can split images side-by-side inside the 
    gallery container to display comparisons.
</p>

<!-- Optional: Audio Player -->
<!-- 
<div class="custom-audio-player" data-title="Audio Track Title" data-subtitle="Artist/Description">
    <audio src="https://media.ryanmarch.me/my-audio-track.mp3" preload="metadata"></audio>
</div>
-->

<h4 id="details" class="section-divider"><span>Details & Skills</span></h4>
<ul>
    <li><strong>Tools Used:</strong> Figma, Python, Logic Pro, VS Code</li>
    <li><strong>Skills Used:</strong> Software Engineering, UI Design, Product Strategy</li>
    <li><strong>Links:</strong> <a href="https://github.com/RyanMarch" target="_blank" rel="noopener noreferrer">GitHub Profile</a></li>
</ul>
```

#### Rules of the HTML Content Files:
* **Automatic Table of Contents:** The build script automatically parses all `<h4>` tags containing an `id` attribute (e.g., `<h4 id="journey" ...>`) and generates a beautiful, floating navigation bar at the top of the case study page! **Ensure you provide unique `id` values on your `<h4>` tags.**
* **Automatic Lightbox:** Any image inside a `.project-gallery` container is automatically hooked up via JavaScript to open in a gorgeous, full-screen interactive lightbox when clicked.
* **Audio Players:** To embed audios, use the `.custom-audio-player` template above. The script will render it as a custom, high-end player with custom scrubber timelines and volume toggles.

---

### Step 4: Build and Verify
Once you've updated `project-data.js` and created your `content/<id>.html` file:
1. Save all your files (`Cmd+S`). 
2. **If your VS Code Extensions are Active (Recommended):**
   - The **Trigger Task on Save** extension will automatically run the `Build Project Pages` compilation task in the background.
   - The **Live Server** extension will instantly refresh your web browser tab to show the changes.
3. **If running without extensions (Manual Fallback):**
   - Run the compiler manually in the terminal:
     ```bash
     python3 dev/generate.py
     ```
   - Make sure your local server is running:
     ```bash
     python3 -m http.server 8000
     ```
4. Verify that a new folder has been generated under `project/my-awesome-project/` containing an `index.html` file.

---

## Project Architecture & How Things Work

The site is built as a **Hybrid Static Site Generator**. The home page loads dynamically using a tiny runtime JS script, while individual project case studies are fully static, built from pre-rendered HTML templates for maximum SEO and performance.

```
ryanmarchDotMe/
├── .vscode/               # VS Code configurations (tasks and file explorer filters)
├── assets/                # Core theme styling, scripts, and shared images
│   ├── js/
│   │   ├── project-data.js # The central database of all projects
│   │   ├── projects.js    # Home grid renderer, FLIP filter, and interactive lightbox scripts
│   │   └── theme.js       # Theme engine (Light, Dark, System preference memory)
│   └── img/               # Brand logos and global graphics
├── content/               # Draft content, images, and HTML fragments for case studies
├── dev/                   # Build tools, templates, and reference guides
│   ├── generate.py        # The Python compiler
│   └── project-template.html # The HTML template injected with project content
├── project/               # Output folder containing compiled static case study pages (Gitignored)
├── index.html             # Main home page (loads project-data.js to render bento grid)
├── wrangler.jsonc         # Cloudflare Pages staging/production routing settings
├── sitemap.xml            # Auto-generated Search Engine Sitemap
└── robots.txt             # Auto-generated Search Engine crawler rules
```

### How the Build Script Works
The core build script is `dev/generate.py`. It is a lightweight, zero-dependency Python script that executes the following on compile:

1. **Extracts Project Data:** Reads `assets/js/project-data.js` and extracts the JS `myProjects` array using regular expressions, converting it safely into a structured Python list.
2. **Generates Static Case Studies:** Loops through all projects. If `hasExtendedContent` is `true`, it:
   - Locates the master layout template at `dev/project-template.html`.
   - Locates the content HTML draft fragment at `content/<id>.html`.
   - **Compiles Dynamic Tags:** Reads the tag configurations defined for the project in `assets/js/project-data.js`. It translates the tag properties (`label`, `color`, and responsive `priority`) into fully styled `<span>` badge markup and replaces the `{{tags}}` token near the top of the template.
   - **Auto-Generates Table of Contents:** Parses the case study content for any `<h4>` elements containing `id` tags. It compiles them into a smooth-scrolling floating `<nav>` bar and injects it dynamically right beneath the project subtitle.
   - **Appends Action Links and Navigation:** Automatically builds an elegant action block at the bottom of the case study content:
     - If `sourceUrl` is provided, it appends a secondary "View More" button.
     - If `actionUrl` is provided, it appends a primary call-to-action button labeled with the project's custom `actionText` (or "Visit" by default).
     - It embeds modern, responsive arrow SVGs inside the buttons.
     - It appends a structural "Back to Home" navigation link (styled with the class `.modal-back-to-top-btn`) to allow readers to exit the case study and return to the main landing grid.
   - **Injects Content:** Safely replaces the core placeholders (`{{title}}`, `{{subtitle}}`, `{{content}}`, `{{tags}}`, `{{footer}}`) inside the master template with all compiled data.
   - **Outputs Static Folder:** Writes the fully-rendered standalone HTML file into `project/<id>/index.html`.
3. **Auto-Generates SEO Manifests:** Generates search-engine friendly documents (`sitemap.xml` and `robots.txt`) with the correct canonical URLs for all compiled projects, ensuring crawlers index your personal portfolio seamlessly.

### On-Save Auto-Compilation (The VS Code Magic)
To avoid cluttering the sidebar while you work, the `.vscode/settings.json` file is configured to hide compiled assets and server metadata:
```json
"files.exclude": {
    "project/": true,
    "wrangler.jsonc": true,
    "package.json": true,
    "sitemap.xml": true,
    "robots.txt": true
}
```
If you ever need to view these hidden files in your IDE file browser, simply remove them from the `"files.exclude"` list inside `.vscode/settings.json`.

#### Background Runner on Save
To make editing effortless, we've set up a VS Code task in `.vscode/tasks.json` labeled **`Build Project Pages`** that runs `python3 dev/generate.py`. 

When you install a VS Code extension like **Run on Save** or **Trigger Task on Save**, it automatically runs this default build task in the background every time you save a file under `content/*.html` or `assets/js/project-data.js`. You write clean HTML in `/content/`, press `Cmd+S`, and the final static HTML instantly populates `/project/` without you having to manually run terminal scripts!

---

## Tools and Infrastructure

* **GitHub:** Host repository, track development branches (we merge features into `develop` which propagates up to the main branch).
* **Cloudflare Pages:** Automates deployments. When you commit your changes to GitHub, Cloudflare automatically runs the build steps and deploys the generated files.
* **Wrangler:** Cloudflare's CLI tool. The environment, routes, and single-page-application (SPA) fallbacks are defined in `wrangler.jsonc`. It supports staging URLs (`staging.ryanmarch.me`) and production domains (`ryanmarch.me`).
* **Logic Pro X & Cloudflare R2 / Media Bucket:** High-performance media player audio tracks are stored externally in a custom Cloudflare media bucket (`media.ryanmarch.me`) to keep the repository lightweight and load audios instantly for site visitors.

---

## AI Chatbot Cheat Sheet (Bonus Points)

*Copy and paste the prompt block below to give any AI chatbot (like ChatGPT, Gemini, or Claude) instant context about this repository when you want it to help you write code, design new features, or debug pages.*

```markdown
You are helping me work on my personal portfolio website, ryanmarch.me.
Here is the core technical architecture of my codebase:
1. Technology Stack: Built with vanilla HTML5, CSS3, ES6 JavaScript, and Python 3. No modern JS framework (like React/Next) is used.
2. Bento Grid Homepage: The homepage (index.html) loads a central project list from `assets/js/project-data.js` and dynamically renders an animated, responsive grid (using `assets/js/projects.js`). Grid filtering uses a premium FLIP animation transition.
3. Dark Mode & Styling: Centralized CSS variables in `style.css` support robust light/dark/system themes, driven by `assets/js/theme.js` which stores user preferences in localStorage.
4. Static Page Compilation: Case studies are generated statically. I write layout-free HTML drafts in `content/<id>.html` and define project metadata in `assets/js/project-data.js` with `hasExtendedContent: true`. 
5. Build Compiler: Running `python3 dev/generate.py` parses my project data, injects the drafts into `dev/project-template.html`, auto-generates a Table of Contents (TOC) based on <h4> headings with ids, formats external source buttons, and compiles static pages into `project/<id>/index.html`. It also auto-builds sitemap.xml and robots.txt.
6. Local Server & Deployment: Run locally using `python3 -m http.server 8000` and build with `python3 dev/generate.py`. Deployed globally on Cloudflare Pages using Wrangler (wrangler.jsonc). High-fidelity audio assets are hosted on a custom Cloudflare bucket (media.ryanmarch.me).

When helping me, ensure your code proposals follow clean vanilla styling, respect our python-compilation schema, and don't introduce heavy modern frameworks unless explicitly asked.

Do not generate images unless explictly asked.

```
