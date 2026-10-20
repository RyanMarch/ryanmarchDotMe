export function initClearTechBrochure(container) {
    const tabs = container.querySelectorAll('.brochure-tab-btn');
    const panels = container.querySelectorAll('.brochure-view-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetView = tab.getAttribute('data-view');
            panels.forEach(panel => {
                panel.style.display = (panel.id === `panel-${targetView}`) ? 'block' : 'none';
            });
        });
    });
}
