import { describe, it, expect, vi } from 'vitest';
import { AnthropicFoodResolutionProposer, type AnthropicLikeClient } from './anthropic-food-resolution-proposer.ts';
import { FoodResolutionError, type ResolutionRequest } from '../../domain/food-resolution/types.ts';

const SILENT = { info: () => {}, warn: () => {} };

type CreateFn = AnthropicLikeClient['messages']['create'];

function clientReturning(proposals: unknown): AnthropicLikeClient {
  return {
    messages: {
      create: vi.fn<CreateFn>().mockResolvedValue({
        content: [{ type: 'tool_use', name: 'propose_resolutions', input: { proposals } }],
        usage: { input_tokens: 10, output_tokens: 20 },
      } as Awaited<ReturnType<CreateFn>>),
    },
  };
}

const req = (name: string, candidates: ResolutionRequest['candidates'] = [], note?: string): ResolutionRequest => ({
  item: { name, note },
  candidates,
});

describe('AnthropicFoodResolutionProposer', () => {
  it('returns [] without calling the model for an empty request list', async () => {
    const client = clientReturning([]);
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });
    expect(await proposer.propose([])).toEqual([]);
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  it('maps synonym-of, new-food, and skip verdicts in request order by index', async () => {
    const client = clientReturning([
      { index: 0, verdict: 'synonym-of', foodId: 'oliven', synonym: 'grüne Oliven', confidence: 'high' },
      {
        index: 1,
        verdict: 'new-food',
        confidence: 'medium',
        entry: {
          id: 'kirschtomaten',
          name: 'Kirschtomaten',
          synonyms: [],
          unit: 'g',
          macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
        },
      },
      { index: 2, verdict: 'skip', confidence: 'low', reason: 'garbled' },
    ]);
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });

    const out = await proposer.propose([req('grüne Oliven'), req('Kirschtomaten'), req('xyz')]);
    expect(out[0]).toEqual({ verdict: 'synonym-of', foodId: 'oliven', synonym: 'grüne Oliven', confidence: 'high' });
    expect(out[1]).toMatchObject({ verdict: 'new-food', confidence: 'medium' });
    expect(out[2]).toEqual({ verdict: 'skip', reason: 'garbled' });
  });

  it('realigns out-of-order proposals by their index', async () => {
    const client = clientReturning([
      { index: 1, verdict: 'skip', confidence: 'low', reason: 'b' },
      { index: 0, verdict: 'skip', confidence: 'low', reason: 'a' },
    ]);
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });
    const out = await proposer.propose([req('a'), req('b')]);
    expect(out).toEqual([
      { verdict: 'skip', reason: 'a' },
      { verdict: 'skip', reason: 'b' },
    ]);
  });

  it('degrades a missing item to skip', async () => {
    const client = clientReturning([{ index: 0, verdict: 'skip', confidence: 'low', reason: 'a' }]);
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });
    const out = await proposer.propose([req('a'), req('b')]);
    expect(out[1]).toMatchObject({ verdict: 'skip' });
  });

  it('coerces an unknown confidence to low', async () => {
    const client = clientReturning([{ index: 0, verdict: 'skip', confidence: 'banana', reason: 'x' }]);
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });
    const out = await proposer.propose([req('a')]);
    expect(out[0]).toEqual({ verdict: 'skip', reason: 'x' });
  });

  it('drops a synonym-of proposal missing foodId (item degrades to skip)', async () => {
    const client = clientReturning([{ index: 0, verdict: 'synonym-of', synonym: 'x', confidence: 'high' }]);
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });
    const out = await proposer.propose([req('a')]);
    expect(out[0]).toMatchObject({ verdict: 'skip' });
  });

  it('throws FoodResolutionError when the provider call fails', async () => {
    const client: AnthropicLikeClient = {
      messages: { create: vi.fn<CreateFn>().mockRejectedValue(new Error('503 overloaded')) },
    };
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });
    await expect(proposer.propose([req('a')])).rejects.toBeInstanceOf(FoodResolutionError);
  });

  it('throws FoodResolutionError when no tool_use block is present', async () => {
    const client: AnthropicLikeClient = {
      messages: {
        create: vi
          .fn<CreateFn>()
          .mockResolvedValue({ content: [{ type: 'text', text: 'nope' }], usage: {} } as Awaited<ReturnType<CreateFn>>),
      },
    };
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });
    await expect(proposer.propose([req('a')])).rejects.toBeInstanceOf(FoodResolutionError);
  });

  it('passes each item name, note, and candidates into the prompt', async () => {
    const client = clientReturning([{ index: 0, verdict: 'skip', confidence: 'low', reason: 'x' }]);
    const proposer = new AnthropicFoodResolutionProposer({ client, model: 'm', logger: SILENT });
    await proposer.propose([
      req(
        'Tomaten',
        [
          {
            id: 'tomate',
            name: 'Tomate',
            unit: 'g',
            macrosPer100: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
          },
        ],
        'getrocknet in Öl',
      ),
    ]);
    const params = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      messages: { content: string }[];
    };
    const content = params.messages[0]!.content;
    expect(content).toContain('Tomaten');
    expect(content).toContain('getrocknet in Öl');
    expect(content).toContain('tomate');
  });
});
