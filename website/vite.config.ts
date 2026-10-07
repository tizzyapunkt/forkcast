import { defineConfig, loadEnv, type Plugin } from 'vite-plus';
import { resolve } from 'node:path';

// Plain static site: one HTML entry per language, no framework.
// Umami is only injected when both env vars are set (see .env.example), so local dev
// and preview builds never report page views.
function umami(env: Record<string, string>): Plugin {
  const src = env.UMAMI_SCRIPT_URL;
  const websiteId = env.UMAMI_WEBSITE_ID;
  return {
    name: 'forkcast-umami',
    transformIndexHtml() {
      if (!src || !websiteId) return [];
      return [{ tag: 'script', attrs: { defer: true, src, 'data-website-id': websiteId }, injectTo: 'head' }];
    },
  };
}

// The interest check submits to a Tally form. Without TALLY_FORM_ID the form stays in the page
// but says it is not live yet, instead of posting nowhere.
function tally(env: Record<string, string>): Plugin {
  const formId = env.TALLY_FORM_ID;
  return {
    name: 'forkcast-tally',
    transformIndexHtml(html) {
      const action = formId ? `https://tally.so/r/${encodeURIComponent(formId)}` : '';
      return html
        .replaceAll('%TALLY_ACTION%', action)
        .replaceAll('data-live="%TALLY_LIVE%"', formId ? 'data-live="true"' : '');
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, ['UMAMI_', 'TALLY_']);
  return {
    plugins: [umami(env), tally(env)],
    build: {
      rollupOptions: {
        input: {
          en: resolve(import.meta.dirname, 'index.html'),
          de: resolve(import.meta.dirname, 'de/index.html'),
        },
      },
    },
    server: { port: 5174 },
  };
});
