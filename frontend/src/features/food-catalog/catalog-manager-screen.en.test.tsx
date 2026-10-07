import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { CatalogManagerScreen } from './catalog-manager-screen';
import type { CatalogEntry } from '../../domain/food-catalog';

// Runs before the imports above resolve the locale: this file renders the manager in English.
vi.hoisted(() => localStorage.setItem('forkcast:locale', 'en'));

const moehre: CatalogEntry = {
  id: 'moehre',
  name: 'Möhre',
  nameEn: 'Carrot',
  synonyms: ['Karotte'],
  unit: 'g',
  macrosPer100: { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
};

const quark: CatalogEntry = {
  id: 'quark',
  name: 'Magerquark',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 67, protein: 12, carbs: 4, fat: 0.2 },
};

const renderManager = () => renderWithProviders(<CatalogManagerScreen onBack={() => {}} />);

describe('CatalogManagerScreen — English locale', () => {
  it('lists the English name, falling back to the canonical name', async () => {
    server.use(http.get('/api/catalog', () => HttpResponse.json({ entries: [moehre, quark] })));
    renderManager();

    expect(await screen.findByText('Carrot')).toBeInTheDocument();
    expect(screen.getByText('Magerquark')).toBeInTheDocument();
    expect(screen.queryByText('Möhre')).not.toBeInTheDocument();
  });

  it('still filters by the German name', async () => {
    server.use(http.get('/api/catalog', () => HttpResponse.json({ entries: [moehre, quark] })));
    renderManager();
    await screen.findByText('Carrot');

    await userEvent.type(screen.getByRole('searchbox'), 'möhre');

    expect(screen.getByText('Carrot')).toBeInTheDocument();
    expect(screen.queryByText('Magerquark')).not.toBeInTheDocument();
  });

  it('opens the editor with both names', async () => {
    server.use(http.get('/api/catalog', () => HttpResponse.json({ entries: [moehre] })));
    renderManager();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Carrot' }));

    expect(await screen.findByLabelText('Name')).toHaveValue('Möhre');
    expect(screen.getByLabelText('English name')).toHaveValue('Carrot');
  });
});
