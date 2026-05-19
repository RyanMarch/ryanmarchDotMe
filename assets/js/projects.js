function initializeCustomAudioPlayers(container) {
    const players = container.querySelectorAll('.custom-audio-player');
    
    players.forEach(player => {
        const initialAudio = player.querySelector('audio');
        if (!initialAudio) return;
        
        const src = initialAudio.getAttribute('src');
        const title = player.getAttribute('data-title') || 'Audio Track';
        const subtitle = player.getAttribute('data-subtitle') || 'Local File';
        
        // Dynamically build premium Spotify player UI inside the container.
        player.innerHTML = `
            <audio src="${src}" preload="metadata"></audio>
            
            <!-- Top Row: Title & Info -->
            <div class="player-header">
                <span class="player-title">${title}</span>
                <span class="player-subtitle">${subtitle}</span>
            </div>
            
            <!-- Middle Row: Timeline Scrubber -->
            <div class="player-timeline">
                <span class="player-time-current">0:00</span>
                <div class="player-progress-container" aria-label="Seek track">
                    <div class="player-progress-bar"></div>
                    <div class="player-progress-knob"></div>
                </div>
                <span class="player-time-duration">0:00</span>
            </div>
            
            <!-- Bottom Row: Controls -->
            <div class="player-controls">
                <!-- Volume Control -->
                <div class="player-volume-group">
                    <button class="player-mute" aria-label="Mute">
                        <svg class="icon-volume" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                        <svg class="icon-muted" viewBox="0 0 24 24" style="display:none;"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                    </button>
                    <div class="player-volume-slider-container" aria-label="Volume slider">
                        <div class="player-volume-slider-bar" style="width: 100%;"></div>
                    </div>
                </div>

                <!-- Play/Pause Button -->
                <button class="player-play-pause" aria-label="Play">
                    <svg class="icon-play" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                    <svg class="icon-pause" viewBox="0 0 24 24" style="display:none;"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                </button>

                <!-- Right spacer to balance symmetry -->
                <div class="player-right-spacer"></div>
            </div>
        `;
        
        const audio = player.querySelector('audio');
        const playPauseBtn = player.querySelector('.player-play-pause');
        const iconPlay = player.querySelector('.icon-play');
        const iconPause = player.querySelector('.icon-pause');
        const progressBarContainer = player.querySelector('.player-progress-container');
        const progressBar = player.querySelector('.player-progress-bar');
        const progressBarKnob = player.querySelector('.player-progress-knob');
        const timeCurrent = player.querySelector('.player-time-current');
        const timeDuration = player.querySelector('.player-time-duration');
        const muteBtn = player.querySelector('.player-mute');
        const iconVolume = player.querySelector('.icon-volume');
        const iconMuted = player.querySelector('.icon-muted');
        const volumeSliderContainer = player.querySelector('.player-volume-slider-container');
        const volumeSliderBar = player.querySelector('.player-volume-slider-bar');

        if (!audio || !playPauseBtn) return;

        function formatTime(seconds) {
            if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }

        playPauseBtn.addEventListener('click', () => {
            document.querySelectorAll('audio').forEach(otherAudio => {
                if (otherAudio !== audio && !otherAudio.paused) {
                    otherAudio.pause();
                }
            });

            if (audio.paused) {
                audio.play().catch(e => console.error("Play failed:", e));
            } else {
                audio.pause();
            }
        });

        audio.addEventListener('play', () => {
            if (iconPlay) iconPlay.style.display = 'none';
            if (iconPause) iconPause.style.display = 'block';
        });

        audio.addEventListener('pause', () => {
            if (iconPlay) iconPlay.style.display = 'block';
            if (iconPause) iconPause.style.display = 'none';
        });

        audio.addEventListener('ended', () => {
            if (iconPlay) iconPlay.style.display = 'block';
            if (iconPause) iconPause.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            if (progressBarKnob) progressBarKnob.style.left = '0%';
            if (progressBarContainer) progressBarContainer.style.setProperty('--progress-percent', '0%');
            if (timeCurrent) timeCurrent.textContent = '0:00';
        });

        audio.addEventListener('timeupdate', () => {
            const current = audio.currentTime;
            const duration = audio.duration;
            if (duration && !isNaN(duration) && isFinite(duration)) {
                const percent = (current / duration) * 100;
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressBarKnob) progressBarKnob.style.left = `${percent}%`;
                if (progressBarContainer) progressBarContainer.style.setProperty('--progress-percent', `${percent}%`);
                if (timeDuration) timeDuration.textContent = formatTime(duration);
            }
            if (timeCurrent) timeCurrent.textContent = formatTime(current);
        });

        const setDuration = () => {
            if (timeDuration && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                timeDuration.textContent = formatTime(audio.duration);
            }
        };

        if (audio.readyState >= 1) {
            setDuration();
        } else {
            audio.addEventListener('loadedmetadata', setDuration);
        }
        audio.addEventListener('durationchange', setDuration);

        if (progressBarContainer) {
            progressBarContainer.addEventListener('click', (e) => {
                const rect = progressBarContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const percent = Math.min(Math.max(clickX / width, 0), 1);
                
                if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                    audio.currentTime = percent * audio.duration;
                    if (progressBar) progressBar.style.width = `${percent * 100}%`;
                    if (progressBarKnob) progressBarKnob.style.left = `${percent * 100}%`;
                }
            });
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                audio.muted = !audio.muted;
                if (audio.muted) {
                    if (iconVolume) iconVolume.style.display = 'none';
                    if (iconMuted) iconMuted.style.display = 'block';
                    if (volumeSliderBar) volumeSliderBar.style.width = '0%';
                } else {
                    if (iconVolume) iconVolume.style.display = 'block';
                    if (iconMuted) iconMuted.style.display = 'none';
                    if (volumeSliderBar) volumeSliderBar.style.width = `${audio.volume * 100}%`;
                }
            });
        }

        if (volumeSliderContainer) {
            volumeSliderContainer.addEventListener('click', (e) => {
                const rect = volumeSliderContainer.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const percent = Math.min(Math.max(clickX / width, 0), 1);
                
                audio.volume = percent;
                if (volumeSliderBar) volumeSliderBar.style.width = `${percent * 100}%`;
                
                if (percent === 0) {
                    audio.muted = true;
                    if (iconVolume) iconVolume.style.display = 'none';
                    if (iconMuted) iconMuted.style.display = 'block';
                } else {
                    audio.muted = false;
                    if (iconVolume) iconVolume.style.display = 'block';
                    if (iconMuted) iconMuted.style.display = 'none';
                }
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('projects-grid');
    const modalContentArea = document.getElementById('modal-content-area');

    // 1. Dynamic Lightbox Setup (programmatically creates the lightbox if it is missing)
    let lightbox = document.getElementById('lightbox-overlay');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox-overlay';
        lightbox.className = 'lightbox-overlay';
        lightbox.setAttribute('aria-hidden', 'true');
        lightbox.innerHTML = `
            <button class="lightbox-close" aria-label="Close lightbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div class="lightbox-container">
                <img id="lightbox-image" src="" alt="Enlarged view">
                <p id="lightbox-caption" class="lightbox-caption"></p>
            </div>
        `;
        document.body.appendChild(lightbox);
    }
    const lightboxImg = document.getElementById('lightbox-image');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = lightbox.querySelector('.lightbox-close');

    // Define sophisticated category filters
    const filterCategories = [
        {
            id: 'all',
            label: 'All',
            match: (project) => true
        },
        {
            id: 'professional',
            label: 'Professional',
            match: (project) => project.tags.some(t => ['professional', 'platform', 'real estate'].includes(t.label.toLowerCase()))
        },
        {
            id: 'web-apps',
            label: 'Web & Apps',
            match: (project) => project.tags.some(t => ['web development', 'design tool', 'app', 'platform', 'digital signage', 'backend', 'experimentation'].includes(t.label.toLowerCase()))
        },
        {
            id: 'audio-music',
            label: 'Audio & Music',
            match: (project) => project.tags.some(t => ['audio production', 'composition', 'radio', 'podcast', 'mixing'].includes(t.label.toLowerCase()))
        },
        {
            id: 'video-film',
            label: 'Video & Film',
            match: (project) => project.tags.some(t => ['video production', 'comedy'].includes(t.label.toLowerCase()))
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

    if (grid) {
        // Render Filter Pills
        const filterPillsContainer = document.getElementById('filter-pills');
        if (filterPillsContainer) {
            filterCategories.forEach(cat => {
                const pill = document.createElement('button');
                pill.className = `filter-pill${cat.id === 'all' ? ' active' : ''}`;
                pill.setAttribute('data-category', cat.id);
                pill.innerHTML = `${cat.label}`;
                
                pill.addEventListener('click', () => {
                    if (pill.classList.contains('active')) return;
                    
                    // Toggle active class on pills
                    filterPillsContainer.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    
                    // Filter the projects
                    filterProjects(cat.id);
                });
                
                filterPillsContainer.appendChild(pill);
            });

            // Add scroll listeners to update fade masks dynamically on mobile
            const updateScrollFade = () => {
                const scrollLeft = filterPillsContainer.scrollLeft;
                const maxScrollLeft = filterPillsContainer.scrollWidth - filterPillsContainer.clientWidth;
                
                // Use a small 2px threshold to avoid subpixel rounding issues on some screens
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
            };
            
            filterPillsContainer.addEventListener('scroll', updateScrollFade);
            // Run initial check after rendering (slight delay to let CSS rendering happen)
            setTimeout(updateScrollFade, 50);
            window.addEventListener('resize', updateScrollFade);
        }

        // Render Projects
        myProjects.forEach(project => {
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
            if (project.hasExtendedContent) {
                // ONLY Read More button if extended content exists (navigates naturally!)
                actionsHtml = `
                    <a href="/project/${project.id}/" class="project-btn read-more-btn" data-project-id="${project.id}">
                        <span>Read More</span>
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    </a>
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

            let visualHtml = '';
            if (project.image) {
                visualHtml = `<img id="project-image-${project.id}" src="${project.image}" alt="${project.title} Preview" loading="lazy" class="${project.featured ? 'destination-image-standalone' : 'destination-icon'} ${project.imageClass}">`;
            } else {
                let iconSvg = '';
                if (project.symbol === 'data') {
                    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" /></svg>`;
                } else if (project.symbol === 'hub') {
                    iconSvg = `<img src="assets/img/rentpress-logo.svg" alt="RentPress">`;
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
                        <h3>${project.title}</h3>
                    </div>
                    <p>${project.subtitle}</p>
                    <div class="destination-actions">
                        ${actionsHtml}
                        ${sourceHtml}
                    </div>
                </div>
                <div class="${project.featured ? 'destination-standalone-visual' : 'destination-visual'}">
                     ${visualHtml}
                </div>
            `;
            
            grid.appendChild(card);
        });
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
        const cards = grid.querySelectorAll('.destination-card');
        
        // Temporarily lock the grid height to prevent sudden layout collapses during the FLIP transition
        const currentGridHeight = grid.getBoundingClientRect().height;
        grid.style.minHeight = `${currentGridHeight}px`;
        
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
                    grid.style.minHeight = '';
                }, 600);
            });
        });
    }

    // 2. Automatically initialize custom audio players for the current page content
    if (modalContentArea) {
        initializeCustomAudioPlayers(modalContentArea);
    }

    // 3. Lightbox open/close functions
    function openLightbox(src, alt, captionText) {
        if (!lightboxImg || !lightbox) return;
        lightboxImg.src = src;
        lightboxImg.alt = alt || 'Enlarged project image';
        lightboxCaption.textContent = captionText || '';
        lightboxCaption.style.display = captionText ? 'block' : 'none';
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        lightbox.focus();
    }

    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (lightboxImg) lightboxImg.src = '';
            if (lightboxCaption) lightboxCaption.textContent = '';
        }, 400);
    }

    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
    if (lightbox) {
        lightbox.addEventListener('click', closeLightbox);
    }

    // Shared handler for lightbox image clicks and hash-link smooth scrolling.
    // searchRoot lets hash links be resolved within a scoped container (e.g. SPA frame).
    function setupContentClicks(container, searchRoot) {
        container.addEventListener('click', (e) => {
            // 1. Handle Lightbox for images
            if (e.target.tagName === 'IMG') {
                e.stopPropagation();
                const parent = e.target.closest('.gallery-item');
                const caption = parent ? parent.querySelector('.gallery-caption') : null;
                openLightbox(e.target.src, e.target.alt, caption ? caption.textContent : '');
                return;
            }

            // 2. Handle Table of Contents / Hash Links
            const hashLink = e.target.closest('a[href^="#"]');
            if (hashLink) {
                const targetId = hashLink.getAttribute('href').substring(1);
                const targetElement =
                    (searchRoot && searchRoot.querySelector(`#${targetId}`)) ||
                    document.getElementById(targetId);
                if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    }

    if (modalContentArea) {
        setupContentClicks(modalContentArea, null);
    }

    // Escape key handling
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (lightbox && lightbox.classList.contains('open')) {
                closeLightbox();
            }
        }
    });

    // On standalone project pages, wire up audio players and lightbox/hash links
    // (on the homepage modalContentArea is null, so these are no-ops)
    if (modalContentArea) {
        setupContentClicks(modalContentArea, modalContentArea);
    }

    // Card clicks — let the browser navigate naturally to the standalone project page
    if (grid) {
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.destination-card');
            if (!card) return;

            // External links and source links navigate on their own
            if (e.target.closest('.project-btn:not(.read-more-btn), .project-link')) {
                return;
            }

            // Clicking anywhere on a card with a Read More button navigates to it
            const readMoreBtn = card.querySelector('.read-more-btn');
            if (readMoreBtn && !e.target.closest('a')) {
                window.location.href = readMoreBtn.getAttribute('href');
            }
        });
    }
});

