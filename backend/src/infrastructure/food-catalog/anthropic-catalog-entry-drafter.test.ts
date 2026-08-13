import { describe, it, expect, vi } from 'vitest';
import {
  AnthropicCatalogEntryDrafter,
  DRAFT_FOOD_ENTRY_TOOL_NAME,
  type AnthropicLikeClient,
} from './anthropic-catalog-entry-drafter.ts';
import { CatalogDraftError } from '../../domain/food-catalog/catalog-entry-drafter.ts';

type CreateFn = AnthropicLikeClient['messages']['create'];

function clientDrafting(input: unknown): AnthropicLikeClient {
  return {
    messages: {
      create: vi.fn<CreateFn>().mockResolvedValue({
        content: [{ type: 'tool_use', name: DRAFT_FOOD_ENTRY_TOOL_NAME, input }],
        usage: { input_tokens: 10, output_tokens: 20 },
      } as Awaited<ReturnType<CreateFn>>),
    },
  };
}

function drafter(input: unknown) {
  return new AnthropicCatalogEntryDrafter({ client: clientDrafting(input), model: 'm' });
}

const zitronensaft = {
  name: 'Zitronensaft',
  synonyms: ['Lemon juice'],
  unit: 'ml',
  macrosPer100: { calories: 22, protein: 0.35, carbs: 6.9, fat: 0.24 },
};

describe('AnthropicCatalogEntryDrafter', () => {
  it('drafts an entry keyed by a slug of its canonical name', async () => {
    const entry = await drafter(zitronensaft).draft('Zitronensaft');
    expect(entry).toMatchObject({ id: 'zitronensaft', name: 'Zitronensaft', unit: 'ml', synonyms: ['Lemon juice'] });
  });

  it('defaults a missing synonyms list to an empty array', async () => {
    const { synonyms: _dropped, ...withoutSynonyms } = zitronensaft;
    const entry = await drafter(withoutSynonyms).draft('Zitronensaft');
    expect(entry.synonyms).toEqual([]);
  });

  it('drops a synonym that only repeats the canonical name', async () => {
    const entry = await drafter({
      ...zitronensaft,
      synonyms: ['zitronensaft', 'Lemon juice', 'Lemon juice'],
    }).draft('Zitronensaft');
    expect(entry.synonyms).toEqual(['Lemon juice']);
  });

  it('zeroes the macros of an untracked entry instead of rejecting it', async () => {
    const entry = await drafter({
      name: 'Sumach',
      synonyms: [],
      unit: 'g',
      untracked: true,
      macrosPer100: { calories: 300, protein: 4, carbs: 60, fat: 5 },
    }).draft('Sumach');
    expect(entry.macrosPer100).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('rejects an entry the editor could not render, rather than passing it on', async () => {
    const { macrosPer100: _dropped, ...withoutMacros } = zitronensaft;
    await expect(drafter(withoutMacros).draft('Zitronensaft')).rejects.toThrow(/macrosPer100 missing/);
    await expect(drafter({ ...zitronensaft, unit: 'Stück' }).draft('Zitronensaft')).rejects.toThrow(CatalogDraftError);
  });

  it('rejects a response with no drafted name', async () => {
    await expect(drafter({ ...zitronensaft, name: '  ' }).draft('Zitronensaft')).rejects.toThrow(
      /drafted entry has no name/,
    );
  });
});
