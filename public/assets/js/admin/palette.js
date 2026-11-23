// Command palette: Cmd/Ctrl+K (or "/") to jump to any section or project.
import { esc } from './util.js';
import { go, href, parse } from './router.js';

export function initPalette(nav) {
    const dlg = document.createElement('dialog');
    dlg.className = 'palette';
    dlg.setAttribute('aria-label', 'Search or jump to');
    dlg.innerHTML = `<input type="text" class="palette-input" placeholder="Jump to a section or project…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list">
        <ul class="palette-list" id="palette-list" role="listbox"></ul>
        <div class="palette-foot"><span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span></div>`;
    document.body.appendChild(dlg);
    const input = dlg.querySelector('input');
    const list = dlg.querySelector('ul');
    let items = [];
    let sel = 0;

    const entries = () => [
        ...nav.map(n => ({ label: n.title, hint: n.group, go: () => { go(href(n.id)); } })),
        { label: 'New project', hint: 'Action', go: async () => {
            go(href('projects'));
            await window.adminEnsureEditor?.();
            const form = document.getElementById('new-project-form');
            if (form?.classList.contains('hidden') && typeof window.toggleNewProjectForm === 'function') window.toggleNewProjectForm();
            document.getElementById('new-project-title')?.focus();
        } },
        { label: 'View site', hint: 'Action', go: () => window.open('/', '_blank', 'noopener') },
        ...(globalThis.myProjects || []).map(p => ({ label: p.title, hint: `Edit · ${p.id}`, go: () => {
            const file = `content/${p.id}/index.html`;
            if (parse().view === 'projects') window.adminEnsureEditor?.().then(() => window.loadFile(file));
            else go(href('projects', [], { file }));
        } }))
    ];

    function draw() {
        const q = input.value.trim().toLowerCase();
        items = entries().filter(e => !q || e.label.toLowerCase().includes(q) || e.hint.toLowerCase().includes(q)).slice(0, 12);
        sel = Math.min(sel, Math.max(0, items.length - 1));
        list.innerHTML = items.length
            ? items.map((e, i) => `<li role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === sel}"><span>${esc(e.label)}</span><span class="hint">${esc(e.hint)}</span></li>`).join('')
            : '<li class="none">No matches</li>';
        input.setAttribute('aria-activedescendant', items.length ? `pal-${sel}` : '');
    }
    const run = i => { const e = items[i]; if (!e) return; dlg.close(); e.go(); };
    const open = () => { if (dlg.open || document.getElementById('admin-view').classList.contains('hidden')) return; input.value = ''; sel = 0; draw(); dlg.showModal(); input.focus(); };

    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % Math.max(1, items.length);
            draw();
            list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
            e.preventDefault();
        } else if (e.key === 'Enter') { run(sel); e.preventDefault(); }
    });
    list.addEventListener('click', e => { const li = e.target.closest('li[data-i]'); if (li) run(Number(li.dataset.i)); });
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    document.getElementById('palette-btn')?.addEventListener('click', open);
    document.addEventListener('keydown', e => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
        if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
        else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); open(); }
    });

    // Show Ctrl instead of the Command symbol off macOS.
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
        const k = document.querySelector('.search-key');
        if (k) k.textContent = 'Ctrl K';
    }
}
