import type Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { Buffer } from 'node:buffer';
import {
  RecipeDraftExtractionError,
  type RecipeDraftExtractor,
} from '../../domain/ai-recipe-import/recipe-draft-extractor.ts';
import type { ExtractedDraft, RecipeImage } from '../../domain/ai-recipe-import/types.ts';
import {
  EXTRACT_RECIPE_INSTRUCTIONS,
  EXTRACT_RECIPE_TOOL,
  EXTRACT_RECIPE_TOOL_NAME,
  parseToolInput,
} from './extract-recipe-tool.ts';

export interface AnthropicMessagesClient {
  create(params: MessageCreateParamsNonStreaming): Promise<Message>;
}

export interface AnthropicLikeClient {
  messages: AnthropicMessagesClient;
}

export interface AnthropicRecipeDraftExtractorOptions {
  client: AnthropicLikeClient | Anthropic;
  model: string;
  maxTokens?: number;
  logger?: Pick<Console, 'info' | 'warn'>;
}

export class AnthropicRecipeDraftExtractor implements RecipeDraftExtractor {
  private readonly client: AnthropicLikeClient;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly logger: Pick<Console, 'info' | 'warn'>;

  constructor(opts: AnthropicRecipeDraftExtractorOptions) {
    this.client = opts.client as AnthropicLikeClient;
    this.model = opts.model;
    this.maxTokens = opts.maxTokens ?? 4096;
    this.logger = opts.logger ?? console;
  }

  async extract(images: RecipeImage[]): Promise<ExtractedDraft> {
    if (images.length === 0) {
      throw new RecipeDraftExtractionError('At least one image is required');
    }

    const params: MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: this.maxTokens,
      tools: [EXTRACT_RECIPE_TOOL],
      tool_choice: { type: 'tool', name: EXTRACT_RECIPE_TOOL_NAME },
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
            { type: 'text' as const, text: EXTRACT_RECIPE_INSTRUCTIONS },
          ],
        },
      ],
    };

    const startedAt = Date.now();
    let response: Message;
    try {
      response = await this.client.messages.create(params);
    } catch (err) {
      throw new RecipeDraftExtractionError('Anthropic API call failed', err);
    }
    const durationMs = Date.now() - startedAt;

    const toolBlock = response.content.find(
      (block): block is Extract<Message['content'][number], { type: 'tool_use' }> =>
        block.type === 'tool_use' && block.name === EXTRACT_RECIPE_TOOL_NAME,
    );
    if (!toolBlock) {
      throw new RecipeDraftExtractionError('Model did not return a tool_use block for extract_recipe');
    }

    let draft: ExtractedDraft;
    try {
      draft = parseToolInput(toolBlock.input);
    } catch (err) {
      throw new RecipeDraftExtractionError('Tool result did not match the expected schema', err);
    }

    this.logger.info(
      JSON.stringify({
        event: 'ai-recipe-import.extract',
        model: this.model,
        imageCount: images.length,
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        durationMs,
      }),
    );

    return draft;
  }
}
