import { defineConfig, globalIgnores } from 'eslint/config';
import { fixupConfigRules } from '@eslint/compat';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

// eslint-config-next (via eslint-plugin-react/jsx-a11y) still calls RuleContext
// methods ESLint 10 removed (context.getFilename(), etc. — see
// https://github.com/jsx-eslint/eslint-plugin-react/pull/3972, open upstream).
// fixupConfigRules() is the official @eslint/compat shim that restores those
// methods on the context object passed into each wrapped rule — remove this
// wrapping once eslint-config-next ships a release built on an ESLint-10-compatible
// eslint-plugin-react/jsx-a11y.
export default defineConfig([
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTypeScript),
  globalIgnores(['.next/**', 'coverage/**', 'playwright-report/**', 'supabase/.temp/**']),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      // Server Actions bound via useActionState must keep the (prevState, formData)
      // signature even when a given action's body needs neither — underscore-prefix
      // is the existing convention (e.g. submitBusinessStep's _prevState) for marking
      // that intentionally, but only trailing-unused args were actually exempted
      // without this option.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
]);
