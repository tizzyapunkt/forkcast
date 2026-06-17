import { StrictMode } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/harness';
import { SourcePhotos } from './source-photos';
import type { StagedPhoto } from './photo-staging';

let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => {
      const url = `blob:mock-${n++}`;
      created.push(url);
      return url;
    },
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: (url: string) => {
      revoked.push(url);
    },
    writable: true,
  });
});

function makePhoto(id: string): StagedPhoto {
  const file = new File([new Uint8Array(10)], `${id}.jpg`, { type: 'image/jpeg' });
  return { id, file, mediaType: 'image/jpeg', previewUrl: 'blob:stale', sizeBytes: 10 };
}

describe('SourcePhotos', () => {
  it('renders nothing when there are no photos', () => {
    const { container } = renderWithProviders(<SourcePhotos photos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one thumbnail per photo in order, from URLs derived from the file (not previewUrl)', () => {
    renderWithProviders(<SourcePhotos photos={[makePhoto('a'), makePhoto('b')]} />);
    const thumbs = [screen.getByTestId('source-photo-0'), screen.getByTestId('source-photo-1')];
    const img0 = thumbs[0]!.querySelector('img') as HTMLImageElement;
    const img1 = thumbs[1]!.querySelector('img') as HTMLImageElement;
    expect(img0.getAttribute('src')).toBe(created[0]);
    expect(img1.getAttribute('src')).toBe(created[1]);
    expect(img0.getAttribute('src')).not.toBe('blob:stale');
  });

  it('revokes every object URL it created on unmount', () => {
    const { unmount } = renderWithProviders(<SourcePhotos photos={[makePhoto('a'), makePhoto('b')]} />);
    expect(created).toHaveLength(2);
    expect(revoked).toHaveLength(0);
    unmount();
    expect([...revoked].sort()).toEqual([...created].sort());
  });

  it('opens a fullscreen viewer on the tapped photo and pages through all photos', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SourcePhotos photos={[makePhoto('a'), makePhoto('b'), makePhoto('c')]} />);

    await user.click(screen.getByTestId('source-photo-1'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /nächstes foto/i }));
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nächstes foto/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /vorheriges foto/i }));
    await user.click(screen.getByRole('button', { name: /vorheriges foto/i }));
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vorheriges foto/i })).toBeDisabled();
  });

  it('keeps the opened viewer image on a live (non-revoked) URL under StrictMode double-mount', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <StrictMode>
        <SourcePhotos photos={[makePhoto('a')]} />
      </StrictMode>,
    );

    await user.click(screen.getByTestId('source-photo-0'));
    const img = screen.getByRole('dialog').querySelector('img') as HTMLImageElement;
    const src = img.getAttribute('src');

    expect(src).toBeTruthy();
    expect(revoked).not.toContain(src);
  });

  it('closes the viewer via the close button and via Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SourcePhotos photos={[makePhoto('a')]} />);

    await user.click(screen.getByTestId('source-photo-0'));
    await user.click(screen.getByRole('button', { name: /fotoansicht schließen/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('source-photo-0'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
