import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw/server';
import { renderWithProviders } from '../../test/harness';
import { ImportRecipeScreen } from './import-recipe-screen';

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, writable: true });
});

const draft = { name: 'Pasta', yield: 2, ingredients: [], steps: ['Kochen'] };

function stagePhoto(name = 'a.jpg') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type: 'image/jpeg' })] } });
  return screen.findByTestId('staged-photo-0');
}

function renderScreen() {
  return renderWithProviders(<ImportRecipeScreen onCancel={() => {}} onSaved={() => {}} />);
}

describe('ImportRecipeScreen', () => {
  it('asks for a photo before the read can start', () => {
    renderScreen();

    expect(screen.getByRole('button', { name: /rezept lesen/i })).toBeDisabled();
    expect(screen.getByText(/mindestens ein foto/i)).toBeInTheDocument();
  });

  it('hands a successful read to the review step', async () => {
    server.use(http.post('/api/import-recipe-from-photos', () => HttpResponse.json(draft)));
    renderScreen();
    await stagePhoto();

    await userEvent.click(screen.getByRole('button', { name: /rezept lesen/i }));

    expect(await screen.findByDisplayValue('Pasta')).toBeInTheDocument();
  });

  it('explains a failed extraction in the user’s terms and offers a retry', async () => {
    let calls = 0;
    server.use(
      http.post('/api/import-recipe-from-photos', () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: 'ai-extraction-failed' }, { status: 502 })
          : HttpResponse.json(draft);
      }),
    );
    renderScreen();
    await stagePhoto();

    await userEvent.click(screen.getByRole('button', { name: /rezept lesen/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/kein rezept lesen/i);
    expect(alert).not.toHaveTextContent(/ai-extraction-failed/);

    await userEvent.click(screen.getByRole('button', { name: /erneut versuchen/i }));

    expect(await screen.findByDisplayValue('Pasta')).toBeInTheDocument();
  });

  it('names an oversized payload and does not offer a pointless retry loop', async () => {
    server.use(
      http.post('/api/import-recipe-from-photos', () =>
        HttpResponse.json({ error: 'Combined image size exceeds the total limit' }, { status: 413 }),
      ),
    );
    renderScreen();
    await stagePhoto();

    await userEvent.click(screen.getByRole('button', { name: /rezept lesen/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/zu groß/i);
    expect(alert).toHaveTextContent(/entferne/i);
  });

  it('states that the server has the feature switched off, with nothing to retry', async () => {
    server.use(
      http.post('/api/import-recipe-from-photos', () =>
        HttpResponse.json({ error: 'ai-import-not-configured' }, { status: 503 }),
      ),
    );
    renderScreen();
    await stagePhoto();

    await userEvent.click(screen.getByRole('button', { name: /rezept lesen/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/nicht aktiviert/i);
    expect(screen.queryByRole('button', { name: /erneut versuchen/i })).not.toBeInTheDocument();
  });

  it('reports an unreachable server without leaking fetch internals', async () => {
    server.use(http.post('/api/import-recipe-from-photos', () => HttpResponse.error()));
    renderScreen();
    await stagePhoto();

    await userEvent.click(screen.getByRole('button', { name: /rezept lesen/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/nicht erreichbar|internetverbindung/i);
    expect(alert).not.toHaveTextContent(/fetch/i);
  });

  it('lets the user abandon a long read and keeps the staged photos', async () => {
    server.use(
      http.post('/api/import-recipe-from-photos', async () => {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        return HttpResponse.json(draft);
      }),
    );
    renderScreen();
    await stagePhoto();

    await userEvent.click(screen.getByRole('button', { name: /rezept lesen/i }));
    const cancel = await screen.findByRole('button', { name: /lesen abbrechen/i });
    await userEvent.click(cancel);

    await waitFor(() => expect(screen.getByRole('button', { name: /rezept lesen/i })).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('staged-photo-0')).toBeInTheDocument();
  });
});
