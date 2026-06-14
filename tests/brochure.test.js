// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initClearTechBrochure } from '../assets/js/brochure.js';

describe('Brochure Tabs Switcher Behavior', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.innerHTML = `
            <button class="brochure-tab-btn active" data-view="first">First Tab</button>
            <button class="brochure-tab-btn" data-view="second">Second Tab</button>
            
            <div id="panel-first" class="brochure-view-panel" style="display: block;">First Panel Content</div>
            <div id="panel-second" class="brochure-view-panel" style="display: none;">Second Panel Content</div>
        `;
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('should switch panels and update tab classes when clicked', () => {
        initClearTechBrochure(container);

        const tab1 = container.querySelector('[data-view="first"]');
        const tab2 = container.querySelector('[data-view="second"]');
        const panel1 = container.querySelector('#panel-first');
        const panel2 = container.querySelector('#panel-second');

        // Initial active states
        expect(tab1.classList.contains('active')).toBe(true);
        expect(tab2.classList.contains('active')).toBe(false);
        expect(panel1.style.display).toBe('block');
        expect(panel2.style.display).toBe('none');

        // Click second tab
        tab2.click();

        // Verifications
        expect(tab1.classList.contains('active')).toBe(false);
        expect(tab2.classList.contains('active')).toBe(true);
        expect(panel1.style.display).toBe('none');
        expect(panel2.style.display).toBe('block');

        // Click first tab back
        tab1.click();

        // Verifications
        expect(tab1.classList.contains('active')).toBe(true);
        expect(tab2.classList.contains('active')).toBe(false);
        expect(panel1.style.display).toBe('block');
        expect(panel2.style.display).toBe('none');
    });
});
