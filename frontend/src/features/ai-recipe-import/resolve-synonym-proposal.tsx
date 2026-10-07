import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { t } from '../../i18n';
import type { ResolutionConfidence, ResolutionProposal } from '../../domain/food-resolution';

const copy = t.aiRecipeImport.resolve;

const CONFIDENCE_LABEL: Record<ResolutionConfidence, string> = {
  high: copy.confidenceHigh,
  medium: copy.confidenceMedium,
  low: copy.confidenceLow,
};

function ConfidenceChip({ confidence }: { confidence: ResolutionConfidence }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {copy.confidence(CONFIDENCE_LABEL[confidence])}
    </span>
  );
}

export function SynonymProposal({
  proposal,
  rawName,
  synonym,
  setSynonym,
  onManual,
  onRejectForOwnEntry,
}: {
  proposal: Extract<ResolutionProposal, { verdict: 'synonym-of' }>;
  rawName: string;
  /** The alias that will be stored — editable, so an over-specific one can be trimmed. */
  synonym: string;
  setSynonym: (v: string) => void;
  onManual: () => void;
  /** Reject the match: the raw name is a food of its own, not an alias. */
  onRejectForOwnEntry: () => void;
}) {
  const { food } = proposal;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">{copy.synonymEyebrow}</span>
        <ConfidenceChip confidence={proposal.confidence} />
      </div>
      <Card padding="sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{food.name}</span>
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold uppercase">
            {copy.catalogChip}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {Math.round(food.macrosPer100.calories)} {copy.kcalLabel} · {copy.macrosPer(food.unit)}
        </p>
      </Card>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{copy.synonymLabel}</span>
        <Input
          value={synonym}
          onChange={(e) => setSynonym(e.target.value)}
          aria-label={copy.synonymLabel}
          className="h-10 w-full py-0 text-sm"
        />
      </label>
      <p className="text-sm text-muted-foreground">{copy.synonymExplain(rawName, food.name)}</p>
      <div className="flex flex-col items-start gap-1">
        <Button variant="ghost" onClick={onRejectForOwnEntry} className="p-0">
          {copy.rejectSynonymLink}
        </Button>
        <Button variant="ghost" onClick={onManual} className="p-0">
          {copy.synonymOtherLink}
        </Button>
      </div>
    </div>
  );
}
