import { describe, it, expect, vi } from 'vitest';
import { AnthropicRecipeDraftExtractor, type AnthropicLikeClient } from './anthropic-recipe-draft-extractor.ts';
import { EXTRACT_RECIPE_TOOL_NAME } from './extract-recipe-tool.ts';
import { RecipeDraftExtractionError } from '../../domain/ai-recipe-import/recipe-draft-extractor.ts';
import type { RecipeImage } from '../../domain/ai-recipe-import/types.ts';

function makeClient(response: unknown, error?: unknown): AnthropicLikeClient {
  return {
    messages: {
      create: vi.fn<AnthropicLikeClient['messages']['create']>(async () => {
        if (error) throw error;
        return response as Awaited<ReturnType<AnthropicLikeClient['messages']['create']>>;
      }),
    },
  };
}

const silentLogger = { info: vi.fn<(...args: unknown[]) => void>(), warn: vi.fn<(...args: unknown[]) => void>() };

const sampleResponse = {
  content: [
    {
      type: 'tool_use',
      id: 'toolu_1',
      name: EXTRACT_RECIPE_TOOL_NAME,
      input: {
        name: 'Pasta',
        yield: 2,
        ingredients: [{ name: 'olive oil', amount: 30, unit: 'ml' }, { name: 'salt' }],
        steps: ['Boil water', 'Cook pasta'],
      },
    },
  ],
  usage: { input_tokens: 100, output_tokens: 50 },
};

describe('AnthropicRecipeDraftExtractor', () => {
  it('sends images in order with the forced extract_recipe tool', async () => {
    const client = makeClient(sampleResponse);
    const extractor = new AnthropicRecipeDraftExtractor({
      client,
      model: 'claude-test-model',
      logger: silentLogger,
    });

    const images: RecipeImage[] = [
      { mediaType: 'image/jpeg', bytes: new Uint8Array([0xff, 0xd8]) },
      { mediaType: 'image/png', bytes: new Uint8Array([0x89, 0x50]) },
      { mediaType: 'image/webp', bytes: new Uint8Array([0x52, 0x49]) },
    ];

    await extractor.extract(images);

    expect(client.messages.create).toHaveBeenCalledTimes(1);
    const params = (client.messages.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(params.model).toBe('claude-test-model');
    expect(params.tool_choice).toEqual({ type: 'tool', name: EXTRACT_RECIPE_TOOL_NAME });
    expect(params.tools[0].name).toBe(EXTRACT_RECIPE_TOOL_NAME);

    const userContent = params.messages[0].content;
    const imageBlocks = userContent.filter((c: { type: string }) => c.type === 'image');
    expect(imageBlocks).toHaveLength(3);
    expect(imageBlocks.map((b: { source: { media_type: string } }) => b.source.media_type)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(imageBlocks[0].source).toEqual({
      type: 'base64',
      media_type: 'image/jpeg',
      data: Buffer.from(new Uint8Array([0xff, 0xd8])).toString('base64'),
    });
    expect(userContent.at(-1).type).toBe('text');
  });

  it('parses a synthetic tool_use response into an ExtractedDraft', async () => {
    const client = makeClient(sampleResponse);
    const extractor = new AnthropicRecipeDraftExtractor({
      client,
      model: 'claude-test-model',
      logger: silentLogger,
    });

    const draft = await extractor.extract([{ mediaType: 'image/jpeg', bytes: new Uint8Array([1]) }]);

    expect(draft.name).toBe('Pasta');
    expect(draft.yield).toBe(2);
    expect(draft.ingredients).toEqual([{ name: 'olive oil', amount: 30, unit: 'ml' }, { name: 'salt' }]);
    expect(draft.steps).toEqual(['Boil water', 'Cook pasta']);
  });

  it('logs model, image count, token usage, and duration on success', async () => {
    const client = makeClient(sampleResponse);
    const logger = { info: vi.fn<(...args: unknown[]) => void>(), warn: vi.fn<(...args: unknown[]) => void>() };
    const extractor = new AnthropicRecipeDraftExtractor({
      client,
      model: 'claude-test-model',
      logger,
    });

    await extractor.extract([
      { mediaType: 'image/jpeg', bytes: new Uint8Array([1]) },
      { mediaType: 'image/png', bytes: new Uint8Array([2]) },
    ]);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const logged = JSON.parse((logger.info as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string);
    expect(logged.event).toBe('ai-recipe-import.extract');
    expect(logged.model).toBe('claude-test-model');
    expect(logged.imageCount).toBe(2);
    expect(logged.inputTokens).toBe(100);
    expect(logged.outputTokens).toBe(50);
    expect(typeof logged.durationMs).toBe('number');

    const stringified = JSON.stringify(logged);
    expect(stringified).not.toContain('Pasta');
    expect(stringified).not.toContain('olive oil');
  });

  it('throws RecipeDraftExtractionError when the SDK call fails', async () => {
    const client = makeClient(undefined, new Error('boom'));
    const extractor = new AnthropicRecipeDraftExtractor({
      client,
      model: 'claude-test-model',
      logger: silentLogger,
    });

    await expect(extractor.extract([{ mediaType: 'image/jpeg', bytes: new Uint8Array([1]) }])).rejects.toBeInstanceOf(
      RecipeDraftExtractionError,
    );
  });

  it('throws RecipeDraftExtractionError when no tool_use block is returned', async () => {
    const client = makeClient({
      content: [{ type: 'text', text: 'hello' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const extractor = new AnthropicRecipeDraftExtractor({
      client,
      model: 'claude-test-model',
      logger: silentLogger,
    });

    await expect(extractor.extract([{ mediaType: 'image/jpeg', bytes: new Uint8Array([1]) }])).rejects.toBeInstanceOf(
      RecipeDraftExtractionError,
    );
  });

  it('throws RecipeDraftExtractionError on malformed tool input (missing required fields)', async () => {
    const client = makeClient({
      content: [{ type: 'tool_use', id: 't1', name: EXTRACT_RECIPE_TOOL_NAME, input: { name: 'X' } }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const extractor = new AnthropicRecipeDraftExtractor({
      client,
      model: 'claude-test-model',
      logger: silentLogger,
    });

    await expect(extractor.extract([{ mediaType: 'image/jpeg', bytes: new Uint8Array([1]) }])).rejects.toBeInstanceOf(
      RecipeDraftExtractionError,
    );
  });

  it('throws when called with no images', async () => {
    const client = makeClient(sampleResponse);
    const extractor = new AnthropicRecipeDraftExtractor({
      client,
      model: 'claude-test-model',
      logger: silentLogger,
    });

    await expect(extractor.extract([])).rejects.toBeInstanceOf(RecipeDraftExtractionError);
    expect(client.messages.create).not.toHaveBeenCalled();
  });
});
