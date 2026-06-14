import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        // Global ignores configuration (must be in a standalone object in Flat Config)
        ignores: [
            'node_modules/**',
            '.wrangler/**',
            'assets/js/beacon.min.js',
            'coverage/**'
        ]
    },
    {
        files: ['**/*.js'],
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
        files: ['worker.js'],
        languageOptions: {
            globals: {
                HTMLRewriter: 'readonly'
            }
        }
    }
];
