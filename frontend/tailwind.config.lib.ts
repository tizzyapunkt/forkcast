import type { Config } from 'tailwindcss';
import base from './tailwind.config';

/**
 * Tailwind for the packaged design system. Same theme as the app — the tokens are the
 * whole point — but the content scan covers only `components/ui/**` plus the /design-sync
 * preview compositions (`.design-sync/previews/**`), so the emitted CSS holds exactly the
 * utilities the primitives use, plus the layout utilities those previews compose them
 * with — and nothing from the app's screens.
 */
const config: Config = {
  ...base,
  content: ['./src/components/ui/**/*.tsx', '../.design-sync/previews/**/*.tsx'],
};

export default config;
