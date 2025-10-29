module.exports = {
    root: true,
    extends: ['next/core-web-vitals'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'import'],
    settings: {
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true,
                project: ['./tsconfig.json']
            },
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs']
            }
        },
        react: { version: 'detect' }
    },
    rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
        '@typescript-eslint/no-explicit-any': 'error',

        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': ['warn', { additionalHooks: '(useMemoOne|useDebouncedCallback)' }],

        'import/no-unresolved': 'error',
        'import/order': ['warn', {
            'newlines-between': 'always',
            alphabetize: { order: 'asc', caseInsensitive: true },
            groups: [['builtin', 'external'], ['internal'], ['parent', 'sibling', 'index']],
            pathGroups: [
                { pattern: '@/**', group: 'internal', position: 'before' },
                { pattern: '@app/**', group: 'internal', position: 'before' },
                { pattern: '@views/**', group: 'internal', position: 'before' },
                { pattern: '@shared/**', group: 'internal', position: 'before' }
            ],
            pathGroupsExcludedImportTypes: ['builtin']
        }],

        'no-console': process.env.NODE_ENV === 'production' ? ['warn', { allow: ['warn', 'error'] }] : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
    },
    overrides: [
        {
            files: ['src/views/**/*.{ts,tsx}'],
            rules: {
                // 뷰는 일단 경고로 운영(빌드 차단 X). 점진 타이핑 예정.
                '@typescript-eslint/no-explicit-any': 'warn'
            }
        }
    ],
    ignorePatterns: [
        'node_modules/',
        '.next/',
        '.vercel/',
        '.wrangler/',
        'dist/',
        'public/'
    ]
};