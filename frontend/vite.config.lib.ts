import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindLibConfig from './tailwind.config.lib';

/**
 * Packages `components/ui/` as a standalone component library — the artefact
 * `/design-sync` uploads, so the design agent builds screens from forkcast's real
 * components instead of generic markup.
 *
 * This is deliberately separate from `vite.config.ts`: the app build stays a plain
 * SPA bundle with the PWA plugin, and neither config can affect the other. Run with
 * `pnpm build:ui`; output lands in `dist-ui/`.
 */
export default defineConfig({
  plugins: [react()],
  // The app's `public/` (icons, manifest assets) has no place in a component bundle.
  publicDir: false,
  css: {
    // The app's postcss.config.js would scan every screen; the library only wants
    // the utilities its own primitives reference.
    postcss: {
      plugins: [tailwindcss(tailwindLibConfig), autoprefixer()],
    },
  },
  build: {
    outDir: 'dist-ui',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/components/ui/lib-entry.ts'),
      name: 'ForkcastUI',
      formats: ['es'],
      fileName: () => 'forkcast-ui.js',
    },
    rollupOptions: {
      // React is provided by the host that renders the components.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        assetFileNames: 'forkcast-ui.css',
        globals: { react: 'React', 'react-dom': 'ReactDOM' },
      },
    },
  },
});
