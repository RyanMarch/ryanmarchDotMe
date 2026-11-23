// In-app dialogs and toasts, instead of the browser's confirm() and alert() boxes.
// Exposed on window too (adminConfirm, adminAlert, adminToast) for the classic editor script.

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

function openDialog({ title, message, buttons, focus }) {
    return new Promise(resolve => {
        const dlg = el('dialog', 'dlg');
        dlg.setAttribute('aria-labelledby', 'dlg-title');
        const form = el('form', 'dlg-body');
        form.method = 'dialog';
        form.append(el('h2', 'dlg-title', title));
        form.lastChild.id = 'dlg-title';
        if (message) form.append(el('p', 'dlg-message', message));
        const row = el('div', 'dlg-actions');
        let answer = false;
        for (const b of buttons) {
            const btn = el('button', `btn ${b.primary ? (b.danger ? 'btn-danger' : '') : 'btn-secondary'}`.trim(), b.label);
            btn.type = 'submit';
            btn.value = String(b.value);
            btn.addEventListener('click', () => { answer = b.value; });
            if (b.id === focus) btn.dataset.autofocus = '1';
            row.append(btn);
        }
        form.append(row);
        dlg.append(form);
        dlg.addEventListener('close', () => { dlg.remove(); resolve(answer); });
        dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); // the backdrop
        document.body.append(dlg);
        dlg.showModal();
        (dlg.querySelector('[data-autofocus]') || dlg.querySelector('button'))?.focus();
    });
}

/** Resolves true if the person confirms. Esc, the backdrop and Cancel all resolve false. */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
    return openDialog({
        title, message,
        buttons: [{ id: 'cancel', label: cancelLabel, value: false }, { id: 'ok', label: confirmLabel, value: true, primary: true, danger }],
        focus: danger ? 'cancel' : 'ok'
    });
}

export function alertDialog(message, { title = 'Heads up' } = {}) {
    return openDialog({ title, message, buttons: [{ id: 'ok', label: 'OK', value: true, primary: true }], focus: 'ok' });
}

/**
 * Pick one item from a list. items: [{ value, label, sub }]. Resolves to the chosen value, or null if cancelled.
 */
export function chooseDialog({ title, message = '', items, confirmLabel = 'Choose', cancelLabel = 'Cancel' }) {
    return new Promise(resolve => {
        const dlg = el('dialog', 'dlg dlg-wide');
        dlg.setAttribute('aria-labelledby', 'dlg-title');
        const form = el('form', 'dlg-body');
        form.method = 'dialog';
        const h = el('h2', 'dlg-title', title);
        h.id = 'dlg-title';
        form.append(h);
        if (message) form.append(el('p', 'dlg-message', message));
        const list = el('div', 'choose-list');
        list.setAttribute('role', 'radiogroup');
        items.forEach((it, i) => {
            const row = el('label', 'choose-row');
            const radio = el('input');
            radio.type = 'radio';
            radio.name = 'choice';
            radio.value = String(i);
            if (i === 0) radio.checked = true;
            const text = el('span', 'choose-text');
            text.append(el('span', 'choose-label', it.label));
            if (it.sub) text.append(el('span', 'choose-sub', it.sub));
            row.append(radio, text);
            list.append(row);
        });
        const actions = el('div', 'dlg-actions');
        let answer = null;
        const cancel = el('button', 'btn btn-secondary', cancelLabel);
        cancel.type = 'submit';
        const ok = el('button', 'btn', confirmLabel);
        ok.type = 'submit';
        ok.addEventListener('click', () => { const picked = form.querySelector('input[name=choice]:checked'); answer = picked ? items[Number(picked.value)].value : null; });
        actions.append(cancel, ok);
        form.append(list, actions);
        dlg.append(form);
        dlg.addEventListener('close', () => { dlg.remove(); resolve(answer); });
        dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
        document.body.append(dlg);
        dlg.showModal();
        (list.querySelector('input:checked') || ok).focus();
    });
}

/** A read-only list of key/description pairs (the shortcuts cheat sheet). */
export function infoDialog({ title, rows }) {
    return new Promise(resolve => {
        const dlg = el('dialog', 'dlg');
        dlg.setAttribute('aria-labelledby', 'dlg-title');
        const form = el('form', 'dlg-body');
        form.method = 'dialog';
        const h = el('h2', 'dlg-title', title);
        h.id = 'dlg-title';
        const list = el('dl', 'kbd-list');
        for (const [keys, text] of rows) {
            const dt = el('dt');
            keys.split(' ').forEach((k, i) => { if (i) dt.append(' then '); dt.append(el('kbd', '', k)); });
            list.append(dt, el('dd', '', text));
        }
        const actions = el('div', 'dlg-actions');
        const ok = el('button', 'btn', 'Close');
        ok.type = 'submit';
        actions.append(ok);
        form.append(h, list, actions);
        dlg.append(form);
        dlg.addEventListener('close', () => { dlg.remove(); resolve(); });
        dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
        document.body.append(dlg);
        dlg.showModal();
        ok.focus();
    });
}

function toastHost() {
    let host = document.getElementById('toasts');
    if (!host) {
        host = el('div', 'toasts');
        host.id = 'toasts';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        document.body.append(host);
    }
    return host;
}

/**
 * A short message in the corner. `action` adds a button (for Undo). Stays while hovered or focused.
 * Returns { dismiss }.
 */
export function toast(message, { type = 'info', action = null, duration = 7000 } = {}) {
    const node = el('div', `toast toast-${type}`);
    node.append(el('span', 'toast-text', message));
    let timer;
    const dismiss = () => { clearTimeout(timer); node.classList.add('leaving'); setTimeout(() => node.remove(), 180); };
    if (action) {
        const btn = el('button', 'toast-action', action.label);
        btn.type = 'button';
        btn.addEventListener('click', () => { dismiss(); action.onClick(); });
        node.append(btn);
    }
    const close = el('button', 'toast-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.addEventListener('click', dismiss);
    node.append(close);
    const arm = () => { clearTimeout(timer); if (duration) timer = setTimeout(dismiss, duration); };
    node.addEventListener('pointerenter', () => clearTimeout(timer));
    node.addEventListener('pointerleave', arm);
    node.addEventListener('focusin', () => clearTimeout(timer));
    node.addEventListener('focusout', arm);
    toastHost().append(node);
    arm();
    return { dismiss };
}

if (typeof window !== 'undefined') {
    window.adminConfirm = (message, opts = {}) => confirmDialog({ message, ...opts });
    window.adminAlert = (message, opts) => alertDialog(message, opts);
    window.adminToast = toast;
    window.adminChoose = chooseDialog;
}
