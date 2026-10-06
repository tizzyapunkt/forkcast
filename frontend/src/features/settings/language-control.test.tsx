import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { renderWithProviders, createTestQueryClient } from '../../test/harness';
import { LOCALE_STORAGE_KEY } from '../../i18n/locale';
import { SettingsScreen } from './settings-screen';

describe('Settings language control', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.setItem(LOCALE_STORAGE_KEY, 'de');
  });

  it('shows the active locale as selected', () => {
    renderWithProviders(<SettingsScreen />, { queryClient: createTestQueryClient() });
    const group = screen.getByRole('radiogroup', { name: 'Sprache' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Deutsch' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'English' })).not.toBeChecked();
  });

  it('choosing English stores it on the device and reloads the app', async () => {
    const reload = vi.fn<() => void>();
    vi.stubGlobal('location', { ...window.location, reload });
    renderWithProviders(<SettingsScreen />, { queryClient: createTestQueryClient() });

    await userEvent.click(screen.getByRole('radio', { name: 'English' }));

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(reload).toHaveBeenCalledOnce();
  });
});
