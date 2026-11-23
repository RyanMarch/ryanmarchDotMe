// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { alertDialog, chooseDialog, confirmDialog, infoDialog, toast } from '../public/assets/js/admin/ui.js';

// jsdom has no real <dialog> modal behaviour; give it the part the module needs.
beforeEach(() => {
    document.body.innerHTML = '';
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
    // <form method="dialog"> closes its dialog on submit
    document.addEventListener('submit', e => { if (e.target.method === 'dialog') { e.preventDefault(); e.target.closest('dialog')?.close(); } });
});

const click = text => [...document.querySelectorAll('dialog button')].find(b => b.textContent === text).click();

describe('confirmDialog', () => {
    it('resolves true on the confirm button and false on cancel', async () => {
        let p = confirmDialog({ title: 'Delete it?', message: 'Really', confirmLabel: 'Delete' });
        expect(document.querySelector('.dlg-title').textContent).toBe('Delete it?');
        click('Delete');
        expect(await p).toBe(true);
        p = confirmDialog({ confirmLabel: 'Delete' });
        click('Cancel');
        expect(await p).toBe(false);
    });
    it('resolves false when closed any other way (Esc, backdrop)', async () => {
        const p = confirmDialog({});
        document.querySelector('dialog').close();
        expect(await p).toBe(false);
    });
    it('removes itself from the page afterwards', async () => {
        const p = confirmDialog({});
        click('Confirm');
        await p;
        expect(document.querySelector('dialog')).toBeNull();
    });
    it('shows the message as text, never as HTML', () => {
        confirmDialog({ message: '<img src=x onerror=alert(1)>' });
        expect(document.querySelector('.dlg-message').textContent).toBe('<img src=x onerror=alert(1)>');
        expect(document.querySelector('.dlg-message img')).toBeNull();
    });
    it('puts focus on Cancel for a dangerous action and on the confirm button otherwise', () => {
        confirmDialog({ danger: true, confirmLabel: 'Delete' });
        expect(document.querySelector('dialog [data-autofocus]').textContent).toBe('Cancel');
        document.body.innerHTML = '';
        confirmDialog({ confirmLabel: 'Save' });
        expect(document.querySelector('dialog [data-autofocus]').textContent).toBe('Save');
    });
});

describe('alertDialog', () => {
    it('shows one OK button and resolves when it is pressed', async () => {
        const p = alertDialog('Nope', { title: 'Heads up' });
        expect([...document.querySelectorAll('dialog button')].map(b => b.textContent)).toEqual(['OK']);
        click('OK');
        await p;
    });
});

describe('toast', () => {
    it('shows a message in a live region, and the action button runs once and dismisses', () => {
        vi.useFakeTimers();
        const undo = vi.fn();
        toast('Unpublished Ledger.', { type: 'success', action: { label: 'Undo', onClick: undo } });
        const host = document.getElementById('toasts');
        expect(host.getAttribute('aria-live')).toBe('polite');
        expect(host.textContent).toContain('Unpublished Ledger.');
        host.querySelector('.toast-action').click();
        expect(undo).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(300);
        expect(host.querySelector('.toast')).toBeNull();
        vi.useRealTimers();
    });
    it('goes away by itself after its duration, but not while hovered', () => {
        vi.useFakeTimers();
        toast('Saved.', { duration: 1000 });
        const node = document.querySelector('.toast');
        node.dispatchEvent(new Event('pointerenter'));
        vi.advanceTimersByTime(5000);
        expect(document.querySelector('.toast')).not.toBeNull();
        node.dispatchEvent(new Event('pointerleave'));
        vi.advanceTimersByTime(1300);
        expect(document.querySelector('.toast')).toBeNull();
        vi.useRealTimers();
    });
});

import { countUp } from '../public/assets/js/admin/util.js';

describe('countUp', () => {
    const setup = html => {
        document.body.innerHTML = html;
        window.matchMedia = q => ({ matches: false, media: q });
        let now = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => now);
        const frames = [];
        window.requestAnimationFrame = cb => { frames.push(cb); return frames.length; };
        return { run: ms => { now = ms; const cb = frames.shift(); cb?.(now); } };
    };

    it('starts a big number at 0, rises, and lands on the exact text', () => {
        const { run } = setup('<div id="s"><div class="stat"><span class="v">1,280</span></div></div>');
        const v = document.querySelector('.v');
        countUp(document.getElementById('s'), 400);
        expect(v.textContent).toBe('0');
        run(200);
        const mid = Number(v.textContent.replace(/,/g, ''));
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(1280);
        run(400);
        expect(v.textContent).toBe('1,280');
    });
    it('leaves words, decimals, dashes and tiny numbers alone', () => {
        setup('<div id="s"><div class="stat"><span class="v">577 ms</span><span class="v">1.00</span><span class="v">–</span><span class="v">1</span></div></div>');
        countUp(document.getElementById('s'));
        expect([...document.querySelectorAll('.v')].map(n => n.textContent)).toEqual(['577 ms', '1.00', '–', '1']);
    });
    it('does nothing when the person prefers reduced motion', () => {
        setup('<div id="s"><div class="stat"><span class="v">900</span></div></div>');
        window.matchMedia = q => ({ matches: true, media: q });
        countUp(document.getElementById('s'));
        expect(document.querySelector('.v').textContent).toBe('900');
    });
});

describe('chooseDialog', () => {
    const items = [{ value: 'a1', label: 'Newest', sub: 'today' }, { value: 'b2', label: 'Older', sub: 'last week' }];
    it('resolves the picked value, with the first item selected by default', async () => {
        let p = chooseDialog({ title: 'History', items, confirmLabel: 'Load' });
        expect(document.querySelectorAll('.choose-row')).toHaveLength(2);
        expect(document.querySelector('input[name=choice]:checked').value).toBe('0');
        click('Load');
        expect(await p).toBe('a1');
        p = chooseDialog({ title: 'History', items, confirmLabel: 'Load' });
        document.querySelectorAll('input[name=choice]')[1].checked = true;
        click('Load');
        expect(await p).toBe('b2');
    });
    it('resolves null on cancel or Esc, and shows labels as text', async () => {
        const p = chooseDialog({ title: 'H', items: [{ value: 'x', label: '<b>bold</b>' }] });
        expect(document.querySelector('.choose-label b')).toBeNull();
        click('Cancel');
        expect(await p).toBeNull();
    });
});

describe('infoDialog', () => {
    it('lists keys and descriptions, with "then" between a sequence', async () => {
        const p = infoDialog({ title: 'Shortcuts', rows: [['g a', 'Analytics'], ['?', 'Help']] });
        expect(document.querySelector('dt').textContent).toBe('g then a');
        expect(document.querySelectorAll('kbd')).toHaveLength(3);
        click('Close');
        await p;
    });
});
