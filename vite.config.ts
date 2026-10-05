import { defineConfig } from 'vite-plus';

export default defineConfig({
  // Pre-commit (`.vite-hooks/pre-commit` runs `vp staged`). Scoped to source dirs so a
  // commit never reformats markdown/openspec files.
  staged: {
    'backend/src/**/*.ts': 'vp check --fix',
    'frontend/src/**/*.{ts,tsx}': 'vp check --fix',
    'website/**/*.{js,ts}': 'vp check --fix',
  },
  fmt: {
    trailingComma: 'all',
    singleQuote: true,
    printWidth: 120,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    arrowParens: 'always',
    bracketSpacing: true,
    bracketSameLine: false,
    jsxBracketSameLine: false,
  },
  lint: {
    ignorePatterns: [
      'design_handoff_*/**',
      '**/dist/**',
      '.claude/skills/**',
      '.cursor/skills/**',
      '.agents/skills/**',
    ],
    plugins: ['typescript', 'unicorn', 'vitest', 'oxc'],
    categories: {
      correctness: 'error',
    },
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    env: {
      builtin: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
});
