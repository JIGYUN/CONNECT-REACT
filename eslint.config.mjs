// eslint.config.mjs
// @ts-check
import eslint from '@eslint/js';
import * as tseslint from 'typescript-eslint';
import jsonc from 'eslint-plugin-jsonc';
import jsoncParser from 'jsonc-eslint-parser';

export default [
  // 0) 무시(.eslintignore 대체)
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.wrangler/**',
      '**/.open-next/**',
      '**/coverage/**',
    ],
  },

  // 0.5) JSON / JSONC / JSON5 (wrangler.jsonc 포함)
  {
    files: ['**/*.{json,jsonc,json5}'],
    languageOptions: { parser: jsoncParser },
    plugins: { jsonc },
    rules: {
      // 'jsonc/indent': ['error', 2],
    },
  },

  // 1) JS/JSX
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: { ...eslint.configs.recommended.rules },
  },

  // 2) TS/TSX (typed linting)
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...tseslint.configs.recommendedTypeChecked[0].rules,
      ...tseslint.configs.stylisticTypeChecked[0].rules,

      // 팀 규칙
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },

  // (A) 선언 파일: 느슨 모드
  {
    files: ['**/*.d.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // (B) Node 설정/빌드 스크립트(JS만)
  {
    files: [
      'tailwind.config.js',
      'postcss.config.js',
      'next.config.mjs',
      // 'open-next.config.ts'는 TS 블록에 맡긴다
      // 'wrangler.*'는 JSONC 블록이 처리
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { module: 'readonly', require: 'readonly', __dirname: 'readonly' },
    },
    rules: {},
  },
];