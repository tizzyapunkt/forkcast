import type { FoodEntry } from '../foods/types.ts';
import { validateFoodEntry } from '../foods/validate-food-entry.ts';
import type {
  FoodResolutionProposer,
  ResolutionCandidateFinder,
  ResolutionConfidence,
  ResolutionItem,
  ResolutionRequest,
} from './types.ts';

const CANDIDATE_CAP = 8;

/** A food summary embedded in a synonym proposal so the client can render it without a lookup. */
export interface ProposalFoodSummary {
  id: string;
  name: string;
  unit: 'g' | 'ml';
  macrosPer100: FoodEntry['macrosPer100'];
  untracked?: boolean;
}

export type ClientProposal =
  | {
      verdict: 'synonym-of';
      foodId: string;
      synonym: string;
      confidence: ResolutionConfidence;
      food: ProposalFoodSummary;
    }
  | { verdict: 'new-food'; entry: FoodEntry; confidence: ResolutionConfidence }
  | { verdict: 'skip'; reason: string };

export interface ProposeResolutionsDeps {
  candidates: ResolutionCandidateFinder;
  proposer: FoodResolutionProposer;
}

/**
 * Gather top-K fuzzy FOODS + USER candidates per unmatched item, ask the proposer
 * for a verdict each, then shape verdicts for the client: validate `new-food`
 * entries (degrade to skip on failure) and attach a food summary to `synonym-of`
 * verdicts. Persists nothing.
 */
export async function proposeResolutions(
  deps: ProposeResolutionsDeps,
  items: ResolutionItem[],
): Promise<ClientProposal[]> {
  const requests: ResolutionRequest[] = await Promise.all(
    items.map(async (item) => {
      const candidates = await deps.candidates.findCandidates(item.name, CANDIDATE_CAP);
      return { item, candidates };
    }),
  );

  const verdicts = await deps.proposer.propose(requests);

  return verdicts.map((v, i): ClientProposal => {
    if (v.verdict === 'new-food') {
      // Salvage the common LLM slip: untracked but with non-zero macros. Untracked means
      // zero by definition, so coerce rather than discard a near-right seasoning proposal.
      const entry =
        v.entry.untracked === true
          ? { ...v.entry, macrosPer100: { calories: 0, protein: 0, carbs: 0, fat: 0 } }
          : v.entry;
      const result = validateFoodEntry(entry);
      if (!result.ok) return { verdict: 'skip', reason: `proposed entry invalid: ${result.reason}` };
      return { verdict: 'new-food', entry: result.entry, confidence: v.confidence };
    }
    if (v.verdict === 'synonym-of') {
      const match = requests[i]!.candidates.find((c) => c.id === v.foodId);
      if (!match) return { verdict: 'skip', reason: `synonym target "${v.foodId}" not among candidates` };
      const food: ProposalFoodSummary = {
        id: match.id,
        name: match.name,
        unit: match.unit,
        macrosPer100: match.macrosPer100,
      };
      if (match.untracked === true) food.untracked = true;
      return { verdict: 'synonym-of', foodId: v.foodId, synonym: v.synonym, confidence: v.confidence, food };
    }
    return { verdict: 'skip', reason: v.reason };
  });
}
