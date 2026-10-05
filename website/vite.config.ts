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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'UMAMI_');
  return {
    plugins: [umami(env)],
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
