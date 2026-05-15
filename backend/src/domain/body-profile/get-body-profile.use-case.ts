import type { BodyProfileRepository } from './body-profile.repository.ts';
import { computeMacros } from './compute-macros.ts';
import type { BodyProfile, ComputedMacros } from './types.ts';

export interface BodyProfileWithComputed {
  profile: BodyProfile;
  computed: ComputedMacros;
}

export async function getBodyProfile(repo: BodyProfileRepository): Promise<BodyProfileWithComputed | null> {
  const profile = await repo.get();
  if (!profile) return null;
  return { profile, computed: computeMacros(profile) };
}
