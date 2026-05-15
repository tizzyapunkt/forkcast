import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BodyProfile } from '../../domain/body-profile/types.ts';
import type { BodyProfileRepository } from '../../domain/body-profile/body-profile.repository.ts';

export class JsonBodyProfileRepository implements BodyProfileRepository {
  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async save(profile: BodyProfile): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(profile, null, 2), 'utf-8');
  }

  async get(): Promise<BodyProfile | null> {
    if (!existsSync(this.filePath)) return null;
    const raw = await readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as BodyProfile;
  }
}
