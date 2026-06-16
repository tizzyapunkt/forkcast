import { describe, it, expect, vi } from 'vitest';
import { proposeResolutions, type ProposeResolutionsDeps } from './propose-resolutions.use-case.ts';
import type {
  FoodResolutionProposer,
  ResolutionCandidate,
  ResolutionCandidateFinder,
  ResolutionVerdict,
} from './types.ts';
import type { FoodEntry } from '../foods/types.ts';

const oliven: ResolutionCandidate = {
  id: 'oliven',
  name: 'Oliven',
  unit: 'g',
  macrosPer100: { calories: 145, protein: 1, carbs: 6, fat: 15 },
};

function makeFinder(candidates: ResolutionCandidate[]): ResolutionCandidateFinder {
  return {
    findCandidates: vi.fn<(q: string, limit: number) => Promise<ResolutionCandidate[]>>().mockResolvedValue(candidates),
  };
}

function makeProposer(verdicts: ResolutionVerdict[]): FoodResolutionProposer {
  return { propose: vi.fn<(r: unknown[]) => Promise<ResolutionVerdict[]>>().mockResolvedValue(verdicts) };
}

const validEntry: FoodEntry = {
  id: 'kirschtomaten',
  name: 'Kirschtomaten',
  synonyms: [],
  unit: 'g',
  macrosPer100: { calories: 20, protein: 0.9, carbs: 3.9, fat: 0.2 },
};

describe('proposeResolutions', () => {
  it('gathers fuzzy candidates and asks the proposer once', async () => {
    const candidates = makeFinder([oliven]);
    const proposer = makeProposer([
      { verdict: 'synonym-of', foodId: 'oliven', synonym: 'grüne Oliven', confidence: 'high' },
    ]);
    const deps: ProposeResolutionsDeps = { candidates, proposer };

    await proposeResolutions(deps, [{ name: 'grüne Oliven' }]);

    expect(candidates.findCandidates).toHaveBeenCalledWith('grüne Oliven', 8);
    expect(proposer.propose).toHaveBeenCalledTimes(1);
  });

  it('attaches a food summary to a synonym-of verdict from the candidate list', async () => {
    const candidates = makeFinder([oliven]);
    const proposer = makeProposer([
      { verdict: 'synonym-of', foodId: 'oliven', synonym: 'grüne Oliven', confidence: 'high' },
    ]);

    const [proposal] = await proposeResolutions({ candidates, proposer }, [{ name: 'grüne Oliven' }]);
    expect(proposal).toMatchObject({
      verdict: 'synonym-of',
      foodId: 'oliven',
      synonym: 'grüne Oliven',
      food: { id: 'oliven', name: 'Oliven', unit: 'g', macrosPer100: { calories: 145, protein: 1, carbs: 6, fat: 15 } },
    });
  });

  it('degrades a synonym-of verdict whose foodId is not among candidates to skip', async () => {
    const candidates = makeFinder([oliven]);
    const proposer = makeProposer([{ verdict: 'synonym-of', foodId: 'ghost', synonym: 'x', confidence: 'high' }]);
    const [proposal] = await proposeResolutions({ candidates, proposer }, [{ name: 'x' }]);
    expect(proposal!.verdict).toBe('skip');
  });

  it('passes through a valid new-food verdict', async () => {
    const candidates = makeFinder([]);
    const proposer = makeProposer([{ verdict: 'new-food', entry: validEntry, confidence: 'medium' }]);
    const [proposal] = await proposeResolutions({ candidates, proposer }, [{ name: 'Kirschtomaten' }]);
    expect(proposal).toMatchObject({ verdict: 'new-food', confidence: 'medium' });
  });

  it('degrades a truly invalid new-food entry to skip without failing the batch', async () => {
    const candidates = makeFinder([]);
    const proposer = makeProposer([
      {
        verdict: 'new-food',
        entry: { ...validEntry, macrosPer100: { calories: -1, protein: 0, carbs: 0, fat: 0 } },
        confidence: 'medium',
      },
      { verdict: 'skip', reason: 'x' },
    ]);
    const proposals = await proposeResolutions({ candidates, proposer }, [{ name: 'a' }, { name: 'b' }]);
    expect(proposals[0]!.verdict).toBe('skip');
    expect(proposals[1]!.verdict).toBe('skip');
  });

  it('salvages an untracked entry with non-zero macros by coercing them to zero', async () => {
    const candidates = makeFinder([]);
    const proposer = makeProposer([
      {
        verdict: 'new-food',
        entry: { ...validEntry, id: 'sumach', name: 'Sumach', untracked: true },
        confidence: 'medium',
      },
    ]);
    const [proposal] = await proposeResolutions({ candidates, proposer }, [{ name: 'Sumach' }]);
    expect(proposal!.verdict).toBe('new-food');
    if (proposal!.verdict !== 'new-food') return;
    expect(proposal.entry.untracked).toBe(true);
    expect(proposal.entry.macrosPer100).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });

  it('passes name and note through to the proposer request', async () => {
    const candidates = makeFinder([]);
    const proposer = makeProposer([{ verdict: 'skip', reason: 'x' }]);
    await proposeResolutions({ candidates, proposer }, [{ name: 'Tomaten', note: 'getrocknet in Öl' }]);
    const [requests] = (proposer.propose as ReturnType<typeof vi.fn>).mock.calls[0] as [
      { item: { name: string; note?: string } }[],
    ];
    expect(requests[0]!.item).toEqual({ name: 'Tomaten', note: 'getrocknet in Öl' });
  });
});
