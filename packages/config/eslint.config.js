import eslint from '@eslint/js'
import configPrettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

/**
 * Shared ESLint flat config. Each workspace re-exports it from its own
 * eslint.config.js and may append its own entries:
 *
 *   import { baseConfig } from '@finders-eaters/config/eslint'
 *   export default [...baseConfig, ...overrides]
 *
 * Type-aware rules use the typescript-eslint project service, which picks up
 * the workspace's tsconfig.json.
 */
export const baseConfig = tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**', '.turbo/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  configPrettier,
)

export default baseConfig
