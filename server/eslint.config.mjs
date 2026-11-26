import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['eslint.config.mjs', 'dist/**', 'src/shared/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
