import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        // Global ignores configuration (must be in a standalone object in Flat Config)
        ignores: [
            'node_modules/**',
            '.wrangler/**',
            'public/assets/js/beacon.min.js',
            'coverage/**'
        ]
    },
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            }
        },
        rules: {
            'no-unused-vars': ['warn', { argsIgnorePattern: '^[e_]' }],
            'no-console': 'off', // Personal site frequently uses logs for audits
            'no-undef': 'error',
            'no-empty': 'warn'
        }
    },
    {
        // The editor predates the module split: a classic script whose functions are
        // called from inline onclick handlers and from projects-list.js. Its logic was
        // moved verbatim, so only the cross-file/global rules are relaxed here.
        files: ['public/assets/js/admin/editor.js'],
        languageOptions: {
            sourceType: 'script',
            globals: { Prism: 'readonly', CodeJar: 'readonly', syncImageUploader: 'readonly' }
        },
        rules: {
            'no-unused-vars': 'off',
            'no-useless-escape': 'off',
            'no-useless-assignment': 'off'
        }
    },
    {
        files: ['public/assets/js/admin/projects-list.js'],
        languageOptions: {
            globals: {
                filterSearchResults: 'readonly',
                renderSearchResults: 'readonly',
                checkAuth: 'readonly',
                currentFile: 'readonly',
                syncImageUploader: 'readonly',
                loadFile: 'readonly',
                toggleUploader: 'readonly'
            }
        },
        rules: { 'no-useless-escape': 'off' }
    },
    {
        files: ['worker.js'],
        languageOptions: {
            globals: {
                HTMLRewriter: 'readonly'
            }
        }
    }
];
