// frontend/eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/', 'static/', 'node_modules/', '*.timestamp-*.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Permite variables/argumentos sin usar si empiezan por "_"
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // El uso de `any` ya existente se mantiene como warning, no error,
      // para no bloquear el CI por deuda técnica preexistente.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
