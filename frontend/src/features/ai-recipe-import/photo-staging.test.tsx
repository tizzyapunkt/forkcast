import { useState } from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/harness';
import { PhotoStaging, type StagedPhoto } from './photo-staging';

let revoked: string[] = [];
let nextUrl = 0;

beforeEach(() => {
  revoked = [];
  nextUrl = 0;
  Object.defineProperty(URL, 'createObjectURL', { value: () => `blob:mock-${nextUrl++}`, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: (url: string) => revoked.push(url), writable: true });
});

function makeFile(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function Harness({
  maxImages = 4,
  maxImageBytes = 1024,
  maxTotalBytes = 1024 * 1024,
}: {
  maxImages?: number;
  maxImageBytes?: number;
  maxTotalBytes?: number;
}) {
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  return (
    <PhotoStaging
      photos={photos}
      onChange={setPhotos}
      maxImages={maxImages}
      maxImageBytes={maxImageBytes}
      maxTotalBytes={maxTotalBytes}
    />
  );
}

function pick(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

describe('PhotoStaging', () => {
  it('accepts valid images and shows them in pick order', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('a.jpg', 'image/jpeg', 100), makeFile('b.png', 'image/png', 200)]);

    expect(await screen.findByTestId('staged-photo-0')).toBeInTheDocument();
    expect(screen.getByTestId('staged-photo-1')).toBeInTheDocument();
  });

  it('rejects an image that exceeds the per-image size limit', async () => {
    renderWithProviders(<Harness maxImageBytes={100} />);

    pick([makeFile('big.jpg', 'image/jpeg', 500)]);

    expect(await screen.findByText(/überschreitet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('staged-photo-0')).not.toBeInTheDocument();
  });

  it('rejects unsupported media types', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('a.gif', 'image/gif', 100)]);

    expect(await screen.findByText(/image\/gif/i)).toBeInTheDocument();
    expect(screen.queryByTestId('staged-photo-0')).not.toBeInTheDocument();
  });

  it('names an unknown file type instead of showing an empty one', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('scan', '', 100)]);

    expect(await screen.findByText(/unknown/i)).toBeInTheDocument();
  });

  it('caps the number of accepted images at maxImages', async () => {
    renderWithProviders(<Harness maxImages={2} />);

    pick([
      makeFile('a.jpg', 'image/jpeg', 50),
      makeFile('b.jpg', 'image/jpeg', 50),
      makeFile('c.jpg', 'image/jpeg', 50),
    ]);

    expect(await screen.findByText(/maximal 2 fotos/i)).toBeInTheDocument();
    expect(screen.getByTestId('staged-photo-0')).toBeInTheDocument();
    expect(screen.getByTestId('staged-photo-1')).toBeInTheDocument();
    expect(screen.queryByTestId('staged-photo-2')).not.toBeInTheDocument();
  });

  it('stops accepting photos once the combined size limit is reached', async () => {
    renderWithProviders(<Harness maxImageBytes={1000} maxTotalBytes={1500} />);

    pick([makeFile('a.jpg', 'image/jpeg', 900), makeFile('b.jpg', 'image/jpeg', 900)]);

    expect(await screen.findByText(/zusammen/i)).toBeInTheDocument();
    expect(screen.getByTestId('staged-photo-0')).toBeInTheDocument();
    expect(screen.queryByTestId('staged-photo-1')).not.toBeInTheDocument();
  });

  it('counts already staged photos against the combined limit', async () => {
    renderWithProviders(<Harness maxImageBytes={1000} maxTotalBytes={1500} />);

    pick([makeFile('a.jpg', 'image/jpeg', 900)]);
    await screen.findByTestId('staged-photo-0');

    pick([makeFile('b.jpg', 'image/jpeg', 900)]);

    expect(await screen.findByText(/zusammen/i)).toBeInTheDocument();
    expect(screen.queryByTestId('staged-photo-1')).not.toBeInTheDocument();
  });

  it('keeps earlier previews alive when a second batch is added', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('a.jpg', 'image/jpeg', 50)]);
    const first = (await screen.findByAltText('Foto 1')) as HTMLImageElement;
    const firstUrl = first.src;

    pick([makeFile('b.jpg', 'image/jpeg', 50)]);
    await screen.findByTestId('staged-photo-1');

    expect(revoked).not.toContain(firstUrl);
    expect((screen.getByAltText('Foto 1') as HTMLImageElement).src).toBe(firstUrl);
  });

  it('keeps previews alive across a reorder', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('a.jpg', 'image/jpeg', 50), makeFile('b.jpg', 'image/jpeg', 50)]);
    await screen.findByTestId('staged-photo-1');
    const urls = screen.getAllByRole('img').map((img) => (img as HTMLImageElement).src);

    await userEvent.click(screen.getByLabelText('Foto 2 nach oben'));

    expect(revoked).toHaveLength(0);
    expect(screen.getAllByRole('img').map((img) => (img as HTMLImageElement).src)).toEqual([urls[1], urls[0]]);
  });

  it('releases only the removed photo’s preview', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('a.jpg', 'image/jpeg', 50), makeFile('b.jpg', 'image/jpeg', 50)]);
    await screen.findByTestId('staged-photo-1');
    const [firstUrl, secondUrl] = screen.getAllByRole('img').map((img) => (img as HTMLImageElement).src);

    await userEvent.click(screen.getByLabelText('Foto 1 entfernen'));

    expect(revoked).toEqual([firstUrl]);
    expect(screen.getByAltText('Foto 1')).toHaveAttribute('src', secondUrl);
  });

  it('reorders images via the move-up control', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('a.jpg', 'image/jpeg', 50), makeFile('b.jpg', 'image/jpeg', 50)]);
    await screen.findByTestId('staged-photo-1');

    await userEvent.click(screen.getByLabelText('Foto 2 nach oben'));

    expect(screen.getAllByTestId(/staged-photo-/)).toHaveLength(2);
    expect(screen.getByLabelText('Foto 1 nach oben')).toBeDisabled();
  });

  it('announces rejections as an alert the user can dismiss', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('a.gif', 'image/gif', 50)]);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/hinweise ausblenden/i));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('falls back to a placeholder when a preview cannot be rendered', async () => {
    renderWithProviders(<Harness />);

    pick([makeFile('a.jpg', 'image/jpeg', 50)]);
    fireEvent.error(await screen.findByAltText('Foto 1'));

    expect(await screen.findByText(/vorschau nicht verfügbar/i)).toBeInTheDocument();
    expect(screen.queryByAltText('Foto 1')).not.toBeInTheDocument();
  });

  it('revokes every preview when the staging step unmounts', async () => {
    const { unmount } = renderWithProviders(<Harness />);

    pick([makeFile('a.jpg', 'image/jpeg', 50), makeFile('b.jpg', 'image/jpeg', 50)]);
    await screen.findByTestId('staged-photo-1');
    const urls = screen.getAllByRole('img').map((img) => (img as HTMLImageElement).src);

    unmount();

    await waitFor(() => expect(revoked.sort()).toEqual([...urls].sort()));
  });
});
