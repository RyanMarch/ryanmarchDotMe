(function () {
    const themeToggle = document.getElementById('theme-toggle');
    const themeStatus = document.getElementById('theme-status');
    let themeStatusTimeout;

    const showThemeStatus = (text) => {
        if (!themeStatus) return;
        themeStatus.textContent = text;
        themeStatus.classList.add('visible');
        clearTimeout(themeStatusTimeout);
        themeStatusTimeout = setTimeout(() => {
            themeStatus.classList.remove('visible');
        }, 2000);
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

            showThemeStatus(target === 'dark' ? 'Dark Theme' : 'Light Theme');
            updateAriaLabel(target);
        });
    }
})();
