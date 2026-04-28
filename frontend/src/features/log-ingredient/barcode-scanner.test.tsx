import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { renderWithProviders } from '../../test/harness';
import { BarcodeScanner } from './barcode-scanner';

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn<(...args: unknown[]) => { decodeFromConstraints: unknown }>(),
}));

type DecodeCallback = (result: { getText: () => string } | null, err: Error | null, controls: IScannerControls) => void;

function makeMockReader() {
  const stop = vi.fn<() => void>();
  let capturedCallback: DecodeCallback | null = null;

  const decodeFromConstraints = vi.fn<
    (_constraints: unknown, _video: unknown, cb: DecodeCallback) => Promise<{ stop: typeof stop }>
  >((_constraints, _video, cb) => {
    capturedCallback = cb;
    return Promise.resolve({ stop });
  });

  const reader = { decodeFromConstraints };
  vi.mocked(BrowserMultiFormatReader).mockImplementation(() => reader as never);

  function fireDetect(barcode: string) {
    act(() => capturedCallback?.({ getText: () => barcode }, null, { stop }));
  }

  function fireError(err: Error) {
    act(() => capturedCallback?.(null, err, { stop }));
  }

  return { stop, decodeFromConstraints, fireDetect, fireError };
}

describe('BarcodeScanner', () => {
  it('renders a video element and a cancel button', () => {
    makeMockReader();
    renderWithProviders(<BarcodeScanner onDetect={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(document.querySelector('video')).toBeInTheDocument();
  });

  it('calls decodeFromConstraints on mount preferring the rear camera', async () => {
    const { decodeFromConstraints } = makeMockReader();
    renderWithProviders(<BarcodeScanner onDetect={() => {}} onCancel={() => {}} />);
    await act(async () => {});
    const [constraints] = decodeFromConstraints.mock.calls[0] as unknown as [
      { video: { facingMode: { ideal: string } } },
    ];
    expect(constraints.video.facingMode.ideal).toBe('environment');
  });

  it('calls onDetect with the barcode and stops scanning when a code is found', async () => {
    const { fireDetect, stop } = makeMockReader();
    const onDetect = vi.fn<(barcode: string) => void>();
    renderWithProviders(<BarcodeScanner onDetect={onDetect} onCancel={() => {}} />);
    await act(async () => {});
    fireDetect('4006381333931');
    expect(onDetect).toHaveBeenCalledWith('4006381333931');
    expect(stop).toHaveBeenCalled();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    makeMockReader();
    const onCancel = vi.fn<() => void>();
    renderWithProviders(<BarcodeScanner onDetect={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows a camera-access-denied message when decodeFromConstraints rejects', async () => {
    const reader = {
      decodeFromConstraints: vi
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockRejectedValue(new Error('NotAllowedError')),
    };
    vi.mocked(BrowserMultiFormatReader).mockImplementation(() => reader as never);
    renderWithProviders(<BarcodeScanner onDetect={() => {}} onCancel={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/camera access/i);
  });

  it('shows an error when the callback receives a non-NotFoundException error', async () => {
    const { fireError } = makeMockReader();
    renderWithProviders(<BarcodeScanner onDetect={() => {}} onCancel={() => {}} />);
    await act(async () => {});
    fireError(new Error('DeviceBusyError'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('does not show an error when the callback receives a NotFoundException', async () => {
    const { fireError } = makeMockReader();
    renderWithProviders(<BarcodeScanner onDetect={() => {}} onCancel={() => {}} />);
    await act(async () => {});
    fireError(new NotFoundException());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
