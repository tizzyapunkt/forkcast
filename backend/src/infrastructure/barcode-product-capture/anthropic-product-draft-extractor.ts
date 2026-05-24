import type Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { Buffer } from 'node:buffer';
import {
  ProductDraftExtractionError,
  type ProductDraftExtractor,
} from '../../domain/barcode-product-capture/product-draft-extractor.ts';
import type { ExtractedProduct, ProductImage } from '../../domain/barcode-product-capture/types.ts';
import type { AnthropicLikeClient } from '../ai-recipe-import/anthropic-recipe-draft-extractor.ts';
import {
  EXTRACT_PRODUCT_INSTRUCTIONS,
  EXTRACT_PRODUCT_TOOL,
  EXTRACT_PRODUCT_TOOL_NAME,
  parseProductToolInput,
} from './extract-product-tool.ts';

export interface AnthropicProductDraftExtractorOptions {
  client: AnthropicLikeClient | Anthropic;
  model: string;
  maxTokens?: number;
  logger?: Pick<Console, 'info' | 'warn'>;
}

export class AnthropicProductDraftExtractor implements ProductDraftExtractor {
  private readonly client: AnthropicLikeClient;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly logger: Pick<Console, 'info' | 'warn'>;

  constructor(opts: AnthropicProductDraftExtractorOptions) {
    this.client = opts.client as AnthropicLikeClient;
    this.model = opts.model;
    this.maxTokens = opts.maxTokens ?? 1024;
    this.logger = opts.logger ?? console;
  }

  async extract(images: ProductImage[]): Promise<ExtractedProduct> {
    if (images.length === 0) {
      throw new ProductDraftExtractionError('At least one image is required');
    }

    const params: MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: this.maxTokens,
      tools: [EXTRACT_PRODUCT_TOOL],
      tool_choice: { type: 'tool', name: EXTRACT_PRODUCT_TOOL_NAME },
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((image) => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: image.mediaType,
                data: Buffer.from(image.bytes).toString('base64'),
              },
            })),
            { type: 'text' as const, text: EXTRACT_PRODUCT_INSTRUCTIONS },
          ],
        },
      ],
    };

    const startedAt = Date.now();
    let response: Message;
    try {
      response = await this.client.messages.create(params);
    } catch (err) {
      throw new ProductDraftExtractionError('Anthropic API call failed', err);
    }
    const durationMs = Date.now() - startedAt;

    const toolBlock = response.content.find(
      (block): block is Extract<Message['content'][number], { type: 'tool_use' }> =>
        block.type === 'tool_use' && block.name === EXTRACT_PRODUCT_TOOL_NAME,
    );
    if (!toolBlock) {
      throw new ProductDraftExtractionError('Model did not return a tool_use block for extract_product');
    }

    let product: ExtractedProduct;
    try {
      product = parseProductToolInput(toolBlock.input);
    } catch (err) {
      throw new ProductDraftExtractionError('Tool result did not match the expected schema', err);
    }

    this.logger.info(
      JSON.stringify({
        event: 'barcode-product-capture.extract',
        model: this.model,
        imageCount: images.length,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        durationMs,
      }),
    );

    return product;
  }
}
