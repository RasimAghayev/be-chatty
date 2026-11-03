const js = require('@eslint/js');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  {
    ignores: ['build/**', 'coverage/**', 'node_modules/**', 'db/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      semi: [2, 'always'],
      'space-before-function-paren': [0, { anonymous: 'always', named: 'always' }],
      camelcase: 0,
      'no-return-assign': 0,
      quotes: ['error', 'single'],
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrorsIgnorePattern: '^_' }]
    }
  },
  prettierConfig
];
