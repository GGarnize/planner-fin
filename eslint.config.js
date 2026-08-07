const js = require('@eslint/js');
const eslintConfigPrettier = require('eslint-config-prettier/flat');
const tseslint = require('typescript-eslint');
const vue = require('eslint-plugin-vue');

module.exports = tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
    },
  },
  eslintConfigPrettier,
);
