import { myProjects } from '/assets/js/project-data.js';
import { parseProjectDataSource } from '/assets/js/admin-project-parser.js';
window.myProjects = myProjects;

// Detect local dev vs production (Cloudflare Access is not active on localhost)
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Load project lists into UI dropdowns on startup
window.addEventListener('DOMContentLoaded', () => {
    // Initialize target branch from localStorage
    const savedBranch = localStorage.getItem('admin_selected_branch') || 'main';
    const branchSelect = document.getElementById('branch-select');
    if (branchSelect) {
        branchSelect.value = savedBranch;
    }

    // Initialize bundled list immediately, then refresh from selected branch when authenticated
    applyProjectsList(myProjects);
    populateFormTags();
    setFileListOpen(true);

    const fileListToggle = document.getElementById('file-list-toggle');
    if (fileListToggle) {
        fileListToggle.addEventListener('click', () => {
            const resultsDiv = document.getElementById('file-search-results');
            const isOpen = resultsDiv && !resultsDiv.classList.contains('hidden');
            setFileListOpen(!isOpen);
            if (!isOpen) {
                filterSearchResults();
            }
        });
    }

    const fileSearchClear = document.getElementById('file-search-clear');
    if (fileSearchClear) {
        fileSearchClear.addEventListener('click', () => {
            const searchInput = document.getElementById('file-search');
            if (searchInput) {
                searchInput.value = '';
            }
            setFileListOpen(true);
            filterSearchResults();
            if (searchInput) {
                searchInput.focus();
            }
        });
    }

    // Set up slug generation listeners
    const titleInput = document.getElementById('new-project-title');
    const idInput = document.getElementById('new-project-id');
    window.slugEditedByUser = false;

    idInput.addEventListener('input', () => {
        window.slugEditedByUser = true;
        idInput.value = idInput.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    });

    titleInput.addEventListener('input', () => {
        if (!window.slugEditedByUser) {
            idInput.value = titleInput.value
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }
    });

    // Subtitle length and counter check
    const subtitleInput = document.getElementById('new-project-subtitle');
    const subtitleCounter = document.getElementById('new-project-subtitle-counter');
    subtitleInput.addEventListener('input', () => {
        const len = subtitleInput.value.length;
        subtitleCounter.textContent = `${len} characters`;
    });

    // URL input event listeners
    const actionUrlInput = document.getElementById('new-project-action-url');
    const sourceUrlGroup = document.getElementById('new-project-source-url-group');
    const sourceUrlInput = document.getElementById('new-project-source-url');

    actionUrlInput.addEventListener('input', () => {
        if (actionUrlInput.value.trim() !== '') {
            sourceUrlGroup.classList.remove('hidden');
        } else {
            sourceUrlGroup.classList.add('hidden');
            sourceUrlInput.value = '';
        }
    });

    // Image uploader & preview handlers
    const imageFileInput = document.getElementById('new-project-image-file');
    const previewContainer = document.getElementById('new-project-image-preview-container');
    const previewImg = document.getElementById('new-project-image-preview');
    const imageNameInput = document.getElementById('new-project-image-name');

    imageFileInput.addEventListener('change', () => {
        if (imageFileInput.files && imageFileInput.files.length > 0) {
            const file = imageFileInput.files[0];
            const sanitizedName = file.name.toLowerCase().replace(/[^a-z0-9\._-]/g, '');
            imageNameInput.value = sanitizedName;

            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                previewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            previewContainer.classList.add('hidden');
            previewImg.src = '';
            imageNameInput.value = '';
        }
    });

    imageNameInput.addEventListener('input', () => {
        imageNameInput.value = imageNameInput.value.toLowerCase().replace(/[^a-z0-9\._-]/g, '');
    });

    // Set up edit project slug listener
    const editIdInput = document.getElementById('edit-project-id');
    if (editIdInput) {
        editIdInput.addEventListener('input', () => {
            editIdInput.value = editIdInput.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        });
    }

    // Edit project subtitle length and counter check
    const editSubtitleInput = document.getElementById('edit-project-subtitle');
    const editSubtitleCounter = document.getElementById('edit-project-subtitle-counter');
    if (editSubtitleInput && editSubtitleCounter) {
        editSubtitleInput.addEventListener('input', () => {
            const len = editSubtitleInput.value.length;
            editSubtitleCounter.textContent = `${len} characters`;
        });
    }

    // Edit project URL input event listeners
    const editActionUrlInput = document.getElementById('edit-project-action-url');
    const editSourceUrlGroup = document.getElementById('edit-project-source-url-group');
    const editSourceUrlInput = document.getElementById('edit-project-source-url');

    if (editActionUrlInput && editSourceUrlGroup && editSourceUrlInput) {
        editActionUrlInput.addEventListener('input', () => {
            if (editActionUrlInput.value.trim() !== '') {
                editSourceUrlGroup.classList.remove('hidden');
            } else {
                editSourceUrlGroup.classList.add('hidden');
                editSourceUrlInput.value = '';
            }
        });
    }

    // Edit project image file & preview handlers
    const editImageFileInput = document.getElementById('edit-project-image-file');
    const editPreviewContainer = document.getElementById('edit-project-image-preview-container');
    const editPreviewImg = document.getElementById('edit-project-image-preview');
    const editImageNameInput = document.getElementById('edit-project-image-name');
    const editImagePathInput = document.getElementById('edit-project-image-path');

    if (editImageFileInput && editPreviewContainer && editPreviewImg && editImageNameInput && editImagePathInput) {
        editImageFileInput.addEventListener('change', () => {
            if (editImageFileInput.files && editImageFileInput.files.length > 0) {
                const file = editImageFileInput.files[0];
                const sanitizedName = file.name.toLowerCase().replace(/[^a-z0-9\._-]/g, '');
                editImageNameInput.value = sanitizedName;

                const reader = new FileReader();
                reader.onload = (e) => {
                    editPreviewImg.src = e.target.result;
                    editPreviewContainer.classList.remove('hidden');

                    const slug = editIdInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || window.editingProjectId;
                    editImagePathInput.value = `content/${slug}/images/${sanitizedName}`;
                };
                reader.readAsDataURL(file);
            } else {
                editPreviewContainer.classList.add('hidden');
                editPreviewImg.src = '';
                editImageNameInput.value = '';
            }
        });

        editImageNameInput.addEventListener('input', () => {
            const sanitizedName = editImageNameInput.value.toLowerCase().replace(/[^a-z0-9\._-]/g, '');
            editImageNameInput.value = sanitizedName;
            if (sanitizedName) {
                const slug = editIdInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || window.editingProjectId;
                editImagePathInput.value = `content/${slug}/images/${sanitizedName}`;
            }
        });
    }

    // Password input listeners for login view
    const passcodeInput = document.getElementById('passcode-input');
    const loginBtn = document.getElementById('login-btn');

    if (passcodeInput && loginBtn) {
        const updateButtonState = () => {
            loginBtn.disabled = passcodeInput.value.trim() === '';
        };

        passcodeInput.addEventListener('input', updateButtonState);
        passcodeInput.addEventListener('change', updateButtonState);

        passcodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !loginBtn.disabled) {
                checkAuth();
            }
        });

        // Check initial state (e.g. autofill)
        updateButtonState();
        setTimeout(updateButtonState, 100);
    }

    // Production: Cloudflare Access already authenticated — skip the password screen
    // (CF Access gates /admin at the edge; if this page loads, the user passed auth)
    if (!isLocal) {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('admin-view').classList.remove('hidden');
        document.getElementById('logout-btn').classList.remove('hidden');
        window.syncProjectsForBranch(savedBranch);
    }
});

window.newProjectSelectedTags = [];
window.allAvailableTags = [];

function updateAvailableTags(projects = window.myProjects || []) {
    const tagsMap = new Map();
    projects.forEach(project => {
        if (project && Array.isArray(project.tags)) {
            project.tags.forEach(tag => {
                if (tag && tag.label) {
                    tagsMap.set(tag.label, tag.color || 'gray');
                }
            });
        }
    });
    window.allAvailableTags = Array.from(tagsMap.entries()).map(([label, color]) => ({ label, color }));
}
window.updateAvailableTags = updateAvailableTags;

// Helper to populate form tags
function populateFormTags() {
    updateAvailableTags(window.myProjects);
    window.newProjectSelectedTags = [];
    renderSelectedTags();
}
window.populateFormTags = populateFormTags;

function setFileListOpen(isOpen) {
    const resultsDiv = document.getElementById('file-search-results');
    const toggleBtn = document.getElementById('file-list-toggle');
    if (resultsDiv) {
        resultsDiv.classList.toggle('hidden', !isOpen);
    }
    if (toggleBtn) {
        toggleBtn.textContent = isOpen ? 'Hide List' : 'Browse Files';
        toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
}
window.setFileListOpen = setFileListOpen;

function applyProjectsList(projects) {
    if (!Array.isArray(projects)) return;
    window.myProjects = projects;

    const nextFiles = [
        { path: 'index.html', title: 'Homepage Wrapper', category: 'Global Files' },
        { path: 'assets/js/project-data.js', title: 'Projects Database', category: 'Global Files' }
    ];
    projects.forEach(project => {
        if (project && project.hasExtendedContent) {
            nextFiles.push({
                path: `content/${project.id}/index.html`,
                title: project.unpublished ? `${project.title} (unpublished)` : project.title,
                category: 'Projects'
            });
        }
    });
    window.searchFiles = nextFiles;

    if (window.populateUploadProjectDropdown) {
        window.populateUploadProjectDropdown();
    }
    updateAvailableTags(projects);
    if (window.filterSearchResults) {
        window.filterSearchResults();
    }
}
window.applyProjectsList = applyProjectsList;

let projectSyncSeq = 0;
window.syncProjectsForBranch = async function (branch = (window.getSelectedBranch ? window.getSelectedBranch() : 'main')) {
    const seq = ++projectSyncSeq;
    const statusEl = document.getElementById('projects-sync-status');
    if (statusEl) {
        statusEl.classList.remove('is-warning');
        statusEl.textContent = `Syncing projects from ${branch}...`;
    }

    try {
        const headers = window.getAuthHeaders ? window.getAuthHeaders() : {};
        const res = await fetch(`/api/admin/file?path=assets/js/project-data.js&branch=${encodeURIComponent(branch)}`, {
            headers,
            cache: 'no-store'
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const decode = window.b64DecodeUnicode || ((str) => new TextDecoder().decode(Uint8Array.from(atob(str), c => c.charCodeAt(0))));
        const source = decode((data.content || '').replace(/\s/g, ''));
        const parsedProjects = parseProjectDataSource(source);

        if (seq !== projectSyncSeq) return;

        applyProjectsList(parsedProjects);
        const projectCount = parsedProjects.filter(p => p && p.hasExtendedContent).length;
        if (statusEl) {
            statusEl.classList.remove('is-warning');
            statusEl.textContent = `Synced ${projectCount} projects from ${branch}`;
        }
    } catch {
        if (seq !== projectSyncSeq) return;
        if (statusEl) {
            statusEl.classList.add('is-warning');
            statusEl.textContent = `Could not refresh from ${branch} (showing bundled list)`;
        }
    }
};

// Render selected tags as badges/pills
function renderSelectedTags() {
    const container = document.getElementById('new-project-selected-tags');
    if (!container) return;
    container.innerHTML = '';

    if (window.newProjectSelectedTags.length === 0) {
        const hint = document.createElement('span');
        hint.style.fontSize = '0.8rem';
        hint.style.color = 'var(--text-secondary)';
        hint.textContent = 'No tags selected';
        container.appendChild(hint);
        return;
    }

    window.newProjectSelectedTags.forEach(tag => {
        const badge = document.createElement('span');
        badge.className = `tag tag-${tag.color}`;
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '0.35rem';
        badge.style.cursor = 'pointer';
        badge.innerHTML = `${tag.label} <span style="font-weight: bold; opacity: 0.7;">✕</span>`;
        badge.onclick = () => {
            removeSelectedTag(tag.label);
        };
        container.appendChild(badge);
    });
}
window.renderSelectedTags = renderSelectedTags;

// Remove a selected tag
function removeSelectedTag(label) {
    window.newProjectSelectedTags = window.newProjectSelectedTags.filter(t => t.label !== label);
    renderSelectedTags();
    filterTagSearchResults();
}
window.removeSelectedTag = removeSelectedTag;

// Show dropdown search results
function showTagSearchResults() {
    const resultsDiv = document.getElementById('new-project-tag-results');
    if (resultsDiv) {
        resultsDiv.classList.remove('hidden');
        filterTagSearchResults();
    }
}
window.showTagSearchResults = showTagSearchResults;

// Shared tag search dropdown renderer for create & edit forms
window.renderTagDropdown = function (queryInputId, resultsDivId, selectedTags, renderSelectedFn) {
    const queryInput = document.getElementById(queryInputId);
    const resultsDiv = document.getElementById(resultsDivId);
    if (!queryInput || !resultsDiv) return;

    const query = queryInput.value.toLowerCase();
    const filtered = (window.allAvailableTags || []).filter(tag => {
        const isSelected = selectedTags.some(t => t.label === tag.label);
        const matchesQuery = tag.label.toLowerCase().includes(query);
        return !isSelected && matchesQuery;
    });

    if (filtered.length === 0) {
        const item = document.createElement('div');
        item.className = 'search-empty-state';
        item.textContent = 'No matching tags available';
        resultsDiv.replaceChildren(item);
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(tag => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'search-result-item';
        item.textContent = tag.label;
        item.onclick = () => {
            selectedTags.push(tag);
            queryInput.value = '';
            resultsDiv.classList.add('hidden');
            renderSelectedFn();
        };
        fragment.appendChild(item);
    });
    resultsDiv.replaceChildren(fragment);
};

// Filter available tags in dropdown list
function filterTagSearchResults() {
    window.renderTagDropdown('new-project-tag-search', 'new-project-tag-results', window.newProjectSelectedTags, renderSelectedTags);
}
window.filterTagSearchResults = filterTagSearchResults;

// Attach search functions globally
window.showSearchResults = function () {
    setFileListOpen(true);
    filterSearchResults();
};

window.filterSearchResults = function () {
    const searchInput = document.getElementById('file-search');
    const clearBtn = document.getElementById('file-search-clear');
    const rawQuery = searchInput ? searchInput.value : '';
    const query = rawQuery.trim().toLowerCase();

    if (clearBtn) {
        clearBtn.classList.toggle('hidden', rawQuery.length === 0);
    }

    const files = window.searchFiles || [];
    const filtered = query
        ? files.filter(file =>
            file.title.toLowerCase().includes(query) ||
            file.path.toLowerCase().includes(query)
        )
        : files;

    if (query.length > 0) {
        setFileListOpen(true);
    }
    renderSearchResults(filtered);
};

window.renderSearchResults = function (files) {
    const resultsDiv = document.getElementById('file-search-results');
    if (!resultsDiv) return;

    if (!files || files.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'search-empty-state';
        emptyDiv.textContent = 'No matching files found.';
        resultsDiv.replaceChildren(emptyDiv);
        return;
    }

    // Group by category
    const groups = {};
    files.forEach(file => {
        if (!groups[file.category]) {
            groups[file.category] = [];
        }
        groups[file.category].push(file);
    });

    const fragment = document.createDocumentFragment();
    const activePath = typeof currentFile !== 'undefined' && currentFile ? currentFile.path : '';

    for (const category in groups) {
        const groupFiles = groups[category];
        const titleDiv = document.createElement('div');
        titleDiv.className = 'search-result-group-title';
        titleDiv.textContent = `${category} (${groupFiles.length})`;
        fragment.appendChild(titleDiv);

        groupFiles.forEach(file => {
            const isActive = activePath && activePath === file.path;
            const itemBtn = document.createElement('button');
            itemBtn.type = 'button';
            itemBtn.className = isActive ? 'search-result-item selected' : 'search-result-item';
            if (isActive) {
                itemBtn.setAttribute('aria-current', 'true');
            }

            const labelSpan = document.createElement('span');
            labelSpan.textContent = file.title;
            itemBtn.appendChild(labelSpan);

            if (isActive) {
                const badgeSpan = document.createElement('span');
                badgeSpan.className = 'search-result-badge';
                badgeSpan.textContent = 'Editing';
                itemBtn.appendChild(badgeSpan);
            }

            itemBtn.onclick = () => {
                const searchInput = document.getElementById('file-search');
                const clearBtn = document.getElementById('file-search-clear');
                if (searchInput) searchInput.value = '';
                if (clearBtn) clearBtn.classList.add('hidden');
                setFileListOpen(false);

                // Sync with image uploader project dropdown
                syncImageUploader(file.path);

                // Trigger file load
                loadFile(file.path);
            };
            fragment.appendChild(itemBtn);
        });
    }

    resultsDiv.replaceChildren(fragment);
};

window.syncImageUploader = function (filePath) {
    const uploadSelect = document.getElementById('upload-project');
    if (!uploadSelect) return;

    // If it is a project page, e.g. "content/rentpress/index.html"
    if (filePath.startsWith('content/') && filePath.endsWith('/index.html')) {
        const parts = filePath.split('/');
        if (parts.length >= 3) {
            const projectId = parts[1];
            const targetValue = `content/${projectId}/images`;

            // Check if this option exists in the selector
            let optionExists = false;
            for (let i = 0; i < uploadSelect.options.length; i++) {
                if (uploadSelect.options[i].value === targetValue) {
                    optionExists = true;
                    break;
                }
            }

            if (optionExists) {
                uploadSelect.value = targetValue;
                // Expand the image uploader panel automatically so they see it is synced
                const uploaderBody = document.getElementById('uploader-body');
                if (uploaderBody && uploaderBody.classList.contains('hidden')) {
                    toggleUploader();
                }
            }
        }
    } else {
        // Global file, default upload target is assets/img
        uploadSelect.value = 'assets/img';
    }
};

// Close dropdowns when clicking outside (only auto-collapse file list once a file is open)
document.addEventListener('click', (e) => {
    const selectorCard = document.querySelector('.file-selector-card');
    const hasLoadedFile = typeof currentFile !== 'undefined' && currentFile && Boolean(currentFile.path);
    if (hasLoadedFile && selectorCard && !selectorCard.contains(e.target)) {
        setFileListOpen(false);
    }

    const tagInput = document.getElementById('new-project-tag-search');
    const tagResults = document.getElementById('new-project-tag-results');
    if (tagInput && tagResults && !tagInput.contains(e.target) && !tagResults.contains(e.target)) {
        tagResults.classList.add('hidden');
    }

    const editTagInput = document.getElementById('edit-project-tag-search');
    const editTagResults = document.getElementById('edit-project-tag-results');
    if (editTagInput && editTagResults && !editTagInput.contains(e.target) && !editTagResults.contains(e.target)) {
        editTagResults.classList.add('hidden');
    }
});
