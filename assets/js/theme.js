(function () {
    const themeToggle = document.getElementById('theme-toggle');
    const lookToggle = document.getElementById('look-toggle');
    const statusTimeouts = new Map();

    const showStatus = (el, text) => {
        if (!el) return;
        el.textContent = text;
        el.classList.add('visible');
        clearTimeout(statusTimeouts.get(el));
        statusTimeouts.set(el, setTimeout(() => {
            el.classList.remove('visible');
        }, 2000));
    };

    if (themeToggle) {
        // Dark is the site's default regardless of OS preference. Resolved
        // theme is the explicit override if one is stored, otherwise dark.
        const DEFAULT_THEME = 'dark';

        const getResolvedTheme = () => {
            const stored = localStorage.getItem('theme');
            return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
        };

        const updateAriaLabel = (resolvedTheme) => {
            const next = resolvedTheme === 'dark' ? 'light' : 'dark';
            themeToggle.setAttribute('aria-label', `Switch to ${next} theme`);
        };

        updateAriaLabel(getResolvedTheme());

        themeToggle.addEventListener('click', () => {
            const currentTheme = getResolvedTheme();
            const target = currentTheme === 'dark' ? 'light' : 'dark';

            if (target === DEFAULT_THEME) {
                // Toggling back onto the default: drop the override.
                document.documentElement.removeAttribute('data-theme');
                localStorage.removeItem('theme');
            } else {
                document.documentElement.setAttribute('data-theme', target);
                localStorage.setItem('theme', target);
            }

            showStatus(document.getElementById('theme-status'), target === 'dark' ? 'Dark Theme' : 'Light Theme');
            updateAriaLabel(target);
        });
    }

    if (lookToggle) {
        // Looks: 'new' (the default), 'ember', 'resume' and 'classic'. The classic
        // look replaces the current stylesheet; ember layers on top of it, and
        // resume layers on top of ember. A disabled sheet uses media="not all".
        const LOOKS = ['new', 'ember', 'resume', 'classic'];
        const LOOK_NAMES = { new: 'New Look', ember: 'Ember Look', resume: 'Resume Look', classic: 'Classic Look' };
        const root = document.documentElement;
        const sheets = {
            current: document.getElementById('look-new-css'),
            ember: document.getElementById('look-ember-css'),
            resume: document.getElementById('look-resume-css'),
            classic: document.getElementById('look-classic-css')
        };

        const getLook = () => {
            const attr = root.getAttribute('data-look');
            return LOOKS.includes(attr) ? attr : 'new';
        };
        const nextLook = (look) => LOOKS[(LOOKS.indexOf(look) + 1) % LOOKS.length];

        const updateLookLabel = () => {
            lookToggle.setAttribute('aria-label', `Switch to ${LOOK_NAMES[nextLook(getLook())].toLowerCase()}`);
        };
        updateLookLabel();

        lookToggle.addEventListener('click', () => {
            const look = nextLook(getLook());
            if (sheets.current) sheets.current.media = look === 'classic' ? 'not all' : 'all';
            if (sheets.ember) sheets.ember.media = look === 'ember' || look === 'resume' ? 'all' : 'not all';
            if (sheets.resume) sheets.resume.media = look === 'resume' ? 'all' : 'not all';
            if (sheets.classic) sheets.classic.media = look === 'classic' ? 'all' : 'not all';
            if (look === 'new') {
                root.removeAttribute('data-look');
            } else {
                root.setAttribute('data-look', look);
            }
            try {
                if (look === 'new') localStorage.removeItem('look');
                else localStorage.setItem('look', look);
            } catch { /* storage unavailable: look applies for this page only */ }
            showStatus(document.getElementById('look-status'), LOOK_NAMES[look]);
            updateLookLabel();
        });
    }
})();
