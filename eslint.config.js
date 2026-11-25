// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'server/*', '.expo/*', 'coverage/*', 'scripts/*', 'src/vendor/*'],
  },
  {
    // Screen modules are required lazily inside tests so jest.mock() calls apply first.
    files: ['test/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
