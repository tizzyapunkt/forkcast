import { describe, it, expect, vi } from 'vitest';
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { AnthropicProductDraftExtractor } from './anthropic-product-draft-extractor.ts';
import { EXTRACT_PRODUCT_TOOL_NAME } from './extract-product-tool.ts';
import { ProductDraftExtractionError } from '../../domain/barcode-product-capture/product-draft-extractor.ts';
import type { AnthropicLikeClient } from '../ai-recipe-import/anthropic-recipe-draft-extractor.ts';
import type { ProductImage } from '../../domain/barcode-product-capture/types.ts';

type CreateFn = (params: MessageCreateParamsNonStreaming) => Promise<Message>;
type LogFn = (...args: unknown[]) => void;

const image: ProductImage = { mediaType: 'image/jpeg', bytes: new Uint8Array([1, 2, 3]) };

function makeLogger() {
  return { info: vi.fn<LogFn>(), warn: vi.fn<LogFn>() };
}

function clientReturning(content: unknown[]): {
  client: AnthropicLikeClient;
  create: ReturnType<typeof vi.fn<CreateFn>>;
} {
  const create = vi.fn<CreateFn>().mockResolvedValue({
    content,
    usage: { input_tokens: 42, output_tokens: 7 },
  } as unknown as Message);
  return { client: { messages: { create } }, create };
}

const validToolBlock = {
  type: 'tool_use',
  name: EXTRACT_PRODUCT_TOOL_NAME,
  input: { name: 'Himbeer-Heidelbeer-Mix', unit: 'g', calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
};

describe('AnthropicProductDraftExtractor', () => {
  it('forces the extract_product tool and returns the parsed product', async () => {
    const { client, create } = clientReturning([validToolBlock]);
    const extractor = new AnthropicProductDraftExtractor({ client, model: 'test-model', logger: makeLogger() });

    const product = await extractor.extract([image]);

    expect(product).toEqual({
      name: 'Himbeer-Heidelbeer-Mix',
      unit: 'g',
      macrosPer100: { calories: 54, protein: 0.9, carbs: 8.4, fat: 0.7 },
    });
    const params = create.mock.calls[0]![0];
    expect(params.tool_choice).toEqual({ type: 'tool', name: EXTRACT_PRODUCT_TOOL_NAME });
    expect(params.model).toBe('test-model');
  });

  it('rejects an empty image list', async () => {
    const { client } = clientReturning([validToolBlock]);
    const extractor = new AnthropicProductDraftExtractor({ client, model: 'm', logger: makeLogger() });
    await expect(extractor.extract([])).rejects.toBeInstanceOf(ProductDraftExtractionError);
  });

  it('wraps an API failure in ProductDraftExtractionError', async () => {
    const create = vi.fn<CreateFn>().mockRejectedValue(new Error('boom'));
    const extractor = new AnthropicProductDraftExtractor({
      client: { messages: { create } },
      model: 'm',
      logger: makeLogger(),
    });
    await expect(extractor.extract([image])).rejects.toBeInstanceOf(ProductDraftExtractionError);
  });

  it('throws when the model returns no extract_product tool_use block', async () => {
    const { client } = clientReturning([{ type: 'text', text: 'no tool here' }]);
    const extractor = new AnthropicProductDraftExtractor({ client, model: 'm', logger: makeLogger() });
    await expect(extractor.extract([image])).rejects.toBeInstanceOf(ProductDraftExtractionError);
  });

  it('throws when the tool output fails to parse', async () => {
    const { client } = clientReturning([
      { type: 'tool_use', name: EXTRACT_PRODUCT_TOOL_NAME, input: { name: 'X', unit: 'g' } }, // missing calories
    ]);
    const extractor = new AnthropicProductDraftExtractor({ client, model: 'm', logger: makeLogger() });
    await expect(extractor.extract([image])).rejects.toBeInstanceOf(ProductDraftExtractionError);
  });

  it('logs model/imageCount/tokens/duration without leaking the product name or image bytes', async () => {
    const logger = makeLogger();
    const { client } = clientReturning([validToolBlock]);
    const extractor = new AnthropicProductDraftExtractor({ client, model: 'test-model', logger });

    await extractor.extract([image]);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const logged = String(logger.info.mock.calls[0]![0]);
    expect(logged).toContain('barcode-product-capture.extract');
    expect(logged).toContain('test-model');
    expect(logged).toContain('imageCount');
    expect(logged).toContain('durationMs');
    expect(logged).not.toContain('Himbeer-Heidelbeer-Mix');
  });
});
