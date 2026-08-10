import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          100: '#b0a2ff',
          200: '#9286e0',
          300: '#4e489a',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          100: '#7a67e6',
          200: '#fff9ff',
          300: '#9f8ae8',
          400: '#8a76e3',
          500: '#7a67e6',
        },
        focus: '#7a67e6',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        // Macro identity colors — the single source of truth for every macro dot/bar/diagram
        // (design tokens --macro-* from design_handoff_forkcast_2/design/fc-tokens.css; protein
        // ships in the selected "Grün" variant). The `on` variants are brightened for legibility
        // on the dark indigo header.
        macro: {
          p: 'hsl(var(--macro-p))',
          c: 'hsl(var(--macro-c))',
          f: 'hsl(var(--macro-f))',
          'p-on': 'hsl(var(--macro-p-on))',
          'c-on': 'hsl(var(--macro-c-on))',
          'f-on': 'hsl(var(--macro-f-on))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate],
};

export default config;
