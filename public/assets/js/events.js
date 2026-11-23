// Anonymous counters for the admin's Goals: a play on a project page, or a click on its outbound buttons.
// Sends only the event type and the project id; no cookies, no identifiers.
(() => {
    const projectId = () => (location.pathname.match(/^\/project\/([^/]+)/i) || [])[1]?.toLowerCase() || '';
    const send = (t) => {
        const p = projectId();
        if (!p) return;
        try { navigator.sendBeacon('/api/e', new Blob([JSON.stringify({ t, p })], { type: 'application/json' })); } catch { /* counting is best-effort */ }
    };
    const played = new WeakSet();
    // `play` does not bubble, so listen while it travels down. Count each media element once per page view.
    document.addEventListener('play', (e) => {
        if (!(e.target instanceof HTMLMediaElement) || played.has(e.target)) return;
        played.add(e.target);
        send('play');
    }, true);
    document.addEventListener('click', (e) => {
        const a = e.target instanceof Element && e.target.closest('.project-detail-footer-actions a[target="_blank"]');
        if (a) send('out');
    });
})();
