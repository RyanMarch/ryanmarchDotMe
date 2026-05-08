
document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('projects-grid');
    const modal = document.getElementById('project-modal');
    const modalContainer = document.querySelector('.modal-container');
    const modalContentArea = document.getElementById('modal-content-area');
    const closeBtn = document.querySelector('.modal-close');
    
    // Lightbox Elements
    const lightbox = document.getElementById('lightbox-overlay');
    const lightboxImg = document.getElementById('lightbox-image');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = document.querySelector('.lightbox-close');

    // 1. Render Projects
    myProjects.forEach(project => {
        const card = document.createElement('div');
        const sizeClass = project.size ? `size-${project.size}` : 'size-medium';
        card.className = `glimmer-card destination-card ${sizeClass} ${project.featured ? 'featured' : ''}`;
        
        let tagsHtml = project.tags.map(tag => {
            const priorityClass = tag.priority ? `tag-priority-${tag.priority}` : '';
            return `<span class="tag tag-${tag.color} ${priorityClass}">${tag.label}</span>`;
        }).join('');
        
        let actionsHtml = '';
        if (project.hasExtendedContent) {
            // ONLY Read More button if extended content exists
            actionsHtml = `
                <button class="project-btn read-more-btn" data-project-id="${project.id}">
                    <span>Read More</span>
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                </button>
            `;
        } else if (project.actionUrl) {
            actionsHtml = `
                <a href="${project.actionUrl}" class="project-btn" target="_blank" rel="noopener noreferrer">
                    <span>${project.actionText}</span>
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
                </a>
            `;
        }

        let sourceHtml = (project.sourceUrl && !project.hasExtendedContent) 
            ? `<a href="${project.sourceUrl}" class="project-link" target="_blank" rel="noopener noreferrer">View Source</a>` 
            : '';

        card.innerHTML = `
            <div class="tag-list">
                ${tagsHtml}
            </div>
            <div class="destination-content">
                <div class="destination-header">
                    <h3>${project.title}</h3>
                </div>
                <p>${project.subtitle}</p>
                <div class="destination-actions">
                    ${actionsHtml}
                    ${sourceHtml}
                </div>
            </div>
            <div class="${project.featured ? 'destination-standalone-visual' : 'destination-visual'}">
                 <img id="project-image-${project.id}" src="${project.image}" alt="${project.title} Preview" class="${project.featured ? 'destination-image-standalone' : 'destination-icon'} ${project.imageClass}">
            </div>
        `;
        
        grid.appendChild(card);
    });

    // 2. Modal Logic
    const isLocal = window.location.protocol === 'file:' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

    function openModal(projectId) {
        const project = myProjects.find(p => p.id === projectId);
        fetch(`content/${projectId}.html?t=${Date.now()}`)
            .then(response => {
                if (!response.ok) throw new Error("Content not found");
                return response.text();
            })
            .then(html => {
                let tagsHtml = '<div id="modal-top"></div>';
                if (project && project.tags) {
                    tagsHtml = `<div class="tag-list modal-tags" id="modal-top">${project.tags.map(tag => {
                        const priorityClass = tag.priority ? `tag-priority-${tag.priority}` : '';
                        return `<span class="tag tag-${tag.color} ${priorityClass}">${tag.label}</span>`;
                    }).join('')}</div>`;
                }
                // Create footer actions for the modal
                let footerHtml = '';
                if (project && (project.actionUrl || project.sourceUrl)) {
                    footerHtml += `
                        <hr class="modal-footer-divider">
                        <div class="modal-footer-actions" id="modal-footer-actions">
                    `;

                    if (project.sourceUrl) {
                        footerHtml += `
                            <a href="${project.sourceUrl}" class="project-btn modal-full-btn btn-secondary" target="_blank" rel="noopener noreferrer">
                                <span>View More</span>
                                <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
                            </a>
                        `;
                    }
                    
                    if (project.actionUrl) {
                        footerHtml += `
                            <a href="${project.actionUrl}" class="project-btn modal-full-btn" target="_blank" rel="noopener noreferrer">
                                <span>${project.actionText}</span>
                                <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42L17.59 5H14V3zM19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2 2v-7h-2v7z"/></svg>
                            </a>
                        `;
                    }

                    footerHtml += `<a href="#modal-top" class="modal-back-to-top-btn">Back to Top</a>`;
                    
                    footerHtml += `</div>`;
                }

                modalContentArea.innerHTML = tagsHtml + html + footerHtml;

                // Generate Table of Contents from h4 IDs
                const headings = modalContentArea.querySelectorAll('h4[id]');
                if (headings.length > 0) {
                    const navHtml = `
                        <nav class="project-nav">
                            <div class="nav-links">
                                ${Array.from(headings).map(h => `<a href="#${h.id}">${h.textContent}</a>`).join('')}
                                ${project && (project.actionUrl || project.sourceUrl) ? '<a href="#modal-footer-actions">Links</a>' : ''}
                            </div>
                        </nav>
                    `;
                    
                    const description = modalContentArea.querySelector('.project-description');
                    const subtitle = modalContentArea.querySelector('.project-subtitle');
                    
                    if (description) {
                        description.insertAdjacentHTML('afterend', navHtml);
                    } else if (subtitle) {
                        subtitle.insertAdjacentHTML('afterend', navHtml);
                    } else {
                        const tags = modalContentArea.querySelector('.modal-tags');
                        if (tags) {
                            tags.insertAdjacentHTML('afterend', navHtml);
                        } else {
                            modalContentArea.insertAdjacentHTML('afterbegin', navHtml);
                        }
                    }
                }
                modal.scrollTop = 0; 
                modalContentArea.scrollTop = 0; 
                
                // Single frame delay is usually enough and more reliable
                requestAnimationFrame(() => {
                    modal.classList.add('open');
                    modal.setAttribute('aria-hidden', 'false');
                });
                
                document.body.style.overflow = 'hidden'; 
                
                // Reset scroll tracking
                closeBtn.classList.remove('modal-close-hidden');
                lastScrollTop = 0;
                
                if (isLocal) {
                    // Local query routing (preserves hash for anchor links)
                    const searchParams = new URLSearchParams(window.location.search);
                    if (searchParams.get('project') !== projectId) {
                        searchParams.set('project', projectId);
                        history.pushState(null, null, `?${searchParams.toString()}${window.location.hash}`);
                    }
                } else {
                    // Production clean routing (preserves hash)
                    if (window.location.pathname !== `/${projectId}/`) {
                        history.pushState(null, null, `/${projectId}/${window.location.hash}`);
                    }
                }
            })
            .catch(err => {
                console.error(err);
                if (isLocal) {
                    modalContentArea.innerHTML = `
                        <div style="text-align:center; padding: 2rem;">
                            <h3>Local Preview Error</h3>
                            <p>Browsers block fetching separate HTML files directly from the hard drive (<code>file://</code>) for security reasons.</p>
                            <p>To preview these separate HTML files locally, you must run a local server.<br>Open your terminal in this folder and run: <code>python3 -m http.server</code></p>
                        </div>
                    `;
                } else {
                    modalContentArea.innerHTML = "<p>Content not found.</p>";
                }
                modal.classList.add('open');
                modal.setAttribute('aria-hidden', 'false');
            });
    }

    function closeModal() {
        if (!modal.classList.contains('open')) return;
        
        // Hide close button immediately for a cleaner exit
        closeBtn.classList.add('modal-close-hidden');
        
        modal.classList.add('closing');
        modal.classList.remove('open');
        
        // Wait for animation to complete (matching CSS transition duration)
        setTimeout(() => {
            modal.classList.remove('closing');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
            
            if (isLocal) {
                // Remove query param
                const searchParams = new URLSearchParams(window.location.search);
                if (searchParams.has('project')) {
                    searchParams.delete('project');
                    const qs = searchParams.toString();
                    history.pushState(null, null, qs ? `?${qs}${window.location.hash}` : window.location.pathname + window.location.hash);
                }
            } else {
                // Revert clean URL
                if (window.location.pathname !== '/') {
                    history.pushState(null, null, `/${window.location.hash}`);
                }
            }
        }, 500); // Increased to 500ms for smoother exit
    }

    // 3. Lightbox Logic
    function openLightbox(src, alt, captionText) {
        lightboxImg.src = src;
        lightboxImg.alt = alt || 'Enlarged project image';
        lightboxCaption.textContent = captionText || '';
        lightboxCaption.style.display = captionText ? 'block' : 'none';
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
    }

    function closeLightbox() {
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            lightboxImg.src = '';
            lightboxCaption.textContent = '';
        }, 500);
    }

    // Lightbox Event Listeners
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === lightboxImg) closeLightbox();
    });

    // Event Delegation for clicks in modal
    modalContentArea.addEventListener('click', (e) => {
        // 1. Handle Lightbox for images
        if (e.target.tagName === 'IMG') {
            const parent = e.target.closest('.gallery-item');
            const caption = parent ? parent.querySelector('.gallery-caption') : null;
            const captionText = caption ? caption.textContent : '';
            openLightbox(e.target.src, e.target.alt, captionText);
            return;
        }

        // 2. Handle Table of Contents / Hash Links
        const hashLink = e.target.closest('a[href^="#"]');
        if (hashLink) {
            const targetId = hashLink.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });

    // Attach click listeners to all dynamically created Read More buttons
    document.querySelectorAll('.read-more-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(btn.getAttribute('data-project-id'));
        });
    });

    closeBtn.addEventListener('click', closeModal);

    // Scroll tracking for close button hide/show
    let lastScrollTop = 0;
    const handleScroll = (e) => {
        const target = e.target;
        const scrollTop = target.scrollTop;
        
        // Detect if footer is visible to force close button to show
        const footer = document.getElementById('modal-footer-actions');
        let footerVisible = false;
        if (footer) {
            const rect = footer.getBoundingClientRect();
            // Show if footer top enters the viewport (with a small buffer)
            footerVisible = rect.top < window.innerHeight - 50;
        }

        // Show button if:
        // 1. We are near the top (scrollTop < 50)
        // 2. The footer is visible
        // 3. We are scrolling UP (scrollTop < lastScrollTop)
        const isScrollingUp = scrollTop < lastScrollTop;
        const isNearTop = scrollTop < 50;

        if (isNearTop || footerVisible || isScrollingUp) {
            closeBtn.classList.remove('modal-close-hidden');
        } else if (scrollTop > 100) {
            // Hide button if scrolling down and past 100px
            closeBtn.classList.add('modal-close-hidden');
        }
        
        lastScrollTop = Math.max(0, scrollTop); // Avoid negative values from rubber banding
    };

    // Listen to both the content area (desktop) and the modal overlay (mobile)
    modalContentArea.addEventListener('scroll', handleScroll, { passive: true });
    modal.addEventListener('scroll', handleScroll, { passive: true });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (lightbox.classList.contains('open')) {
                closeLightbox();
            } else if (modal.classList.contains('open')) {
                closeModal();
            }
        }
    });

    // Handle back button
    window.addEventListener('popstate', () => {
        if (isLocal) {
            const urlParams = new URLSearchParams(window.location.search);
            const pId = urlParams.get('project');
            if (pId) {
                openModal(pId);
            } else {
                closeModal();
            }
        } else {
            const pathParts = window.location.pathname.split('/').filter(p => p);
            if (pathParts.length > 0) {
                openModal(pathParts[pathParts.length - 1]);
            } else {
                closeModal();
            }
        }
    });

    // Initial load check
    if (isLocal) {
        const urlParams = new URLSearchParams(window.location.search);
        const pId = urlParams.get('project');
        if (pId) {
            setTimeout(() => openModal(pId), 50);
        }
    } else {
        if (window.initialModalProject) {
            setTimeout(() => openModal(window.initialModalProject), 50);
        }
    }
});
