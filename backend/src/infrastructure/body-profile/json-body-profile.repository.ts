import type { BodyProfile } from '../../domain/body-profile/types.ts';
import type { BodyProfileRepository } from '../../domain/body-profile/body-profile.repository.ts';
import type { JsonDocument } from '../json-document/json-document.ts';

export class JsonBodyProfileRepository implements BodyProfileRepository {
  constructor(private readonly document: JsonDocument) {}

  async save(profile: BodyProfile): Promise<void> {
    await this.document.write(JSON.stringify(profile, null, 2));
  }

  async get(): Promise<BodyProfile | null> {
    const raw = await this.document.read();
    if (raw === null) return null;
    return JSON.parse(raw) as BodyProfile;
  }
}
