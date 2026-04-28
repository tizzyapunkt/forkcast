import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';

export interface BarcodeScannerProps {
  onDetect: (barcode: string) => void;
  onCancel: () => void;
}

export function BarcodeScanner({ onDetect, onCancel }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    let controls: IScannerControls | null = null;
    let done = false;

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current!,
        (result, err, ctrl) => {
          controls = ctrl;
          if (done) return;
          if (result) {
            done = true;
            ctrl.stop();
            onDetectRef.current(result.getText());
            return;
          }
          if (err && !(err instanceof NotFoundException)) {
            done = true;
            ctrl.stop();
            setError(err.message);
          }
        },
      )
      .catch((e: Error) => setError(e.message));

    return () => {
      done = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4">
      {error ? (
        <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.toLowerCase().includes('notallowed') || error.toLowerCase().includes('permission')
            ? 'Camera access was denied. Please allow camera access in your browser settings.'
            : 'Unable to access camera.'}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/3]">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/70 animate-pulse" />
        </div>
      )}
      <button type="button" onClick={onCancel} className="w-full rounded-md border px-3 py-2 text-sm">
        Cancel
      </button>
    </div>
  );
}
