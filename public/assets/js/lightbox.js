let lightbox = null;
let lightboxImg = null;
let lightboxCaption = null;
let lightboxClose = null;
let lastActiveElement = null;

export function initializeLightbox() {
    lightbox = document.getElementById('lightbox-overlay');
    if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'lightbox-overlay';
        lightbox.className = 'lightbox-overlay';
        lightbox.setAttribute('aria-hidden', 'true');
        lightbox.setAttribute('tabindex', '-1');
        lightbox.setAttribute('role', 'dialog');
        lightbox.setAttribute('aria-modal', 'true');
        lightbox.setAttribute('aria-label', 'Image gallery lightbox');
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

    lightboxImg = document.getElementById('lightbox-image');
    lightboxCaption = document.getElementById('lightbox-caption');
    lightboxClose = lightbox.querySelector('.lightbox-close');

    // Focus trapping event listener for keyboard accessibility in lightbox dialog
    lightbox.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const focusableElements = lightbox.querySelectorAll('button, [tabindex="0"], iframe');
            if (focusableElements.length === 0) return;
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        }
    });

    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
    lightbox.addEventListener('click', closeLightbox);

    // Escape key handling
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (lightbox && lightbox.classList.contains('open')) {
                closeLightbox();
            }
        }
    });
}

export function openLightbox(src, alt, captionText) {
    if (!lightboxImg || !lightbox) return;
    lastActiveElement = document.activeElement;
    lightboxImg.src = src;
    lightboxImg.alt = alt || 'Enlarged project image';
    lightboxCaption.textContent = captionText || '';
    lightboxCaption.style.display = captionText ? 'block' : 'none';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.focus();
}

export function openDiagramLightbox(src, captionText) {
    if (!lightbox) return;
    lastActiveElement = document.activeElement;
    if (lightboxImg) lightboxImg.style.display = 'none';
    if (lightboxCaption) {
        lightboxCaption.textContent = captionText || '';
        lightboxCaption.style.display = captionText ? 'block' : 'none';
    }
    let lightboxIframe = lightbox.querySelector('.lightbox-iframe');
    if (!lightboxIframe) {
        lightboxIframe = document.createElement('iframe');
        lightboxIframe.className = 'lightbox-iframe';
        const container = lightbox.querySelector('.lightbox-container');
        container.insertBefore(lightboxIframe, lightboxCaption);
    }
    lightboxIframe.src = src + '?lightbox=true';
    lightboxIframe.style.display = 'block';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.focus();
}

export function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        if (lightboxImg) {
            lightboxImg.src = '';
            lightboxImg.style.display = 'block';
        }
        if (lightboxCaption) {
            lightboxCaption.textContent = '';
            lightboxCaption.style.display = 'none';
        }
        const lightboxIframe = lightbox.querySelector('.lightbox-iframe');
        if (lightboxIframe) {
            lightboxIframe.src = '';
            lightboxIframe.style.display = 'none';
        }
        if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
            lastActiveElement.focus();
        }
    }, 400);
}

// Shared handler for lightbox image clicks and hash-link smooth scrolling.
// searchRoot lets hash links be resolved within a scoped container (e.g. SPA frame).
export function setupContentClicks(container, searchRoot) {
    container.addEventListener('click', (e) => {
        // Handle Diagram click to open lightbox
        const diagramSection = e.target.closest('.diagram-section');
        if (diagramSection) {
            e.stopPropagation();
            const iframe = diagramSection.querySelector('iframe');
            if (iframe) {
                const caption = diagramSection.nextElementSibling;
                const captionText = (caption && caption.classList.contains('gallery-caption')) ? caption.textContent : '';
                openDiagramLightbox(iframe.getAttribute('src'), captionText);
            }
            return;
        }

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
