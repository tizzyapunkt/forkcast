import type { BodyProfile } from './types.ts';

export interface BodyProfileRepository {
  get(): Promise<BodyProfile | null>;
  save(profile: BodyProfile): Promise<void>;
}
