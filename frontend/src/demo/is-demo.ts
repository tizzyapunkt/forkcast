/** True only in the demo build (`vp build --mode demo`); Vite inlines it, so other builds drop demo code. */
export const isDemo = import.meta.env.MODE === 'demo';
