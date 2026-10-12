import { describe, it, expect } from 'vite-plus/test';
import { bootstrap, type Initializable } from './bootstrap.ts';

function countingPart(): Initializable & { calls: number } {
  return {
    calls: 0,
    async init() {
      this.calls++;
    },
  };
}

describe('bootstrap', () => {
  it('initialises every part', async () => {
    const a = countingPart();
    const b = countingPart();

    await bootstrap([a, b]);

    expect(a.calls).toBe(1);
    expect(b.calls).toBe(1);
  });

  it('fails when a part fails to initialise', async () => {
    const failing: Initializable = {
      async init() {
        throw new Error('catalog: cannot seed an empty catalog');
      },
    };

    await expect(bootstrap([countingPart(), failing])).rejects.toThrow('cannot seed an empty catalog');
  });
});
