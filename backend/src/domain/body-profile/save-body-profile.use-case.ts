import type { BodyProfileRepository } from './body-profile.repository.ts';
import { validateBodyProfile } from './validate-body-profile.ts';
import { computeMacros } from './compute-macros.ts';
import type { BodyProfile } from './types.ts';
import type { BodyProfileWithComputed } from './get-body-profile.use-case.ts';

export async function saveBodyProfile(
  repo: BodyProfileRepository,
  profile: BodyProfile,
): Promise<BodyProfileWithComputed> {
  const validated = validateBodyProfile(profile);
  await repo.save(validated);
  return { profile: validated, computed: computeMacros(validated) };
}
