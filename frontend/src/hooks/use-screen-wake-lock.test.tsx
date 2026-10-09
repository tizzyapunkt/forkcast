import { act, render, screen, waitFor } from '@testing-library/react';
import { useScreenWakeLock } from './use-screen-wake-lock';

class FakeSentinel extends EventTarget {
  released = false;
  readonly type = 'screen' as const;
  onrelease = null;
  async release() {
    if (this.released) return;
    this.released = true;
    this.dispatchEvent(new Event('release'));
  }
}

function stubWakeLock() {
  const sentinels: FakeSentinel[] = [];
  const request = vi.fn<() => Promise<FakeSentinel>>(async () => {
    const s = new FakeSentinel();
    sentinels.push(s);
    return s;
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, sentinels };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

function Probe({ active = true }: { active?: boolean }) {
  const held = useScreenWakeLock(active);
  return <p>{held ? 'held' : 'free'}</p>;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('useScreenWakeLock', () => {
  it('holds a screen lock while active', async () => {
    const { request } = stubWakeLock();

    render(<Probe />);

    expect(await screen.findByText('held')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('requests the lock again when the page becomes visible after the browser dropped it', async () => {
    const { request, sentinels } = stubWakeLock();
    render(<Probe />);
    await screen.findByText('held');

    await act(async () => {
      setVisibility('hidden');
      await sentinels[0]!.release();
    });
    expect(screen.getByText('free')).toBeInTheDocument();

    await act(async () => setVisibility('visible'));

    expect(await screen.findByText('held')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('releases the lock when the view goes away', async () => {
    const { sentinels } = stubWakeLock();
    const { unmount } = render(<Probe />);
    await screen.findByText('held');

    unmount();

    await waitFor(() => expect(sentinels[0]!.released).toBe(true));
  });

  it('stays free without browser support', () => {
    render(<Probe />);
    expect(screen.getByText('free')).toBeInTheDocument();
  });

  it('stays free when the browser refuses', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: vi.fn<() => Promise<never>>().mockRejectedValue(new Error('NotAllowedError')) },
      configurable: true,
    });

    render(<Probe />);

    await waitFor(() => expect(screen.getByText('free')).toBeInTheDocument());
  });
});
