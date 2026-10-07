import { defineConfig, loadEnv, type Plugin } from 'vite-plus';
import { resolve } from 'node:path';

// Plain static site: one HTML entry per language, no framework.
// Umami is only injected when both env vars are set (see .env.example), so local dev never
// reports page views. UMAMI_DOMAINS limits tracking to the live host, so a production build
// opened with `vp preview` does not count either.
function umami(env: Record<string, string>): Plugin {
  const src = env.UMAMI_SCRIPT_URL;
  const websiteId = env.UMAMI_WEBSITE_ID;
  const domains = env.UMAMI_DOMAINS;
  return {
    name: 'forkcast-umami',
    transformIndexHtml() {
      if (!src || !websiteId) return [];
      const attrs: Record<string, string | boolean> = { defer: true, src, 'data-website-id': websiteId };
      if (domains) attrs['data-domains'] = domains;
      return [{ tag: 'script', attrs, injectTo: 'head' }];
    },
  };
}

// The interest check submits to a Tally form, one per language so Tally's own labels match the
// page. Without the page's form ID the form stays in the page but says it is not live yet,
// instead of posting nowhere.
function tally(env: Record<string, string>): Plugin {
  return {
    name: 'forkcast-tally',
    transformIndexHtml(html, ctx) {
      const formId = ctx.path.startsWith('/de/') ? env.TALLY_FORM_ID_DE : env.TALLY_FORM_ID_EN;
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
