/**
 * Entry point for the packaged build only (see `vite.config.lib.ts`).
 *
 * It exists so the stylesheet is pulled into the bundle graph without `index.ts` — which
 * the app may import from — carrying a CSS side effect. Application code should import
 * `./index` or the individual modules, never this file.
 */

import './styles.css';

export * from './index';
