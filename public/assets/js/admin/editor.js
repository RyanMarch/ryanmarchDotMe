// Store current active file state
let currentFile = {
    path: '',
    sha: '',
    originalContent: ''
};
let jar;
// Sign-in, getAuthHeaders(), the selected branch and the project list live in core.js (loaded on every page).

// Update Draft Status Helper (Green for Synced, Amber for Warnings/Unsaved)
function updateDraftStatus(text, isWarning = false, isRawHTML = false) {
    const draftStatus = document.getElementById('draft-status');
    if (!draftStatus) return;

    if (isWarning) {
        draftStatus.style.color = 'var(--admin-warning)';
    } else if (text === 'Loading...') {
        draftStatus.style.color = 'var(--text-secondary)';
    } else {
        draftStatus.style.color = 'var(--tag-green)';
    }

    if (isRawHTML) {
        draftStatus.innerHTML = text;
    } else {
        draftStatus.textContent = text;
    }
}

// The editor loads lazily (after the page's load event), so set up CodeJar right away.
function initCodeEditor() {
    const editorEl = document.getElementById('editor-textarea');
    if (window.CodeJar && window.Prism) {
        const highlight = editor => {
            let lang = 'html';
            const path = currentFile.path || '';
            if (path.endsWith('.js')) lang = 'javascript';
            if (path.endsWith('.json')) lang = 'json';

            editor.className = `editor-textarea language-${lang}`;
            Prism.highlightElement(editor);
        };
        jar = CodeJar(editorEl, highlight);
        jar.onUpdate(code => {
            saveDraft();
            const findInput = document.getElementById('find-input');
            if (findInput && findInput.value) {
                searchState.query = '';
                window.updateSearch();
            }
        });
    }
}
initCodeEditor();

// Signing out clears the editor; switching branch offers to reload the open file (events from core.js).
document.addEventListener('admin:logout', () => {
    currentFile = { path: '', sha: '', originalContent: '' };
    ['editor-card'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    const search = document.getElementById('file-search');
    if (search) search.value = '';
    document.getElementById('file-search-clear')?.classList.add('hidden');
    const label = document.getElementById('active-file-label');
    if (label) label.textContent = '';
    if (window.setFileListOpen) window.setFileListOpen(true);
    if (window.filterSearchResults) window.filterSearchResults();
});
document.addEventListener('admin:branch-changed', e => {
    const branch = e.detail.branch;
    if (currentFile && currentFile.path
        && confirm(`Target branch changed to '${branch}'. Would you like to reload '${currentFile.path}' from this branch? Unsaved changes will be lost.`)) {
        localStorage.removeItem(`draft_${currentFile.path}`);
        loadFile(currentFile.path);
    }
});

// Utility: UTF-8 safe base64 decoding
function b64DecodeUnicode(str) {
    return new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0)));
}

// Utility: UTF-8 safe base64 encoding
function b64EncodeUnicode(str) {
    return btoa(Array.from(new TextEncoder().encode(str), b => String.fromCharCode(b)).join(''));
}

// File Loader
async function loadFile(filePath) {
    // Fallback to active file if not specified
    if (!filePath) {
        filePath = currentFile.path;
    }

    const editorCard = document.getElementById('editor-card');
    const activeFileLabel = document.getElementById('active-file-label');
    const alertEl = document.getElementById('editor-alert');
    const textarea = document.getElementById('editor-textarea');
    const draftStatus = document.getElementById('draft-status');

    if (!filePath) {
        editorCard.classList.add('hidden');
        activeFileLabel.textContent = '';
        return;
    }

    alertEl.classList.add('hidden');
    updateDraftStatus('Loading...');
    editorCard.classList.remove('hidden');
    textarea.setAttribute('contenteditable', 'false');

    // Reset find in file state on load
    const findInput = document.getElementById('find-input');
    if (findInput) {
        findInput.value = '';
    }
    searchState = { query: '', matches: [], currentIndex: -1 };
    const findStatus = document.getElementById('find-status');
    if (findStatus) {
        findStatus.textContent = '0 of 0';
    }

    try {
        // Fetch file payload through proxy API
         const res = await fetch(`/api/admin/file?path=${filePath}&branch=${window.getSelectedBranch()}`, {
            headers: {
                ...getAuthHeaders()
            }
        });

        if (!res.ok) {
            throw new Error(await res.text());
        }

        const data = await res.json();
        const fileText = b64DecodeUnicode(data.content.replace(/\s/g, ''));

        // Set state
        currentFile.path = filePath;
        currentFile.sha = data.sha;
        currentFile.originalContent = fileText;

        // Set UI (CodeJar or fallback)
        if (jar) {
            jar.updateCode(fileText);
        } else {
            textarea.textContent = fileText;
        }
        activeFileLabel.textContent = `Editing: ${filePath}`;

        // Check if local draft exists
        const savedDraft = localStorage.getItem(`draft_${filePath}`);
        if (savedDraft && savedDraft !== fileText) {
            updateDraftStatus('⚠️ Local draft loaded. <a href="#" onclick="restoreOriginal(event)" style="color: var(--accent-color); text-decoration: underline;">Discard Draft</a>', true, true);
            if (jar) {
                jar.updateCode(savedDraft);
            } else {
                textarea.textContent = savedDraft;
            }
        } else {
            updateDraftStatus('Synced with remote');
        }

        // Check if this is a project index.html file to show and populate Project Data
        const projectDataCard = document.getElementById('project-data-card');
        if (filePath.startsWith('content/') && filePath.endsWith('/index.html')) {
            const parts = filePath.split('/');
            const projectId = parts[1];
            const project = window.myProjects.find(p => p.id === projectId);
            if (project && projectDataCard) {
                projectDataCard.classList.remove('hidden');
                populateEditProjectForm(project);
            } else if (projectDataCard) {
                projectDataCard.classList.add('hidden');
            }
        } else if (projectDataCard) {
            projectDataCard.classList.add('hidden');
        }

        // Toggle templates container visibility
        const templatesContainer = document.getElementById('editor-templates-container');
        if (templatesContainer) {
            if (filePath && filePath.endsWith('.html')) {
                templatesContainer.classList.remove('hidden');
            } else {
                templatesContainer.classList.add('hidden');
            }
        }
    } catch (err) {
        showAlert(alertEl, `Error loading file: ${err.message}`, 'error');
        editorCard.classList.add('hidden');
        activeFileLabel.textContent = '';
        const projectDataCard = document.getElementById('project-data-card');
        if (projectDataCard) projectDataCard.classList.add('hidden');
        const templatesContainer = document.getElementById('editor-templates-container');
        if (templatesContainer) templatesContainer.classList.add('hidden');
    } finally {
        textarea.setAttribute('contenteditable', 'true');
        toggleWrapLines();
        if (window.filterSearchResults) {
            window.filterSearchResults();
        }
    }
}

// Restore original content bypassing draft
function restoreOriginal(e) {
    if (e) e.preventDefault();
    const textarea = document.getElementById('editor-textarea');
    if (jar) {
        jar.updateCode(currentFile.originalContent);
    } else {
        textarea.textContent = currentFile.originalContent;
    }
    localStorage.removeItem(`draft_${currentFile.path}`);
    updateDraftStatus('Synced with remote');
}

// Toggle line wrapping
function toggleWrapLines() {
    const checkbox = document.getElementById('wrap-lines-checkbox');
    const textarea = document.getElementById('editor-textarea');
    if (!checkbox || !textarea) return;
    if (checkbox.checked) {
        textarea.style.whiteSpace = 'pre-wrap';
        textarea.style.wordWrap = 'break-word';
    } else {
        textarea.style.whiteSpace = 'pre';
        textarea.style.wordWrap = 'normal';
    }
}

// Find in File State
let searchState = {
    query: '',
    matches: [],
    currentIndex: -1
};

// Create range helper to map plain text character offset to DOM nodes
function createRangeAtCharacterOffsets(container, start, end) {
    const range = document.createRange();

    let currentOffset = 0;
    let startNode = null;
    let startNodeOffset = 0;
    let endNode = null;
    let endNodeOffset = 0;

    function traverse(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const len = node.length;
            if (!startNode && currentOffset + len >= start) {
                startNode = node;
                startNodeOffset = start - currentOffset;
            }
            if (!endNode && currentOffset + len >= end) {
                endNode = node;
                endNodeOffset = end - currentOffset;
            }
            currentOffset += len;
        } else {
            for (let i = 0; i < node.childNodes.length; i++) {
                traverse(node.childNodes[i]);
                if (startNode && endNode) break;
            }
        }
    }

    traverse(container);

    if (startNode && endNode) {
        range.setStart(startNode, startNodeOffset);
        range.setEnd(endNode, endNodeOffset);
        return range;
    }
    return null;
}

// Handle Keydown in Find Input
window.handleFindKeyDown = function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            window.findPrev();
        } else {
            window.findNext();
        }
    }
}

// Update Search Matches based on current text
window.updateSearch = function () {
    const findInput = document.getElementById('find-input');
    const query = findInput ? findInput.value : '';
    const textarea = document.getElementById('editor-textarea');
    const text = textarea ? textarea.textContent : '';

    if (!query) {
        searchState = { query: '', matches: [], currentIndex: -1 };
        const findStatus = document.getElementById('find-status');
        if (findStatus) {
            findStatus.textContent = '0 of 0';
        }

        // Only clear selection range if user is actively searching/focused on search input
        // to prevent clearing the editor cursor while editing
        if (document.activeElement === findInput) {
            const selection = window.getSelection();
            selection.removeAllRanges();
        }
        return;
    }

    // Rebuild matches if the query changed
    if (searchState.query !== query) {
        searchState.query = query;
        searchState.matches = [];
        searchState.currentIndex = -1;

        let index = 0;
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        while ((index = lowerText.indexOf(lowerQuery, index)) !== -1) {
            searchState.matches.push(index);
            index += query.length;
        }
    }

    const count = searchState.matches.length;
    const findStatus = document.getElementById('find-status');
    if (count > 0) {
        if (searchState.currentIndex === -1) {
            searchState.currentIndex = 0;
        }
        if (findStatus) {
            findStatus.textContent = `${searchState.currentIndex + 1} of ${count}`;
        }
    } else {
        searchState.currentIndex = -1;
        if (findStatus) {
            findStatus.textContent = '0 of 0';
        }
    }
}

// Highlight and scroll the selected match
window.highlightCurrentMatch = function () {
    const textarea = document.getElementById('editor-textarea');
    const findInput = document.getElementById('find-input');
    if (!textarea || searchState.currentIndex === -1 || searchState.matches.length === 0) return;

    const start = searchState.matches[searchState.currentIndex];
    const end = start + searchState.query.length;

    const range = createRangeAtCharacterOffsets(textarea, start, end);
    if (range) {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        // Scroll into view
        const parent = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
        parent.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Refocus search box to keep keyboard open and focus
        if (findInput) {
            findInput.focus();
        }
    }
}

// Find Next Match
window.findNext = function () {
    window.updateSearch();
    if (searchState.matches.length === 0) return;

    searchState.currentIndex = (searchState.currentIndex + 1) % searchState.matches.length;
    const findStatus = document.getElementById('find-status');
    if (findStatus) {
        findStatus.textContent = `${searchState.currentIndex + 1} of ${searchState.matches.length}`;
    }
    window.highlightCurrentMatch();
}

// Find Prev Match
window.findPrev = function () {
    window.updateSearch();
    if (searchState.matches.length === 0) return;

    searchState.currentIndex = (searchState.currentIndex - 1 + searchState.matches.length) % searchState.matches.length;
    const findStatus = document.getElementById('find-status');
    if (findStatus) {
        findStatus.textContent = `${searchState.currentIndex + 1} of ${searchState.matches.length}`;
    }
    window.highlightCurrentMatch();
}

// Save local draft in browser storage
function saveDraft() {
    const textarea = document.getElementById('editor-textarea');
    const editorVal = jar ? jar.toString() : textarea.textContent;

    if (editorVal !== currentFile.originalContent) {
        localStorage.setItem(`draft_${currentFile.path}`, editorVal);
        updateDraftStatus('Unsaved changes (Draft saved locally)', true);
    } else {
        localStorage.removeItem(`draft_${currentFile.path}`);
        updateDraftStatus('Synced');
    }
}

// Insert custom layout templates into CodeJar editor
function getProjectSlug() {
    let slug = 'PROJECT_ID';
    const path = currentFile ? (currentFile.path || '') : '';
    const match = path.match(/^content\/([^\/]+)\//);
    if (match) {
        slug = match[1];
    }
    return slug;
}

function insertTemplate(templateText) {
    const editorEl = document.getElementById('editor-textarea');
    if (!editorEl) return;

    editorEl.focus();

    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (editorEl.contains(range.commonAncestorContainer)) {
            range.deleteContents();
            const textNode = document.createTextNode(templateText);
            range.insertNode(textNode);
            
            // Move cursor after the inserted content
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            sel.removeAllRanges();
            sel.addRange(range);

            if (jar) {
                jar.updateCode(editorEl.textContent);
                saveDraft();
            }
            return;
        }
    }

    // Fallback: append to the end of editor
    if (jar) {
        const currentCode = jar.toString();
        const separator = currentCode.endsWith('\n') || currentCode === '' ? '' : '\n';
        jar.updateCode(currentCode + separator + templateText);
        saveDraft();
    }
}

function insertSectionDivider() {
    const template = `<h4 id="section-id" class="section-divider"><span>Section Title</span></h4>\n<p>\n    Write section content here...\n</p>\n`;
    insertTemplate(template);
}

function insertGalleryBlock() {
    const slug = getProjectSlug();
    const template = `<div class="project-gallery">\n    <div class="gallery-item">\n        <img alt="Image Alt Text" src="content/${slug}/images/hero.webp" loading="lazy" />\n        <div class="gallery-caption">Caption text goes here.</div>\n    </div>\n</div>\n`;
    insertTemplate(template);
}

function insertAudioPlayerBlock() {
    const slug = getProjectSlug();
    const template = `<div class="custom-audio-player" data-title="Audio Title" data-subtitle="Audio Subtitle">\n    <audio src="content/${slug}/audio/track.mp3" preload="metadata"></audio>\n</div>\n`;
    insertTemplate(template);
}

// Context-aware HTML Tag Insertion
function insertHTMLTag(openTag, closeTag) {
    const editorEl = document.getElementById('editor-textarea');
    if (!editorEl) return;

    editorEl.focus();

    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (editorEl.contains(range.commonAncestorContainer)) {
            const selectedText = range.toString();
            
            range.deleteContents();
            
            const openNode = document.createTextNode(openTag);
            const textNode = document.createTextNode(selectedText);
            const closeNode = document.createTextNode(closeTag);
            
            // Insert nodes in reverse order to place them correctly in DOM
            range.insertNode(closeNode);
            range.insertNode(textNode);
            range.insertNode(openNode);
            
            // Position cursor between tags (after selected text)
            range.setStartAfter(textNode);
            range.setEndBefore(closeNode);
            sel.removeAllRanges();
            sel.addRange(range);

            if (jar) {
                jar.updateCode(editorEl.textContent);
                saveDraft();
            }
            return;
        }
    }

    // Fallback: append to the end of editor
    if (jar) {
        const currentCode = jar.toString();
        const separator = currentCode.endsWith('\n') || currentCode === '' ? '' : '\n';
        jar.updateCode(currentCode + separator + openTag + closeTag);
        saveDraft();
    }
}

function isInsideUl() {
    const editorEl = document.getElementById('editor-textarea');
    if (!editorEl) return false;
    
    let textBeforeCursor = '';
    if (jar) {
        const pos = jar.save();
        const currentCode = jar.toString();
        textBeforeCursor = currentCode.substring(0, pos.start);
    } else {
        textBeforeCursor = editorEl.textContent;
    }
    
    const lastUl = textBeforeCursor.lastIndexOf('<ul');
    const lastCloseUl = textBeforeCursor.lastIndexOf('</ul>');
    
    return lastUl > lastCloseUl;
}

function insertParagraphTag() {
    insertHTMLTag('<p>', '</p>');
}

function insertDivTag() {
    insertHTMLTag('<div>', '</div>');
}

function insertLinkTag() {
    insertHTMLTag('<a href="">', '</a>');
}

function insertListTag() {
    if (isInsideUl()) {
        insertHTMLTag('<li>', '</li>');
    } else {
        insertHTMLTag('<ul>\n    <li>', '</li>\n</ul>');
    }
}

// Save file back to GitHub
async function saveFile() {
    const textarea = document.getElementById('editor-textarea');
    const alertEl = document.getElementById('editor-alert');
    const saveBtn = document.getElementById('save-btn');
    const saveBtnText = document.getElementById('save-btn-text');
    const newContent = jar ? jar.toString() : textarea.textContent;

    alertEl.classList.add('hidden');
    saveBtn.disabled = true;
    saveBtnText.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        const b64Content = b64EncodeUnicode(newContent);
        const res = await fetch('/api/admin/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                path: currentFile.path,
                content: b64Content,
                sha: currentFile.sha,
                message: `admin: update ${currentFile.path}`,
                branch: window.getSelectedBranch()
            })
        });

        if (!res.ok) {
            throw new Error(await res.text());
        }

        const data = await res.json();

        // Update file status
        currentFile.sha = data.sha;
        currentFile.originalContent = newContent;
        localStorage.removeItem(`draft_${currentFile.path}`);

        updateDraftStatus('Synced');
        showAlert(alertEl, 'Changes saved successfully! Deploying to live site (takes ~1 min)...', 'success');
    } catch (err) {
        showAlert(alertEl, `Error saving changes: ${err.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtnText.textContent = 'Save Changes';
    }
}

// Toggle New Project Expansion and reset form inputs
function toggleNewProjectForm() {
    const form = document.getElementById('new-project-form');
    const isHidden = form.classList.toggle('hidden');
    if (!isHidden) {
        // Form is opening: clear/reset all fields
        document.getElementById('new-project-title').value = '';
        document.getElementById('new-project-id').value = '';
        document.getElementById('new-project-subtitle').value = '';
        document.getElementById('new-project-subtitle-counter').textContent = '0 characters';
        document.getElementById('new-project-size').value = 'medium';
        document.getElementById('new-project-action-url').value = '';
        document.getElementById('new-project-only-link').checked = false;
        document.getElementById('new-project-source-url').value = '';
        document.getElementById('new-project-source-url-group').classList.add('hidden');

        // Reset searchable tags selector
        window.newProjectSelectedTags = [];
        if (window.renderSelectedTags) {
            window.renderSelectedTags();
        }
        const tagSearchInput = document.getElementById('new-project-tag-search');
        if (tagSearchInput) tagSearchInput.value = '';
        const tagResults = document.getElementById('new-project-tag-results');
        if (tagResults) tagResults.classList.add('hidden');

        // Clear image uploader states
        document.getElementById('new-project-image-file').value = '';
        document.getElementById('new-project-image-preview-container').classList.add('hidden');
        document.getElementById('new-project-image-preview').src = '';
        document.getElementById('new-project-image-name').value = '';

        // Reset placement select
        document.getElementById('new-project-placement').value = 'first';

        // Reset user dirty flag for slug auto-generation
        window.slugEditedByUser = false;
    }
}

// Helper to read local image files as base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const b64 = reader.result.split(',')[1];
            resolve(b64);
        };
        reader.onerror = () => reject(new Error("Error reading local image file."));
        reader.readAsDataURL(file);
    });
}

// Create New Project from Template with custom inputs
async function createNewProject() {
    const titleInput = document.getElementById('new-project-title');
    const idInput = document.getElementById('new-project-id');
    const subtitleInput = document.getElementById('new-project-subtitle');
    const sizeSelect = document.getElementById('new-project-size');
    const actionUrlInput = document.getElementById('new-project-action-url');
    const onlyLinkCheckbox = document.getElementById('new-project-only-link');
    const sourceUrlInput = document.getElementById('new-project-source-url');
    const imageFileInput = document.getElementById('new-project-image-file');
    const imageNameInput = document.getElementById('new-project-image-name');
    const placementSelect = document.getElementById('new-project-placement');
    const createBtn = document.getElementById('create-project-btn');

    const title = titleInput.value.trim();
    const id = idInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const subtitle = subtitleInput.value.trim();
    const size = sizeSelect.value;
    const actionUrl = actionUrlInput.value.trim();
    const hasExtendedContent = !onlyLinkCheckbox.checked;
    const sourceUrl = hasExtendedContent && actionUrl ? sourceUrlInput.value.trim() : '';
    const placement = placementSelect.value;

    if (!title) {
        alert('Please enter a project title/name.');
        return;
    }

    if (!id) {
        alert('Please enter a valid lowercase project ID/slug.');
        return;
    }



    // Check if project already exists locally
    if (window.myProjects && window.myProjects.some(p => p.id === id)) {
        alert('Project ID already exists in the database.');
        return;
    }

    // Read tags
    const selectedTags = window.newProjectSelectedTags || [];

    // Handle preview image validation
    let imageFile = null;
    let imageName = '';
    if (imageFileInput.files && imageFileInput.files.length > 0) {
        imageFile = imageFileInput.files[0];
        imageName = imageNameInput.value.trim().toLowerCase().replace(/[^a-z0-9\._-]/g, '');
        if (!imageName) {
            alert('Please enter a valid target filename for the preview image.');
            return;
        }
    }

    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="spinner"></span> Creating...';

    try {
        let imagePath = '';
        // 1. Upload preview image if selected
        if (imageFile) {
            const b64Image = await readFileAsBase64(imageFile);
            imagePath = `content/${id}/images/${imageName}`;

            const imgRes = await fetch('/api/admin/file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    path: imagePath,
                    content: b64Image,
                    message: `admin: upload preview image for ${id}`,
                    branch: window.getSelectedBranch()
                })
            });
            if (!imgRes.ok) {
                throw new Error(`Failed to upload preview image: ${await imgRes.text()}`);
            }
        }

        const targetPath = `content/${id}/index.html`;

        // 2. Create content template file (if hasExtendedContent is true)
        if (hasExtendedContent) {
            const templateContent = `<!-- Header Details -->
<h2 class="project-title">${title}</h2>
<p class="project-subtitle">${subtitle || 'Project Subtitle'}</p>
<p class="project-description">Role • Date • Client</p>

<!-- Table of Contents is generated AUTOMATICALLY based on <h4> tags below! -->

<h4 id="introduction" class="section-divider"><span>Introduction</span></h4>
<p>
    Write a brief introduction about what this project is.
</p>

<h4 id="the-challenge" class="section-divider"><span>The Challenge</span></h4>
<p>
    Describe the core problem solved.
</p>

<h4 id="the-solution" class="section-divider"><span>The Solution</span></h4>
<p>
    Detail your technical execution and implementation steps.
</p>

<h4 id="outcomes" class="section-divider"><span>Outcomes & Impact</span></h4>
<p>
    Highlight key metrics, achievements, or project takeaways.
</p>
`;
            const b64Content = b64EncodeUnicode(templateContent);
            const res = await fetch('/api/admin/file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    path: targetPath,
                    content: b64Content,
                    message: `admin: create project for ${id}`,
                    branch: window.getSelectedBranch()
                })
            });

            if (!res.ok) {
                throw new Error(await res.text());
            }
        }

        // 3. Fetch assets/js/project-data.js to append the metadata
        const dbRes = await fetch(`/api/admin/file?path=assets/js/project-data.js&branch=${window.getSelectedBranch()}`, {
            headers: {
                ...getAuthHeaders()
            }
        });
        if (!dbRes.ok) {
            throw new Error(`Failed to load project database: ${await dbRes.text()}`);
        }
        const dbData = await dbRes.json();
        const dbContent = b64DecodeUnicode(dbData.content.replace(/\s/g, ''));

        // Construct tag list formatting matching project-data.js
        const tagsFormatted = selectedTags.length > 0
            ? `[\n${selectedTags.map(t => `            { label: "${t.label}", color: "${t.color}" }`).join(',\n')}\n        ]`
            : `[]`;

        const newProjectObject = `
    {
id: "${id}",
title: "${title}",
subtitle: "${subtitle}",
tags: ${tagsFormatted},
featured: false,
size: "${size}",
image: "${imagePath}",
actionText: "View Project",
actionUrl: "${actionUrl}",
sourceUrl: "${sourceUrl}",
hasExtendedContent: ${hasExtendedContent}
    }`;

        let updatedDbContent = '';

        if (placement === 'first') {
            // Prepend to array
            const insertionPoint = 'export const myProjects = [';
            const insertIndex = dbContent.indexOf(insertionPoint);
            if (insertIndex === -1) {
                throw new Error("Could not find 'export const myProjects = [' in project-data.js");
            }

            const before = dbContent.substring(0, insertIndex + insertionPoint.length);
            const after = dbContent.substring(insertIndex + insertionPoint.length);

            updatedDbContent = before + newProjectObject + ',' + after;
        } else {
            // Append to array
            const lastIndex = dbContent.lastIndexOf('];');
            if (lastIndex === -1) {
                throw new Error("Could not find closing '];' in project-data.js");
            }
            let before = dbContent.substring(0, lastIndex);
            const after = dbContent.substring(lastIndex);

            // Add comma to previous last element if it doesn't have one
            const trimmedBefore = before.trim();
            if (trimmedBefore.endsWith('}')) {
                const lastBraceIndex = before.lastIndexOf('}');
                before = before.substring(0, lastBraceIndex + 1) + ',' + before.substring(lastBraceIndex + 1);
            }
            updatedDbContent = before + newProjectObject + '\n' + after;
        }

        const b64UpdatedDb = b64EncodeUnicode(updatedDbContent);

        const dbUpdateRes = await fetch('/api/admin/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                path: 'assets/js/project-data.js',
                content: b64UpdatedDb,
                sha: dbData.sha,
                message: `admin: add project metadata for ${id}`,
                branch: window.getSelectedBranch()
            })
        });

        if (!dbUpdateRes.ok) {
            throw new Error(`Failed to save project database: ${await dbUpdateRes.text()}`);
        }

        // sitemap.xml is generated from project-data.js at build time (scripts/sitemap-generator.js), so there is nothing to update here.

        // 4. Mutate local array state to sync frontend
        const localProjectObj = {
            id: id,
            title: title,
            subtitle: subtitle,
            tags: selectedTags,
            featured: false,
            size: size,
            image: imagePath,
            actionText: "View Project",
            actionUrl: actionUrl,
            sourceUrl: sourceUrl,
            hasExtendedContent: hasExtendedContent
        };

        if (window.myProjects) {
            if (placement === 'first') {
                window.myProjects.unshift(localProjectObj);
            } else {
                window.myProjects.push(localProjectObj);
            }
        }

        // Update dropdown list and load editor
        if (window.applyProjectsList) {
            window.applyProjectsList(window.myProjects);
        }
        const searchInput = document.getElementById('file-search');
        const clearBtn = document.getElementById('file-search-clear');
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');

        if (hasExtendedContent) {
            if (window.setFileListOpen) window.setFileListOpen(false);

            // Sync with image uploader dropdown
            syncImageUploader(targetPath);

            toggleNewProjectForm();
            await loadFile(targetPath);
            showAlert(document.getElementById('editor-alert'), 'Created project template and updated database! Edit details below.', 'info');
        } else {
            // Update search files (since it doesn't have content, don't list in search files)
            toggleNewProjectForm();

            // Hide editor card if active
            document.getElementById('editor-card').classList.add('hidden');
            document.getElementById('active-file-label').textContent = '';

            alert(`Successfully created link-only project database entry: ${title}!`);
        }

    } catch (err) {
        alert(`Error creating project: ${err.message}`);
    } finally {
        createBtn.disabled = false;
        createBtn.textContent = 'Create & Edit Template';
    }
}

// Image Selection Auto-Naming
function suggestImageName() {
    const fileInput = document.getElementById('upload-file');
    const nameInput = document.getElementById('upload-name');
    if (fileInput.files && fileInput.files.length > 0) {
        const fileName = fileInput.files[0].name.toLowerCase().replace(/[^a-z0-9\._-]/g, '');
        nameInput.value = fileName;
    }
}

// Client-side image resizing via HTML5 Canvas
function resizeImageClientSide(dataUrl, filename, folderPath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = function () {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Set the target width based on project specs, or default to 50% width
                // max width 800px is excellent for case studies / mobile screens
                let targetWidth = Math.round(img.width / 2);
                if (folderPath.includes('icon-studio')) {
                    targetWidth = 400;
                } else if (folderPath.includes('motion-poster')) {
                    targetWidth = 600;
                } else if (folderPath.includes('bowserstack')) {
                    targetWidth = 300;
                } else if (folderPath.includes('rentpress')) {
                    targetWidth = 485;
                } else if (folderPath.includes('aasc-analytics')) {
                    targetWidth = 800;
                } else {
                    // Default to max 800px or half original width
                    targetWidth = Math.min(800, targetWidth);
                }
                
                // Don't upscale if the original image is already smaller than target width
                if (img.width <= targetWidth) {
                    resolve(null); // skip resizing
                    return;
                }

                const scaleFactor = targetWidth / img.width;
                const targetHeight = Math.round(img.height * scaleFactor);

                canvas.width = targetWidth;
                canvas.height = targetHeight;

                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                // Match original image mime type where possible
                let mimeType = 'image/jpeg';
                let quality = 0.85;
                if (filename.endsWith('.webp')) {
                    mimeType = 'image/webp';
                    quality = 0.82;
                } else if (filename.endsWith('.png')) {
                    mimeType = 'image/png';
                }

                const resizedDataUrl = canvas.toDataURL(mimeType, quality);
                const b64 = resizedDataUrl.split(',')[1];
                resolve(b64);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = function (err) {
            reject(err);
        };
    });
}

// Upload Image (with automatic resizing variant upload)
async function uploadImage() {
    const folderSelect = document.getElementById('upload-project');
    const fileInput = document.getElementById('upload-file');
    const nameInput = document.getElementById('upload-name');
    const alertEl = document.getElementById('upload-alert');
    const uploadBtn = document.getElementById('upload-btn');

    if (!fileInput.files || fileInput.files.length === 0) {
        showAlert(alertEl, 'Please select an image file to upload.', 'error');
        return;
    }

    const targetName = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9\._-]/g, '');
    if (!targetName) {
        showAlert(alertEl, 'Please enter a valid filename.', 'error');
        return;
    }

    alertEl.classList.add('hidden');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner"></span> Uploading...';

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function () {
        const dataUrl = reader.result;
        const b64Content = dataUrl.split(',')[1];
        const targetPath = `${folderSelect.value}/${targetName}`;

        // Helper to perform file upload via API
        async function uploadFileApi(path, base64Data) {
            let existingSha = null;
            try {
                const checkRes = await fetch(`/api/admin/file?path=${path}&branch=${window.getSelectedBranch()}`, {
                    headers: {
                        ...getAuthHeaders()
                    }
                });
                if (checkRes.ok) {
                    const checkData = await checkRes.json();
                    existingSha = checkData.sha;
                }
            } catch (e) {}

            const res = await fetch('/api/admin/file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    path: path,
                    content: base64Data,
                    sha: existingSha,
                    message: `admin: upload ${path}`,
                    branch: window.getSelectedBranch()
                })
            });

            if (!res.ok) {
                throw new Error(await res.text());
            }
            return true;
        }

        try {
            // 1. Upload original file
            await uploadFileApi(targetPath, b64Content);
            let successHtml = `Success! Original image uploaded to <strong>${targetPath}</strong>.`;

            // 2. Only resize if file is an image and is uploaded to a content/ project folder
            if (file.type.startsWith('image/') && folderSelect.value.startsWith('content/')) {
                try {
                    const resizedB64 = await resizeImageClientSide(dataUrl, targetName, folderSelect.value);
                    if (resizedB64) {
                        // Determine resized path
                        const lastDot = targetName.lastIndexOf('.');
                        const isAasc = folderSelect.value.includes('aasc-analytics');
                        const suffix = isAasc ? '-small' : '-sm';
                        let smallName = '';
                        if (lastDot !== -1) {
                            smallName = targetName.substring(0, lastDot) + suffix + targetName.substring(lastDot);
                        } else {
                            smallName = targetName + suffix;
                        }
                        const smallPath = `${folderSelect.value}/${smallName}`;
                        
                        // Upload resized file in parallel
                        await uploadFileApi(smallPath, resizedB64);
                        successHtml += `<br>Auto-resized variant uploaded to <strong>${smallPath}</strong>.`;
                    }
                } catch (resizeErr) {
                    console.error('Image auto-resizing failed, skipped resizing:', resizeErr);
                }
            }

            showAlert(alertEl, `${successHtml}<br>Copy the original path to embed in your HTML: <strong>${targetPath}</strong>`, 'success');
            fileInput.value = '';
            nameInput.value = '';
        } catch (err) {
            showAlert(alertEl, `Error uploading image: ${err.message}`, 'error');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload Image';
        }
    };

    reader.onerror = function () {
        showAlert(alertEl, 'Error reading local file.', 'error');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Image';
    };

    reader.readAsDataURL(file);
}

// Shared Alert Display helper
function showAlert(element, message, type) {
    element.className = `alert alert-${type}`;
    element.innerHTML = message;
    element.classList.remove('hidden');
}

// Toggle Image Uploader body
function toggleUploader() {
    const body = document.getElementById('uploader-body');
    const chevron = document.getElementById('uploader-chevron');
    const isHidden = body.classList.toggle('hidden');
    chevron.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
}

// --- NEW PROJECT DATA EDITOR SCRIPTS ---

// Toggle Project Data Card body
function toggleProjectDataCard() {
    const body = document.getElementById('project-data-body');
    const chevron = document.getElementById('project-data-chevron');
    const isHidden = body.classList.toggle('hidden');
    chevron.style.transform = isHidden ? 'rotate(-90deg)' : 'rotate(0deg)';
}
window.toggleProjectDataCard = toggleProjectDataCard;

// Populate the Project Data edit form fields
window.editingProjectId = '';
function populateEditProjectForm(project) {
    window.editingProjectId = project.id;

    document.getElementById('edit-project-title').value = project.title || '';
    document.getElementById('edit-project-id').value = project.id || '';
    document.getElementById('edit-project-subtitle').value = project.subtitle || '';

    const subtitleLen = (project.subtitle || '').length;
    document.getElementById('edit-project-subtitle-counter').textContent = `${subtitleLen} characters`;

    document.getElementById('edit-project-size').value = project.size || 'medium';

    window.editProjectSelectedTags = JSON.parse(JSON.stringify(project.tags || []));
    renderEditSelectedTags();

    document.getElementById('edit-project-tag-search').value = '';
    document.getElementById('edit-project-tag-results').classList.add('hidden');

    document.getElementById('edit-project-action-url').value = project.actionUrl || '';

    const onlyLinkCheckbox = document.getElementById('edit-project-only-link');
    onlyLinkCheckbox.checked = !project.hasExtendedContent;

    const sourceUrlGroup = document.getElementById('edit-project-source-url-group');
    const sourceUrlInput = document.getElementById('edit-project-source-url');
    sourceUrlInput.value = project.sourceUrl || '';
    if (project.actionUrl && project.actionUrl.trim() !== '') {
        sourceUrlGroup.classList.remove('hidden');
    } else {
        sourceUrlGroup.classList.add('hidden');
    }

    document.getElementById('edit-project-image-path').value = project.image || '';

    // Clear image uploader states for editing
    document.getElementById('edit-project-image-file').value = '';
    document.getElementById('edit-project-image-preview-container').classList.add('hidden');
    document.getElementById('edit-project-image-preview').src = '';
    document.getElementById('edit-project-image-name').value = '';

    // Reset alert container
    const alertEl = document.getElementById('project-data-alert');
    if (alertEl) alertEl.classList.add('hidden');
}
window.populateEditProjectForm = populateEditProjectForm;

// Render selected tags for edit form
window.editProjectSelectedTags = [];
function renderEditSelectedTags() {
    const container = document.getElementById('edit-project-selected-tags');
    if (!container) return;
    container.innerHTML = '';

    if (window.editProjectSelectedTags.length === 0) {
        const hint = document.createElement('span');
        hint.style.fontSize = '0.8rem';
        hint.style.color = 'var(--text-secondary)';
        hint.textContent = 'No tags selected';
        container.appendChild(hint);
        return;
    }

    window.editProjectSelectedTags.forEach(tag => {
        const badge = document.createElement('span');
        badge.className = `tag tag-${tag.color}`;
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '0.35rem';
        badge.style.cursor = 'pointer';
        badge.innerHTML = `${tag.label} <span style="font-weight: bold; opacity: 0.7;">✕</span>`;
        badge.onclick = () => {
            removeEditSelectedTag(tag.label);
        };
        container.appendChild(badge);
    });
}
window.renderEditSelectedTags = renderEditSelectedTags;

// Remove tag from edit form selection
function removeEditSelectedTag(label) {
    window.editProjectSelectedTags = window.editProjectSelectedTags.filter(t => t.label !== label);
    renderEditSelectedTags();
    filterEditTagSearchResults();
}
window.removeEditSelectedTag = removeEditSelectedTag;

// Show edit form tag results dropdown
function showEditTagSearchResults() {
    const resultsDiv = document.getElementById('edit-project-tag-results');
    if (resultsDiv) {
        resultsDiv.classList.remove('hidden');
        filterEditTagSearchResults();
    }
}
window.showEditTagSearchResults = showEditTagSearchResults;

// Filter edit form tag results dropdown
function filterEditTagSearchResults() {
    if (window.renderTagDropdown) {
        window.renderTagDropdown('edit-project-tag-search', 'edit-project-tag-results', window.editProjectSelectedTags, renderEditSelectedTags);
    }
}
window.filterEditTagSearchResults = filterEditTagSearchResults;

// Populate upload targets dropdown dynamically
function populateUploadProjectDropdown() {
    const uploadProjectSelect = document.getElementById('upload-project');
    if (!uploadProjectSelect) return;
    const previousValue = uploadProjectSelect.value;
    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'assets/img';
    defaultOpt.textContent = 'assets/img/ (Global Site Images)';
    uploadProjectSelect.replaceChildren(defaultOpt);
    (window.myProjects || []).forEach(project => {
        const optUpload = document.createElement('option');
        optUpload.value = `content/${project.id}/images`;
        optUpload.textContent = `content/${project.id}/images/ (${project.title})`;
        uploadProjectSelect.appendChild(optUpload);
    });
    if (previousValue && Array.from(uploadProjectSelect.options).some(opt => opt.value === previousValue)) {
        uploadProjectSelect.value = previousValue;
    }
}
window.populateUploadProjectDropdown = populateUploadProjectDropdown;

// Pretty serialize project object literal for project-data.js
function serializeProjectObject(project) {
    const lines = [];
    lines.push('    {');
    const keys = Object.keys(project);
    keys.forEach((key, index) => {
        const val = project[key];
        let valStr = '';
        if (key === 'tags') {
            if (Array.isArray(val) && val.length > 0) {
                valStr = `[\n${val.map(t => `            { label: "${t.label}", color: "${t.color}"${t.priority ? `, priority: "${t.priority}"` : ''} }`).join(',\n')}\n        ]`;
            } else {
                valStr = '[]';
            }
        } else if (typeof val === 'string') {
            valStr = `"${val.replace(/"/g, '\\"')}"`;
        } else if (typeof val === 'boolean' || typeof val === 'number') {
            valStr = val.toString();
        } else {
            valStr = JSON.stringify(val);
        }
        const comma = (index === keys.length - 1) ? '' : ',';
        lines.push(`        ${key}: ${valStr}${comma}`);
    });
    lines.push('    }');
    return lines.join('\n');
}

// Find character boundaries of a project object literal by project slug
function findProjectObjectBounds(dbContent, projectId) {
    const doubleQuotePattern = `id:\\s*"${projectId}"`;
    const singleQuotePattern = `id:\\s*'${projectId}'`;
    let match = dbContent.match(new RegExp(doubleQuotePattern));
    if (!match) {
        match = dbContent.match(new RegExp(singleQuotePattern));
    }
    if (!match) return null;
    const matchIndex = match.index;
    let braceCount = 0;
    let startIndex = -1;
    for (let i = matchIndex; i >= 0; i--) {
        if (dbContent[i] === '}') {
            braceCount--;
        } else if (dbContent[i] === '{') {
            braceCount++;
            if (braceCount === 1) {
                startIndex = i;
                break;
            }
        }
    }
    if (startIndex === -1) return null;
    braceCount = 0;
    let endIndex = -1;
    for (let i = startIndex; i < dbContent.length; i++) {
        if (dbContent[i] === '{') {
            braceCount++;
        } else if (dbContent[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                endIndex = i;
                break;
            }
        }
    }
    if (endIndex === -1) return null;
    return { start: startIndex, end: endIndex };
}

// Save project metadata edits to database and optionally rename slug path
async function saveProjectData() {
    const titleInput = document.getElementById('edit-project-title');
    const idInput = document.getElementById('edit-project-id');
    const subtitleInput = document.getElementById('edit-project-subtitle');
    const sizeSelect = document.getElementById('edit-project-size');
    const actionUrlInput = document.getElementById('edit-project-action-url');
    const onlyLinkCheckbox = document.getElementById('edit-project-only-link');
    const sourceUrlInput = document.getElementById('edit-project-source-url');
    const imagePathInput = document.getElementById('edit-project-image-path');
    const imageFileInput = document.getElementById('edit-project-image-file');
    const imageNameInput = document.getElementById('edit-project-image-name');
    const saveBtn = document.getElementById('save-project-data-btn');
    const alertEl = document.getElementById('project-data-alert');

    const title = titleInput.value.trim();
    const newId = idInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const subtitle = subtitleInput.value.trim();
    const size = sizeSelect.value;
    const actionUrl = actionUrlInput.value.trim();
    const hasExtendedContent = !onlyLinkCheckbox.checked;
    const sourceUrl = hasExtendedContent && actionUrl ? sourceUrlInput.value.trim() : '';
    let imagePath = imagePathInput.value.trim();

    if (!title) {
        alert('Please enter a project title/name.');
        return;
    }

    if (!newId) {
        alert('Please enter a valid lowercase project ID/slug.');
        return;
    }



    // Check if slug already exists (excluding the current editing project)
    if (newId !== window.editingProjectId) {
        if (window.myProjects && window.myProjects.some(p => p.id === newId)) {
            alert('Project ID already exists in the database.');
            return;
        }
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
    alertEl.classList.add('hidden');

    try {
        // 1. Upload preview image if selected
        if (imageFileInput.files && imageFileInput.files.length > 0) {
            const file = imageFileInput.files[0];
            const imageName = imageNameInput.value.trim().toLowerCase().replace(/[^a-z0-9\._-]/g, '');
            if (!imageName) {
                throw new Error('Please enter a valid target filename for the preview image.');
            }

            const b64Image = await readFileAsBase64(file);
            imagePath = `content/${newId}/images/${imageName}`;

            const imgRes = await fetch('/api/admin/file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    path: imagePath,
                    content: b64Image,
                    message: `admin: upload preview image for ${newId}`,
                    branch: window.getSelectedBranch()
                })
            });
            if (!imgRes.ok) {
                throw new Error(`Failed to upload preview image: ${await imgRes.text()}`);
            }
            imagePathInput.value = imagePath;
        }

        // 2. If the project ID changed, copy the current template file to the new path
        let oldPath = `content/${window.editingProjectId}/index.html`;
        let newPath = `content/${newId}/index.html`;

        if (newId !== window.editingProjectId && hasExtendedContent) {
            const editorTextarea = document.getElementById('editor-textarea');
            const editorContent = jar ? jar.toString() : editorTextarea.textContent;
            const b64Content = b64EncodeUnicode(editorContent);

            const res = await fetch('/api/admin/file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    path: newPath,
                    content: b64Content,
                    message: `admin: move project template from ${window.editingProjectId} to ${newId}`,
                    branch: window.getSelectedBranch()
                })
            });

            if (!res.ok) {
                throw new Error(`Failed to copy project template to new slug path: ${await res.text()}`);
            }
            const resData = await res.json();
            currentFile.sha = resData.sha;
        }

        // 3. Fetch assets/js/project-data.js to update the metadata
        const dbRes = await fetch(`/api/admin/file?path=assets/js/project-data.js&branch=${window.getSelectedBranch()}`, {
            headers: {
                ...getAuthHeaders()
            }
        });
        if (!dbRes.ok) {
            throw new Error(`Failed to load project database: ${await dbRes.text()}`);
        }
        const dbData = await dbRes.json();
        const dbContent = b64DecodeUnicode(dbData.content.replace(/\s/g, ''));

        // Find the bounds of the project in the file
        const bounds = findProjectObjectBounds(dbContent, window.editingProjectId);
        if (!bounds) {
            throw new Error(`Could not locate project object for '${window.editingProjectId}' in project-data.js`);
        }

        // Retrieve original project object from local myProjects to preserve all non-form fields
        const localProj = window.myProjects.find(p => p.id === window.editingProjectId);
        if (!localProj) {
            throw new Error(`Local project data not found for '${window.editingProjectId}'`);
        }

        // Merge updated properties
        const updatedProj = {
            ...localProj,
            id: newId,
            title: title,
            subtitle: subtitle,
            tags: window.editProjectSelectedTags || [],
            size: size,
            image: imagePath,
            actionUrl: actionUrl,
            sourceUrl: sourceUrl,
            hasExtendedContent: hasExtendedContent
        };

        const serialized = serializeProjectObject(updatedProj);

        const before = dbContent.substring(0, bounds.start);
        const after = dbContent.substring(bounds.end + 1);
        const updatedDbContent = before + serialized + after;
        const b64UpdatedDb = b64EncodeUnicode(updatedDbContent);

        const dbUpdateRes = await fetch('/api/admin/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                path: 'assets/js/project-data.js',
                content: b64UpdatedDb,
                sha: dbData.sha,
                message: `admin: update project metadata for ${newId}`,
                branch: window.getSelectedBranch()
            })
        });

        if (!dbUpdateRes.ok) {
            throw new Error(`Failed to save project database: ${await dbUpdateRes.text()}`);
        }

        // 4. Update local state
        const oldId = window.editingProjectId;

        // Auto-update redirects.json if slug changed
        if (newId !== oldId) {
            try {
                const redirectsRes = await fetch(`/api/admin/file?path=redirects.json&branch=${window.getSelectedBranch()}`, {
                    headers: {
                        ...getAuthHeaders()
                    }
                });
                if (redirectsRes.ok) {
                    const redirectsData = await redirectsRes.json();
                    const redirectsJsonStr = b64DecodeUnicode(redirectsData.content.replace(/\s/g, ''));

                    const updatedRedirects = updateRedirectsContent(redirectsJsonStr, oldId, newId);
                    const b64Redirects = b64EncodeUnicode(updatedRedirects);

                    await fetch('/api/admin/file', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeaders()
                        },
                        body: JSON.stringify({
                            path: 'redirects.json',
                            content: b64Redirects,
                            sha: redirectsData.sha,
                            message: `admin: add redirect from ${oldId} to ${newId}`,
                            branch: window.getSelectedBranch()
                        })
                    });
                }
            } catch (e) {
                console.error('Failed to auto-update redirects:', e);
            }
        }

        // Update local window.myProjects array
        const index = window.myProjects.findIndex(p => p.id === oldId);
        if (index !== -1) {
            window.myProjects[index] = updatedProj;
        }

        // Update searchFiles list and dropdown selection
        if (hasExtendedContent) {
            document.getElementById('active-file-label').textContent = `Editing: ${newPath}`;
            currentFile.path = newPath;
        }

        if (window.applyProjectsList) {
            window.applyProjectsList(window.myProjects);
        }

        const searchInput = document.getElementById('file-search');
        const clearBtn = document.getElementById('file-search-clear');
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.classList.add('hidden');
        if (window.setFileListOpen) window.setFileListOpen(false);

        // Update global state
        window.editingProjectId = newId;

        // Sync image uploader target
        syncImageUploader(newPath);

        // Show success alert
        showAlert(alertEl, 'Project data saved successfully! Deploying to live site (takes ~1 min)...', 'success');
    } catch (err) {
        showAlert(alertEl, `Error saving project data: ${err.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Project Data';
    }
}
window.saveProjectData = saveProjectData;

// Update redirects content
function updateRedirectsContent(redirectsJsonStr, oldSlug, newSlug) {
    let redirects = [];
    try {
        redirects = JSON.parse(redirectsJsonStr);
    } catch (e) {
        redirects = [];
    }

    const oldSource = `/project/${oldSlug}/`;
    const newDestination = `/project/${newSlug}/`;

    const exists = redirects.some(r =>
        r.source.toLowerCase().replace(/\/+$/, '') === oldSource.toLowerCase().replace(/\/+$/, '')
    );

    if (!exists) {
        redirects.push({
            source: oldSource,
            destination: newDestination,
            permanent: true
        });
    }

    return JSON.stringify(redirects, null, 2);
}
window.updateRedirectsContent = updateRedirectsContent;
