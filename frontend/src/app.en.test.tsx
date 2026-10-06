import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './app';
import { renderWithProviders } from './test/harness';
import { de } from './i18n/de';
import { en } from './i18n/en';

// Runs before the imports above resolve the locale: this file renders the whole app in English.
vi.hoisted(() => localStorage.setItem('forkcast:locale', 'en'));

/** Every static German string that differs from its English counterpart (`Snack`, `kcal`, … are shared). */
function germanOnly(deNode: unknown, enNode: unknown, out: string[] = []): string[] {
  if (typeof deNode === 'string') {
    if (deNode !== enNode && deNode.trim().length >= 3) out.push(deNode.trim());
  } else if (typeof deNode === 'object' && deNode !== null) {
    for (const [key, child] of Object.entries(deNode)) germanOnly(child, (enNode as Record<string, unknown>)[key], out);
  }
  return out;
}

const GERMAN = germanOnly(de, en);

/** What a user can see or hear on the current screen: text, accessible names and placeholders. */
function renderedCopy(): string {
  const attributes = [...document.body.querySelectorAll('[aria-label], [placeholder], [title]')].flatMap((el) =>
    ['aria-label', 'placeholder', 'title'].map((name) => el.getAttribute(name) ?? ''),
  );
  return [document.body.textContent ?? '', ...attributes].join('\n');
}

/** Whole-word occurrence, so `Mai` does not hit `Main navigation`. */
function containsPhrase(copy: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, 'u').test(copy);
}

function leftoverGerman(): string[] {
  const copy = renderedCopy();
  return GERMAN.filter((german) => containsPhrase(copy, german));
}

describe('App in English', () => {
  it('shows no German UI copy on the daily log', async () => {
    renderWithProviders(<App />);
    await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(leftoverGerman()).toEqual([]);
  });

  it('shows no German UI copy on the week plan and the grocery list', async () => {
    renderWithProviders(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Plan' }));
    await screen.findByText('Week plan');
    expect(leftoverGerman()).toEqual([]);

    await userEvent.click(await screen.findByRole('button', { name: /^Grocery list for/ }));
    await screen.findByRole('dialog');
    expect(leftoverGerman()).toEqual([]);
  });

  it('shows no German UI copy on recipes', async () => {
    renderWithProviders(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Recipes' }));
    await screen.findByRole('button', { name: 'New recipe' });
    expect(leftoverGerman()).toEqual([]);
  });

  it('shows no German UI copy on settings', async () => {
    renderWithProviders(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Settings' }));
    await screen.findByRole('radiogroup', { name: 'Language' });
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(leftoverGerman()).toEqual([]);
  });
});
