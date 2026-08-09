import type Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { CatalogDraftError, type CatalogEntryDrafter } from '../../domain/food-catalog/catalog-entry-drafter.ts';
import { slugifyName } from '../../domain/food-catalog/slugify-name.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';
import { FOOD_ENTRY_GUIDANCE, FOOD_ENTRY_SCHEMA } from '../food-drafting/food-entry-schema.ts';

export interface AnthropicMessagesClient {
  create(params: MessageCreateParamsNonStreaming): Promise<Message>;
}
export interface AnthropicLikeClient {
  messages: AnthropicMessagesClient;
}

export interface AnthropicCatalogEntryDrafterOptions {
  client: AnthropicLikeClient | Anthropic;
  model: string;
  maxTokens?: number;
}

export const DRAFT_FOOD_ENTRY_TOOL_NAME = 'submit_food_entry';

export const DRAFT_FOOD_ENTRY_TOOL: Anthropic.Tool = {
  name: DRAFT_FOOD_ENTRY_TOOL_NAME,
  description: 'Submit exactly one catalog food entry for the requested food name.',
  input_schema: {
    type: 'object',
    properties: FOOD_ENTRY_SCHEMA.properties,
    required: [...FOOD_ENTRY_SCHEMA.required],
  } as Anthropic.Tool['input_schema'],
};

export const DRAFT_FOOD_ENTRY_SYSTEM_PROMPT = `You are a nutrition data assistant for a personal meal-planning app. The user gives you one food name they are adding to their catalog by hand. Return exactly one entry for it via the ${DRAFT_FOOD_ENTRY_TOOL_NAME} tool.\n\n${FOOD_ENTRY_GUIDANCE}\n\nDraft the food the user actually named — do not substitute a more common relative — and keep the name in the language they used.`;

/**
 * Anthropic adapter for the catalog manager's fill action. Uses the shared
 * food-entry schema and guidance, so a filled entry is shaped exactly like one
 * drafted during import resolution. The returned `id` is always derived from the
 * canonical name locally rather than trusted from the model.
 */
export class AnthropicCatalogEntryDrafter implements CatalogEntryDrafter {
  private readonly client: AnthropicLikeClient;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(opts: AnthropicCatalogEntryDrafterOptions) {
    this.client = opts.client as AnthropicLikeClient;
    this.model = opts.model;
    this.maxTokens = opts.maxTokens ?? 1024;
  }

  async draft(name: string): Promise<FoodEntry> {
    const params: MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: DRAFT_FOOD_ENTRY_SYSTEM_PROMPT,
      tools: [DRAFT_FOOD_ENTRY_TOOL],
      tool_choice: { type: 'tool', name: DRAFT_FOOD_ENTRY_TOOL_NAME },
      messages: [{ role: 'user', content: `Draft a catalog entry for: ${name}` }],
    };

    let response: Message;
    try {
      response = await this.client.messages.create(params);
    } catch (err) {
      throw new CatalogDraftError(`AI provider call failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === DRAFT_FOOD_ENTRY_TOOL_NAME,
    );
    if (!toolUse) throw new CatalogDraftError(`No ${DRAFT_FOOD_ENTRY_TOOL_NAME} tool_use block in response`);

    const drafted = toolUse.input as Partial<FoodEntry>;
    if (typeof drafted.name !== 'string' || drafted.name.trim().length === 0) {
      throw new CatalogDraftError('drafted entry has no name');
    }
    return { ...(drafted as FoodEntry), id: slugifyName(drafted.name) };
  }
}
