import { myProjects } from './project-data.js?v=2';
import { initializeCustomAudioPlayers } from './audio-player.js?v=2';
import { initializeLightbox, setupContentClicks } from './lightbox.js?v=1';
import { initClearTechBrochure } from './brochure.js?v=1';
import { globalAudio } from './global-audio.js';
import { initializeMiniPlayer } from './mini-player.js';

// The SPA router owns scroll position via history state (see performScrollRestorationOrScrollToTop).
// Opting out of the browser's automatic per-entry scroll restoration prevents it from fighting
// that logic — e.g. jumping to a stale offset on a plain reload of "/".
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('projects-grid');
    const archiveGrid = document.getElementById('archive-projects-grid');
    const archiveDivider = document.getElementById('archive-divider');
    const projectDetailArea = document.getElementById('project-detail-area');

    // 1. Dynamic Lightbox Setup (programmatically creates the lightbox if it is missing)
    initializeLightbox();

    // Initialize Header Mini Audio Player
    initializeMiniPlayer();

    // Define sophisticated category filters
    const filterCategories = [
        {
            id: 'all',
            label: 'All',
            match: () => true
        },
        {
            id: 'professional',
            label: 'Professional',
            match: (project) => project.tags.some(t => ['professional', 'platform', 'real estate', 'marketing'].includes(t.label.toLowerCase()))
        },
        {
            id: 'web-apps',
            label: 'Web & Apps',
            match: (project) => project.tags.some(t => ['web development', 'app', 'platform', 'digital signage', 'backend', 'experimentation', 'analytics', "web app", "website"].includes(t.label.toLowerCase()))
        },
        {
            id: 'audio-music',
            label: 'Audio & Music',
            match: (project) => project.tags.some(t => ['audio production', 'composition', 'radio', 'podcast', 'mixing', 'music', 'audio', 'podcast', 'music production', 'music business'].includes(t.label.toLowerCase()))
        },
        {
            id: 'video-film',
            label: 'Video & Film',
            match: (project) => project.tags.some(t => ['video production', 'comedy', 'film', 'video'].includes(t.label.toLowerCase()))
        },
        {
            id: 'archive',
            label: 'Archive',
            match: (project) => project.tags.some(t => t.label.toLowerCase() === 'archive')
        }
    ];

    // Compute counts dynamically
    filterCategories.forEach(cat => {
        cat.count = myProjects.filter(p => cat.match(p)).length;
    });

    // Helper function to normalize project data and provide consistent guards/fallbacks
    function normalizeProject(rawProject) {
        const project = { ...rawProject };

        // 1. Subtitle punctuation guard: ensure subtitles ending cleanly with a period
        if (project.subtitle && typeof project.subtitle === 'string') {
            const trimmed = project.subtitle.trim();
            if (trimmed.length > 0 && !/[.!?]$/.test(trimmed)) {
                project.subtitle = `${trimmed}.`;
            } else {
                project.subtitle = trimmed;
            }
        }

        // 2. Default showLaunchButton to true if actionUrl exists and showLaunchButton is not explicitly set
        if (project.actionUrl && project.showLaunchButton === undefined) {
            project.showLaunchButton = true;
        }

        // 3. Smart actionText backstop/fallback
        if (!project.actionText || project.actionText.trim() === '') {
            if (project.actionUrl) {
                // If it has a web app or dev tool tag, default to "Launch <Title>"
                const isApp = project.tags?.some(t => ['web app', 'app', 'design tool', 'dev tooling', 'experimentation'].includes(t.label.toLowerCase()));
                project.actionText = isApp ? `Launch ${project.title}` : 'Visit Website';
            } else {
                project.actionText = 'View Project';
            }
        }

        return project;
    }

    if (grid) {
        // Render Filter Pills
        const filterPillsContainer = document.getElementById('filter-pills');
        if (filterPillsContainer) {
            filterCategories.forEach(cat => {
                const pill = document.createElement('button');
                pill.className = `filter-pill${cat.id === 'all' ? ' active' : ''}`;
                pill.setAttribute('data-category', cat.id);
                pill.setAttribute('aria-pressed', cat.id === 'all' ? 'true' : 'false');
                pill.innerHTML = `${cat.label}`;

                pill.addEventListener('click', () => {
                    if (pill.classList.contains('active')) {
                        if (cat.id === 'all') return; // Clicking 'All' when already active does nothing

                        pill.classList.remove('active');
                        pill.setAttribute('aria-pressed', 'false');

                        const allPill = filterPillsContainer.querySelector('.filter-pill[data-category="all"]');
                        if (allPill) {
                            allPill.classList.add('active');
                            allPill.setAttribute('aria-pressed', 'true');
                        }
                        filterProjects('all');
                        return;
                    }

                    // Toggle active class on pills
                    filterPillsContainer.querySelectorAll('.filter-pill').forEach(p => {
                        p.classList.remove('active');
                        p.setAttribute('aria-pressed', 'false');
                    });
                    pill.classList.add('active');
                    pill.setAttribute('aria-pressed', 'true');

                    // Filter the projects
                    filterProjects(cat.id);
                });

                filterPillsContainer.appendChild(pill);
            });

            // Add scroll listeners to update fade masks dynamically on mobile
            const updateScrollFade = () => {
                const scrollLeft = filterPillsContainer.scrollLeft;
                const maxScrollLeft = filterPillsContainer.scrollWidth - filterPillsContainer.clientWidth;

                // Defer DOM writes to requestAnimationFrame to prevent forced reflows
                requestAnimationFrame(() => {
                    if (scrollLeft > 2) {
                        filterPillsContainer.classList.add('scrolled-left');
                    } else {
                        filterPillsContainer.classList.remove('scrolled-left');
                    }

                    if (scrollLeft < maxScrollLeft - 2) {
                        filterPillsContainer.classList.add('scrolled-right');
                    } else {
                        filterPillsContainer.classList.remove('scrolled-right');
                    }
                });
            };

            filterPillsContainer.addEventListener('scroll', updateScrollFade);
            // Run initial check after rendering (slight delay to let CSS rendering happen)
            setTimeout(updateScrollFade, 50);
            window.addEventListener('resize', updateScrollFade);
        }

        // Render Projects
        myProjects.forEach(rawProject => {
            const project = normalizeProject(rawProject);
            const card = document.createElement('div');
            const sizeClass = project.size ? `size-${project.size}` : 'size-medium';
            card.className = `glimmer-card destination-card ${sizeClass} ${project.featured ? 'featured' : ''}`;

            // Map matching categories to this card for fast filtering
            const matchingCats = filterCategories
                .filter(cat => cat.match(project))
                .map(cat => cat.id);
            card.setAttribute('data-categories', matchingCats.join(' '));

            const tagsHtml = buildTagsHtml(project.tags);

            let actionsHtml = '';
            if (project.showLaunchButton && project.hasExtendedContent) {
                // TWO buttons: Launch (Primary) & Read More (Secondary)
                actionsHtml = `
                    <a href="${project.actionUrl}" class="project-btn" target="_blank" rel="noopener noreferrer">
                        <span>${project.actionText}</span>
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
                    </a>
                    <a href="/project/${project.id}/" class="project-btn btn-secondary read-more-btn" data-project-id="${project.id}">
                        <span>Read More <span class="sr-only">about ${project.title}</span></span>
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    </a>
                `;
            } else if (project.hasExtendedContent) {
                // ONE button: Read More (Primary)
                actionsHtml = `
                    <a href="/project/${project.id}/" class="project-btn read-more-btn" data-project-id="${project.id}">
                        <span>Read More <span class="sr-only">about ${project.title}</span></span>
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    </a>
                `;
            } else if (project.actionUrl) {
                // ONE button: Launch (Primary)
                actionsHtml = `
                    <a href="${project.actionUrl}" class="project-btn" target="_blank" rel="noopener noreferrer">
                        <span>${project.actionText}</span>
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
                    </a>
                `;
            }

            let visualHtml;
            if (project.image) {
                const widthAttr = project.imageWidth ? ` width="${project.imageWidth}"` : '';
                const heightAttr = project.imageHeight ? ` height="${project.imageHeight}"` : '';
                const loadingAttr = project.featured ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';

                visualHtml = `<img id="project-image-${project.id}" src="${project.image}" alt="${project.title} Preview" ${loadingAttr}${widthAttr}${heightAttr} class="${project.featured ? 'destination-image-standalone' : 'destination-icon'} ${project.imageClass}">`;
            } else {
                let iconSvg;
                if (project.symbol === 'data') {
                    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" /></svg>`;
                } else if (project.symbol === 'hub') {
                    iconSvg = `<img src="assets/img/rentpress-logo.svg" alt="RentPress" width="376" height="69">`;
                } else if (project.symbol === 'email') {
                    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>`;
                } else {
                    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>`;
                }

                const hubClass = project.symbol === 'hub' ? ' hub-motif' : '';
                visualHtml = `<div class="project-placeholder-icon${hubClass}">${iconSvg}</div>`;
            }

            card.innerHTML = `
                <div class="tag-list">
                    ${tagsHtml}
                </div>
                <div class="destination-content">
                    <div class="destination-header">
                        <h2>${project.title}</h2>
                    </div>
                    <p>${project.subtitle}</p>
                    <div class="destination-actions">
                        ${actionsHtml}
                    </div>
                </div>
                <div class="${project.featured ? 'destination-standalone-visual' : 'destination-visual'}">
                     ${visualHtml}
                </div>
            `;

            // Route archived projects to the archive grid
            const isArchived = project.tags.some(tag => tag.label.toLowerCase() === 'archive');
            if (isArchived && archiveGrid) {
                archiveGrid.appendChild(card);
            } else {
                grid.appendChild(card);
            }
        });

        // Initial setup for grid display states
        const showActive = grid && grid.querySelectorAll('.destination-card').length > 0;
        const showArchive = archiveGrid && archiveGrid.querySelectorAll('.destination-card').length > 0;
        if (grid) grid.style.display = showActive ? 'grid' : 'none';
        if (archiveGrid) archiveGrid.style.display = showArchive ? 'grid' : 'none';
        if (archiveDivider) archiveDivider.style.display = (showActive && showArchive) ? 'flex' : 'none';
    }

    // Helper functions for tags
    function buildTagsHtml(tags) {
        if (!tags || tags.length === 0) return '';
        return tags.map(tag => {
            const cls = tag.priority ? ` tag-priority-${tag.priority}` : '';
            const colorClass = tag.color ? `tag-${tag.color.toLowerCase()}` : 'tag-gray';
            return `<span class="tag ${colorClass}${cls}">${tag.label}</span>`;
        }).join('');
    }

    function filterProjects(categoryId) {
        const cards = document.querySelectorAll('.destination-card');

        // Temporarily lock the grid heights to prevent sudden layout collapses during the FLIP transition
        if (grid) grid.style.minHeight = `${grid.getBoundingClientRect().height}px`;
        if (archiveGrid) archiveGrid.style.minHeight = `${archiveGrid.getBoundingClientRect().height}px`;

        // 1. Record the "First" state of currently visible cards
        const firstPositions = new Map();
        cards.forEach(card => {
            const isVisible = !card.classList.contains('filtered-out');
            if (isVisible) {
                const rect = card.getBoundingClientRect();
                firstPositions.set(card, {
                    top: rect.top,
                    left: rect.left,
                    wasVisible: true
                });
            } else {
                firstPositions.set(card, {
                    wasVisible: false
                });
            }
        });

        // 2. Update classes to trigger reflow instantly so browser knows final positions
        cards.forEach(card => {
            const categories = card.getAttribute('data-categories').split(' ');
            const matches = categories.includes(categoryId);

            if (matches) {
                if (card.classList.contains('filtered-out')) {
                    card.classList.remove('filtered-out');
                    card.style.display = '';
                }
            } else {
                card.classList.add('filtered-out');
                card.style.display = 'none'; // Instantly hide exiting cards
            }
        });

        // Update grid containers & divider visibility immediately so FLIP measures final layout positions
        let hasActive = false;
        let hasArchive = false;
        if (grid) {
            hasActive = Array.from(grid.querySelectorAll('.destination-card')).some(card => !card.classList.contains('filtered-out'));
            grid.style.display = hasActive ? 'grid' : 'none';
        }
        if (archiveGrid) {
            hasArchive = Array.from(archiveGrid.querySelectorAll('.destination-card')).some(card => !card.classList.contains('filtered-out'));
            archiveGrid.style.display = hasArchive ? 'grid' : 'none';
        }
        if (archiveDivider) {
            archiveDivider.style.display = (hasActive && hasArchive) ? 'flex' : 'none';
        }

        // 3. Force layout recalculation and set the "Invert" state
        requestAnimationFrame(() => {
            cards.forEach(card => {
                const first = firstPositions.get(card);

                if (card.classList.contains('filtered-out')) {
                    return; // Skip hidden cards
                }

                const rect = card.getBoundingClientRect();

                if (first.wasVisible) {
                    // Shifting element: calculate transition from its exact previous position
                    const deltaX = first.left - rect.left;
                    const deltaY = first.top - rect.top;

                    if (deltaX !== 0 || deltaY !== 0) {
                        card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                        card.style.transition = 'none';
                    }
                } else {
                    // Entering element: fade in and scale up from its correct final position in the grid
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9) translateY(15px)';
                    card.style.transition = 'none';
                }
            });

            // 4. "Play" phase: trigger the transitions in the next layout frame
            requestAnimationFrame(() => {
                cards.forEach(card => {
                    if (card.classList.contains('filtered-out')) return;

                    card.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
                    card.style.transform = '';
                    card.style.opacity = '1';
                });

                // Clean up inline styles after transition completes to restore default CSS hover and transition behaviors
                setTimeout(() => {
                    cards.forEach(card => {
                        if (!card.classList.contains('filtered-out')) {
                            card.style.transition = '';
                            card.style.transform = '';
                            card.style.opacity = '';
                        }
                    });
                    // Restore the CSS-defined default min-height
                    if (grid) grid.style.minHeight = '';
                    if (archiveGrid) archiveGrid.style.minHeight = '';
                }, 600);
            });
        });
    }

    // 2. Automatically initialize custom audio players for the current page content
    if (projectDetailArea) {
        initializeCustomAudioPlayers(projectDetailArea);
    }

    function initializeProjectGalleries(container) {
        if (!container) return;
        const galleries = container.querySelectorAll('.project-gallery:not(.grid-view)');
        galleries.forEach(gallery => {
            const updateGalleryFade = () => {
                const scrollLeft = gallery.scrollLeft;
                const maxScrollLeft = gallery.scrollWidth - gallery.clientWidth;

                requestAnimationFrame(() => {
                    if (scrollLeft > 50) {
                        gallery.classList.add('scrolled-left');
                    } else {
                        gallery.classList.remove('scrolled-left');
                    }

                    if (scrollLeft < maxScrollLeft - 50 && maxScrollLeft > 50) {
                        gallery.classList.add('scrolled-right');
                    } else {
                        gallery.classList.remove('scrolled-right');
                    }

                    // Short rows (fewer/narrower items than the container) read as
                    // stranded at the left edge - center them. Rows that actually
                    // need to scroll keep flex-start; centering those would clip the
                    // first item under overflow, since centered flex content splits
                    // its overflow on both sides instead of starting at scrollLeft 0.
                    gallery.classList.toggle('no-overflow', maxScrollLeft <= 1);
                });
            };

            gallery.addEventListener('scroll', updateGalleryFade);
            // Run initial check at multiple intervals to ensure layout has stabilized
            setTimeout(updateGalleryFade, 50);
            setTimeout(updateGalleryFade, 150);
            setTimeout(updateGalleryFade, 300);
            setTimeout(updateGalleryFade, 500);
            window.addEventListener('resize', updateGalleryFade);

            // aspect-auto images have no intrinsic width until they finish loading
            // (width is derived from height x aspect-ratio), so scrollWidth is
            // artificially small - and thus rows can be wrongly measured as fitting
            // without scrolling - until every image has loaded at least once.
            gallery.querySelectorAll('img').forEach(img => {
                if (!img.complete) {
                    img.addEventListener('load', updateGalleryFade, { once: true });
                }
            });
        });
    }

    if (projectDetailArea) {
        initializeProjectGalleries(projectDetailArea);
    }

    if (projectDetailArea) {
        setupContentClicks(projectDetailArea, projectDetailArea);
    }

    function performScrollRestorationOrScrollToTop(restoreY) {
        if (typeof restoreY === 'number') {
            window.scrollTo(0, restoreY);
            return;
        }

        const scrollX = sessionStorage.getItem('live_reload_scroll_x');
        const scrollY = sessionStorage.getItem('live_reload_scroll_y');
        if (scrollX !== null && scrollY !== null) {
            sessionStorage.removeItem('live_reload_scroll_x');
            sessionStorage.removeItem('live_reload_scroll_y');
            window.scrollTo(parseInt(scrollX, 10), parseInt(scrollY, 10));
        } else {
            window.scrollTo(0, 0);
        }
    }

    // === SPA ROUTER ===

    async function loadProject(projectId) {
        const rawProject = myProjects.find(p => p.id === projectId);
        if (!rawProject) { navigateHome(false); return; }
        const project = normalizeProject(rawProject);

        // Fade out home view before switching
        const topRow = document.querySelector('.top-row');
        const filterContainer = document.querySelector('.filter-container');
        const projectsGrid = document.getElementById('projects-grid');
        const archiveProjectsGrid = document.getElementById('archive-projects-grid');
        const homeArchiveDivider = document.getElementById('archive-divider');
        const homeEls = [topRow, filterContainer, projectsGrid, archiveProjectsGrid, homeArchiveDivider].filter(Boolean);
        homeEls.forEach(el => { el.style.transition = 'opacity 0.1s ease'; el.style.opacity = '0'; });

        try {
            // 1. Fetch content
            const response = await fetch(`/content/${projectId}/`);
            if (!response.ok) throw new Error("Content missing");
            let htmlContent = await response.text();

            // 2. Rewrite Media & File URLs to R2
            htmlContent = htmlContent.replace(/(src|href)="(?:\.\/)?content\/[^/]+\/(?:audio|downloads|files)?\/?([^"]+\.(?:mp3|m4a|zip|aup3))"/g, '$1="https://media.ryanmarch.me/$2"');

            // 3. Extract Headings for TOC
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            const headings = tempDiv.querySelectorAll('h4[id]');
            let navHtml = '';
            if (headings.length > 0) {
                const links = Array.from(headings).map(h => `<a href="#${h.id}">${h.querySelector('span') ? h.querySelector('span').innerHTML : h.innerHTML}</a>`);
                if (project.actionUrl || project.sourceUrl) {
                    links.push('<a href="#project-detail-footer-actions">Links</a>');
                }
                navHtml = `<nav class="project-nav"><div class="nav-links">${links.join('')}</div></nav>`;
            }

            // 4. Inject TOC
            if (navHtml) {
                const desc = tempDiv.querySelector('.project-description');
                const sub = tempDiv.querySelector('.project-subtitle');
                if (desc) {
                    desc.insertAdjacentHTML('afterend', navHtml);
                } else if (sub) {
                    sub.insertAdjacentHTML('afterend', navHtml);
                }
                htmlContent = tempDiv.innerHTML;
            }

            // 5. Build Tags
            const tagsHtml = `<div class="tag-list project-detail-tags">${buildTagsHtml(project.tags)}</div>`;

            // 6. Build Footer
            let footerHtml = '';
            if (project.actionUrl || project.sourceUrl) {
                footerHtml += '<hr class="project-detail-footer-divider">\n<div class="project-detail-footer-actions" id="project-detail-footer-actions">\n';
                if (project.sourceUrl) {
                    footerHtml += `    <a href="${project.sourceUrl}" class="project-btn project-detail-btn btn-secondary" target="_blank" rel="noopener noreferrer">
        <span>View More</span>
        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
    </a>\n`;
                }
                if (project.actionUrl) {
                    footerHtml += `    <a href="${project.actionUrl}" class="project-btn project-detail-btn" target="_blank" rel="noopener noreferrer">
        <span>${project.actionText || 'Visit'}</span>
        <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
    </a>\n`;
                }
                footerHtml += '    <a href="/" class="project-detail-back-btn data-spa-link">Back to Home</a>\n</div>';
            } else {
                footerHtml = '<div class="project-detail-footer-actions"><a href="/" class="project-detail-back-btn data-spa-link">Back to Home</a></div>';
            }

            // 7. Inject everything
            projectDetailArea.innerHTML = tagsHtml + htmlContent + footerHtml;

            // 8. Optimize LCP: load the first image eagerly
            const firstImg = projectDetailArea.querySelector('img');
            if (firstImg) {
                firstImg.removeAttribute('loading');
                firstImg.setAttribute('loading', 'eager');
                firstImg.setAttribute('fetchpriority', 'high');
            }

            // 9. Wire up handlers
            initializeCustomAudioPlayers(projectDetailArea, projectId);
            initializeProjectGalleries(projectDetailArea);

            // Initialize CLEAR Tech brochure tabs if applicable
            if (projectId === 'clear-tech') {
                initClearTechBrochure(projectDetailArea);
            }

            // Re-bind back button inside footer
            const backBtns = projectDetailArea.querySelectorAll('.data-spa-link');
            backBtns.forEach(b => b.addEventListener('click', (e) => {
                e.preventDefault();
                navigateHome();
            }));

            // Notify global audio of current project route
            globalAudio.setCurrentRoute(projectId);

            // 10. Show Project View, Hide Home (after fade out completes)
            homeEls.forEach(el => { el.style.display = 'none'; el.style.opacity = ''; el.style.transition = ''; });
            document.body.classList.add('standalone-page');

            // Fade in project detail
            projectDetailArea.style.opacity = '0';
            projectDetailArea.style.display = 'block';
            performScrollRestorationOrScrollToTop();
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    projectDetailArea.style.transition = 'opacity 0.15s ease';
                    projectDetailArea.style.opacity = '1';
                    setTimeout(() => { projectDetailArea.style.transition = ''; }, 180);
                });
            });

            document.title = `${project.title} | Ryan March`;

            // Update canonical URL
            let canonicalLink = document.querySelector('link[rel="canonical"]');
            if (canonicalLink) {
                canonicalLink.setAttribute('href', `https://ryanmarch.me/project/${projectId}/`);
            }

        } catch (e) {
            console.error("Failed to load project", e);
            // Restore home visibility on error
            homeEls.forEach(el => { el.style.opacity = ''; el.style.transition = ''; });
        }
    }

    function navigateHome(pushState = true, restoreY) {
        // Notify global audio of route change to home
        globalAudio.setCurrentRoute(null);

        if (pushState && window.location.pathname !== '/') {
            history.pushState(null, '', '/');
        } else if (!pushState && window.location.pathname !== '/') {
            history.replaceState(null, '', '/');
        }
        document.title = 'Ryan March | Product & Technology';

        // Update canonical URL
        let canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink) {
            canonicalLink.setAttribute('href', 'https://ryanmarch.me/');
        }

        // Fade out project detail, then swap views
        projectDetailArea.style.transition = 'opacity 0.1s ease';
        projectDetailArea.style.opacity = '0';

        setTimeout(() => {
            projectDetailArea.style.display = 'none';
            projectDetailArea.style.opacity = '';
            projectDetailArea.style.transition = '';
            projectDetailArea.innerHTML = '';
            document.body.classList.remove('standalone-page');

            const topRow = document.querySelector('.top-row');
            const filterContainer = document.querySelector('.filter-container');

            // Determine which grids to show based on current filter state
            const showActive = grid && Array.from(grid.querySelectorAll('.destination-card')).some(card => !card.classList.contains('filtered-out'));
            const showArchive = archiveGrid && Array.from(archiveGrid.querySelectorAll('.destination-card')).some(card => !card.classList.contains('filtered-out'));

            // Reveal home elements with a fade-in
            [topRow, filterContainer].forEach(el => {
                if (!el) return;
                el.style.opacity = '0';
                el.style.display = el === topRow ? 'flex' : 'block';
            });
            if (grid) {
                grid.style.opacity = '0';
                grid.style.display = showActive ? 'grid' : 'none';
            }
            if (archiveGrid) {
                archiveGrid.style.opacity = '0';
                archiveGrid.style.display = showArchive ? 'grid' : 'none';
            }
            if (archiveDivider) {
                archiveDivider.style.opacity = '0';
                archiveDivider.style.display = (showActive && showArchive) ? 'flex' : 'none';
            }

            performScrollRestorationOrScrollToTop(restoreY);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    [topRow, filterContainer, grid, archiveGrid, archiveDivider].forEach(el => {
                        if (!el) return;
                        el.style.transition = 'opacity 0.15s ease';
                        el.style.opacity = '1';
                    });
                    setTimeout(() => {
                        [topRow, filterContainer, grid, archiveGrid, archiveDivider].forEach(el => {
                            if (!el) return;
                            el.style.transition = '';
                            el.style.opacity = '';
                        });
                    }, 180);
                });
            });
        }, 120);
    }

    // Listen for History popstate (Back/Forward buttons)
    window.addEventListener('popstate', (event) => handleUrlRoute(event.state));

    // Listen for mini player or other components requesting SPA navigation
    window.addEventListener('spa-navigate-to-project', (event) => {
        const projectId = event.detail && event.detail.projectId;
        if (projectId) {
            history.replaceState({ scrollY: window.scrollY }, '', window.location.href);
            history.pushState(null, '', `/project/${projectId}/`);
            loadProject(projectId);
        }
    });

    function handleUrlRoute(state) {
        const path = window.location.pathname;
        const match = path.match(/^\/project\/([^/]+)\/?/);
        if (match) {
            const projectId = match[1];
            loadProject(projectId);
        } else {
            navigateHome(false, state && typeof state.scrollY === 'number' ? state.scrollY : undefined);
        }
    }

    if (projectDetailArea) {
        setupContentClicks(projectDetailArea, null);
    }

    // Card clicks — SPA interception for both active and archive grids
    const setupGridClickInterception = (targetGrid) => {
        if (!targetGrid) return;
        targetGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.destination-card');
            if (!card) return;

            // External links navigate on their own
            if (e.target.closest('.project-btn:not(.read-more-btn)')) {
                return;
            }

            // SPA Interception
            const readMoreBtn = card.querySelector('.read-more-btn');
            if (readMoreBtn && !e.target.closest('a:not(.read-more-btn)')) {
                e.preventDefault();
                const url = readMoreBtn.getAttribute('href');
                const projectId = readMoreBtn.getAttribute('data-project-id');
                // Record the home scroll position on the current history entry so
                // that navigating back restores it instead of landing at the top.
                history.replaceState({ scrollY: window.scrollY }, '', window.location.href);
                history.pushState(null, '', url);
                loadProject(projectId);
            }
        });
    };

    setupGridClickInterception(grid);
    setupGridClickInterception(archiveGrid);

    // Initial Route Check (never restore a scroll position from stale history.state on a fresh load —
    // that's only valid in response to an actual popstate/back-forward navigation)
    handleUrlRoute();

    // Intercept slim-header brand link to use SPA navigation
    const headerBrand = document.querySelector('.slim-header-brand');
    if (headerBrand) {
        headerBrand.addEventListener('click', (e) => {
            // Only intercept when we're on a project page; let normal navigation handle the home page
            if (document.body.classList.contains('standalone-page')) {
                e.preventDefault();
                navigateHome();
            }
        });
    }

    // Save scroll position on any page unload (e.g., manual browser reload)
    window.addEventListener('beforeunload', () => {
        try {
            sessionStorage.setItem('live_reload_scroll_x', window.scrollX);
            sessionStorage.setItem('live_reload_scroll_y', window.scrollY);
        } catch {
            // Ignore sessionStorage access errors
        }
    });
});
