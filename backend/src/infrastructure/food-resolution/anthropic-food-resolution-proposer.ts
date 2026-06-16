import type Anthropic from '@anthropic-ai/sdk';
import type { Message, MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import {
  FoodResolutionError,
  type FoodResolutionProposer,
  type ResolutionCandidate,
  type ResolutionConfidence,
  type ResolutionRequest,
  type ResolutionVerdict,
} from '../../domain/food-resolution/types.ts';
import type { FoodEntry } from '../../domain/foods/types.ts';
import {
  PROPOSE_RESOLUTIONS_SYSTEM_PROMPT,
  PROPOSE_RESOLUTIONS_TOOL,
  PROPOSE_RESOLUTIONS_TOOL_NAME,
} from './resolution-tool.ts';

export interface AnthropicMessagesClient {
  create(params: MessageCreateParamsNonStreaming): Promise<Message>;
}
export interface AnthropicLikeClient {
  messages: AnthropicMessagesClient;
}

export interface AnthropicFoodResolutionProposerOptions {
  client: AnthropicLikeClient | Anthropic;
  model: string;
  maxTokens?: number;
  logger?: Pick<Console, 'info' | 'warn'>;
}

const CONFIDENCES = new Set<ResolutionConfidence>(['high', 'medium', 'low']);

function coerceConfidence(value: unknown): ResolutionConfidence {
  return CONFIDENCES.has(value as ResolutionConfidence) ? (value as ResolutionConfidence) : 'low';
}

function formatCandidate(c: ResolutionCandidate): string {
  const m = c.macrosPer100;
  return `    - ${c.id}: ${c.name} (${m.calories} kcal/100${c.unit}${c.untracked ? ', untracked' : ''})`;
}

function formatRequest(req: ResolutionRequest, index: number): string {
  const { item, candidates } = req;
  const noteLine = item.note ? ` — note: "${item.note}"` : '';
  const candidateLines = candidates.length > 0 ? candidates.map(formatCandidate).join('\n') : '    (no candidates)';
  return `[${index}] "${item.name}"${noteLine}\n  candidates:\n${candidateLines}`;
}

/**
 * Anthropic adapter for the runtime resolution proposer. One batched call returns
 * a verdict per item; the prompt carries each item's name + note + its top-K
 * candidates (not the whole catalog). Verdicts are returned verbatim — validation
 * of `new-food` entries is the use case's job.
 */
export class AnthropicFoodResolutionProposer implements FoodResolutionProposer {
  private readonly client: AnthropicLikeClient;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly logger: Pick<Console, 'info' | 'warn'>;

  constructor(opts: AnthropicFoodResolutionProposerOptions) {
    this.client = opts.client as AnthropicLikeClient;
    this.model = opts.model;
    this.maxTokens = opts.maxTokens ?? 4096;
    this.logger = opts.logger ?? console;
  }

  async propose(requests: ResolutionRequest[]): Promise<ResolutionVerdict[]> {
    if (requests.length === 0) return [];

    const userMessage = `Resolve these ${requests.length} unmatched ingredient(s):\n\n${requests
      .map((req, i) => formatRequest(req, i))
      .join('\n\n')}`;

    const params: MessageCreateParamsNonStreaming = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: PROPOSE_RESOLUTIONS_SYSTEM_PROMPT,
      tools: [PROPOSE_RESOLUTIONS_TOOL],
      tool_choice: { type: 'tool', name: PROPOSE_RESOLUTIONS_TOOL_NAME },
      messages: [{ role: 'user', content: userMessage }],
    };

    let response: Message;
    const startedAt = Date.now();
    try {
      response = await this.client.messages.create(params);
    } catch (err) {
      throw new FoodResolutionError(`AI provider call failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === PROPOSE_RESOLUTIONS_TOOL_NAME,
    );
    if (!toolUse) {
      throw new FoodResolutionError(`No ${PROPOSE_RESOLUTIONS_TOOL_NAME} tool_use block in response`);
    }
    const proposals = (toolUse.input as { proposals?: unknown }).proposals;
    if (!Array.isArray(proposals)) {
      throw new FoodResolutionError('tool_use input.proposals is not an array');
    }

    const byIndex = new Map<number, ResolutionVerdict>();
    for (const raw of proposals) {
      const parsed = this.parseProposal(raw);
      if (parsed) byIndex.set(parsed.index, parsed.verdict);
    }

    // Align to the request order; any item the model failed to address degrades to skip.
    const verdicts = requests.map(
      (_, i): ResolutionVerdict => byIndex.get(i) ?? { verdict: 'skip', reason: 'no proposal returned for this item' },
    );

    this.logger.info?.(
      `food-resolution: model=${this.model} items=${requests.length} inputTokens=${response.usage?.input_tokens ?? '?'} outputTokens=${response.usage?.output_tokens ?? '?'} durationMs=${Date.now() - startedAt}`,
    );

    return verdicts;
  }

  private parseProposal(raw: unknown): { index: number; verdict: ResolutionVerdict } | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const index = typeof o.index === 'number' ? o.index : Number(o.index);
    if (!Number.isInteger(index) || index < 0) return null;
    const confidence = coerceConfidence(o.confidence);

    if (o.verdict === 'synonym-of') {
      const foodId = typeof o.foodId === 'string' ? o.foodId.trim() : '';
      const synonym = typeof o.synonym === 'string' ? o.synonym.trim() : '';
      if (!foodId || !synonym) return null;
      return { index, verdict: { verdict: 'synonym-of', foodId, synonym, confidence } };
    }
    if (o.verdict === 'new-food') {
      if (!o.entry || typeof o.entry !== 'object') return null;
      return { index, verdict: { verdict: 'new-food', entry: o.entry as FoodEntry, confidence } };
    }
    if (o.verdict === 'skip') {
      return { index, verdict: { verdict: 'skip', reason: typeof o.reason === 'string' ? o.reason : '' } };
    }
    return null;
  }
}
