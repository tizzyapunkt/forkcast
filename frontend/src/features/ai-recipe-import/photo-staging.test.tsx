import { useState } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/harness';
import { PhotoStaging, type StagedPhoto } from './photo-staging';

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, writable: true });
});

function makeFile(name: string, type: string, size: number): File {
  const file = new File([new Uint8Array(size)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function Harness({ maxImages = 4, maxImageBytes = 1024 }: { maxImages?: number; maxImageBytes?: number }) {
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  return <PhotoStaging photos={photos} onChange={setPhotos} maxImages={maxImages} maxImageBytes={maxImageBytes} />;
}

describe('PhotoStaging', () => {
  it('accepts valid images and shows them in pick order', () => {
    renderWithProviders(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const f1 = makeFile('a.jpg', 'image/jpeg', 100);
    const f2 = makeFile('b.png', 'image/png', 200);
    fireEvent.change(input, { target: { files: [f1, f2] } });

    expect(screen.getByTestId('staged-photo-0')).toBeInTheDocument();
    expect(screen.getByTestId('staged-photo-1')).toBeInTheDocument();
  });

  it('rejects an image that exceeds the per-image size limit', () => {
    renderWithProviders(<Harness maxImageBytes={100} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const big = makeFile('big.jpg', 'image/jpeg', 500);
    fireEvent.change(input, { target: { files: [big] } });

    expect(screen.queryByTestId('staged-photo-0')).not.toBeInTheDocument();
    expect(screen.getByText(/überschreitet/i)).toBeInTheDocument();
  });

  it('rejects unsupported media types', () => {
    renderWithProviders(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const gif = makeFile('a.gif', 'image/gif', 100);
    fireEvent.change(input, { target: { files: [gif] } });

    expect(screen.queryByTestId('staged-photo-0')).not.toBeInTheDocument();
    expect(screen.getByText(/image\/gif/i)).toBeInTheDocument();
  });

  it('caps the number of accepted images at maxImages', () => {
    renderWithProviders(<Harness maxImages={2} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      makeFile('a.jpg', 'image/jpeg', 50),
      makeFile('b.jpg', 'image/jpeg', 50),
      makeFile('c.jpg', 'image/jpeg', 50),
    ];
    fireEvent.change(input, { target: { files } });

    expect(screen.getByTestId('staged-photo-0')).toBeInTheDocument();
    expect(screen.getByTestId('staged-photo-1')).toBeInTheDocument();
    expect(screen.queryByTestId('staged-photo-2')).not.toBeInTheDocument();
    expect(screen.getByText(/maximal 2 fotos/i)).toBeInTheDocument();
  });

  it('removes an image when the remove control is activated', () => {
    renderWithProviders(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.jpg', 'image/jpeg', 50), makeFile('b.jpg', 'image/jpeg', 50)] },
    });

    fireEvent.click(screen.getByLabelText('Foto 1 entfernen'));
    expect(screen.queryByTestId('staged-photo-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('staged-photo-0')).toBeInTheDocument();
  });

  it('reorders images via the move-up control', () => {
    renderWithProviders(<Harness />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [makeFile('a.jpg', 'image/jpeg', 50), makeFile('b.jpg', 'image/jpeg', 50)],
      },
    });

    expect(screen.getAllByTestId(/staged-photo-/)).toHaveLength(2);

    const moveUp2 = screen.getByLabelText('Foto 2 nach oben');
    fireEvent.click(moveUp2);

    expect(screen.getAllByTestId(/staged-photo-/)).toHaveLength(2);
    expect(screen.queryByLabelText('Foto 1 nach oben')).toBeDisabled();
  });
});
