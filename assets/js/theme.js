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
        themeToggle.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('theme') || 'dark';
            let newTheme, statusText;

            if (currentTheme === 'dark') {
                newTheme = 'light';
                statusText = 'Light Theme';
            } else if (currentTheme === 'light') {
                newTheme = 'system';
                statusText = 'System Theme';
            } else {
                newTheme = 'dark';
                statusText = 'Dark Theme';
            }

            if (newTheme === 'system') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', newTheme);
            }

            localStorage.setItem('theme', newTheme);
            showThemeStatus(statusText);
        });
    }
})();
