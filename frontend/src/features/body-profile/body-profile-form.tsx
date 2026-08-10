import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useBodyProfile } from '../../queries/use-body-profile';
import { useSaveBodyProfile } from '../../queries/use-save-body-profile';
import { useApplyBodyProfileAsGoals } from '../../queries/use-apply-body-profile-as-goals';
import { useNutritionGoal } from '../../queries/use-nutrition-goal';
import { useWeightTrend } from '../../queries/use-weight-trend';
import { ErrorBanner } from '../../components/app/error-banner';
import { de } from '../../i18n/de';
import { ACTIVITY_FACTORS, PAL, type BodyProfile, type GoalPhase, type Sex } from '../../domain/body-profile';
import { PHASE_PRESETS } from './phase-presets';
import { computePreview } from './compute-preview';
import { Button } from '../../components/ui/button';
import { DecimalInput } from '../../components/ui/decimal-input';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { SegmentedControl } from '../../components/ui/segmented-control';

const schema = z.object({
  weightKg: z.coerce
    .number({ invalid_type_error: de.bodyProfile.validation.weightNumber })
    .positive(de.bodyProfile.validation.weightPositive)
    .max(300, de.bodyProfile.validation.weightMax),
  heightCm: z.coerce
    .number({ invalid_type_error: de.bodyProfile.validation.heightNumber })
    .positive(de.bodyProfile.validation.heightPositive)
    .max(250, de.bodyProfile.validation.heightMax),
  ageYears: z.coerce
    .number({ invalid_type_error: de.bodyProfile.validation.ageNumber })
    .int(de.bodyProfile.validation.ageInteger)
    .min(1, de.bodyProfile.validation.ageRange)
    .max(120, de.bodyProfile.validation.ageRange),
  sex: z.enum(['male', 'female'] as const),
  activityFactor: z.coerce.number(),
  goalPhase: z.enum(['recomposition', 'fat-loss', 'gain'] as const),
  proteinPerKg: z.coerce
    .number()
    .positive(de.bodyProfile.validation.proteinPositive)
    .max(5, de.bodyProfile.validation.proteinMax),
  fatPercent: z.coerce
    .number()
    .int(de.bodyProfile.validation.fatPercentInteger)
    .min(10, de.bodyProfile.validation.fatPercentRange)
    .max(60, de.bodyProfile.validation.fatPercentRange),
  adjustmentPercent: z.coerce
    .number()
    .int(de.bodyProfile.validation.adjustmentInteger)
    .min(-40, de.bodyProfile.validation.adjustmentRange)
    .max(40, de.bodyProfile.validation.adjustmentRange),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  weightKg: 80,
  heightCm: 180,
  ageYears: 30,
  sex: 'male',
  activityFactor: PAL.moderate,
  goalPhase: 'recomposition',
  proteinPerKg: PHASE_PRESETS.recomposition.proteinPerKg,
  fatPercent: PHASE_PRESETS.recomposition.fatPercent,
  adjustmentPercent: PHASE_PRESETS.recomposition.adjustmentPercent,
};

const ACTIVITY_LABELS: Record<number, string> = {
  [PAL.sedentary]: de.bodyProfile.activityOptions.sedentary,
  [PAL.light]: de.bodyProfile.activityOptions.light,
  [PAL.moderate]: de.bodyProfile.activityOptions.moderate,
  [PAL.veryActive]: de.bodyProfile.activityOptions.veryActive,
  [PAL.extreme]: de.bodyProfile.activityOptions.extreme,
};

const PHASE_OPTIONS: { value: GoalPhase; label: string }[] = [
  { value: 'recomposition', label: de.bodyProfile.phaseOptions.recomposition },
  { value: 'fat-loss', label: de.bodyProfile.phaseOptions['fat-loss'] },
  { value: 'gain', label: de.bodyProfile.phaseOptions.gain },
];

type AdjustmentDirection = 'deficit' | 'maintenance' | 'surplus';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: de.bodyProfile.sexMale },
  { value: 'female', label: de.bodyProfile.sexFemale },
];

const DIRECTION_OPTIONS: { value: AdjustmentDirection; label: string }[] = [
  { value: 'deficit', label: de.bodyProfile.adjustmentDirection.deficit },
  { value: 'maintenance', label: de.bodyProfile.adjustmentDirection.maintenance },
  { value: 'surplus', label: de.bodyProfile.adjustmentDirection.surplus },
];

function directionOf(adjustmentPercent: number): AdjustmentDirection {
  if (adjustmentPercent < 0) return 'deficit';
  if (adjustmentPercent > 0) return 'surplus';
  return 'maintenance';
}

function deriveAdjustment(direction: AdjustmentDirection, magnitude: number): number {
  if (direction === 'maintenance') return 0;
  return direction === 'deficit' ? -magnitude : magnitude;
}

export function BodyProfileForm() {
  const { data: existing, isLoading } = useBodyProfile();
  const { data: activeGoal } = useNutritionGoal();
  const { data: weightTrend } = useWeightTrend();
  const saveMutation = useSaveBodyProfile();
  const applyMutation = useApplyBodyProfileAsGoals();
  const [savedFlash, setSavedFlash] = useState<'profile' | 'goals' | null>(null);
  // UI-only state for the adjustment composite control. Not part of the zod schema —
  // the persisted value is the derived `adjustmentPercent` written via setValue.
  const [adjustmentDirection, setAdjustmentDirection] = useState<AdjustmentDirection>(
    directionOf(DEFAULTS.adjustmentPercent),
  );
  const [adjustmentMagnitude, setAdjustmentMagnitude] = useState<number | ''>(Math.abs(DEFAULTS.adjustmentPercent));

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  useEffect(() => {
    if (existing) {
      reset(existing.profile);
      setAdjustmentDirection(directionOf(existing.profile.adjustmentPercent));
      setAdjustmentMagnitude(Math.abs(existing.profile.adjustmentPercent));
    }
  }, [existing, reset]);

  const values = watch();
  const preview = useMemo(() => computePreview(values as BodyProfile), [values]);

  function onPhaseChange(phase: GoalPhase) {
    const preset = PHASE_PRESETS[phase];
    setValue('goalPhase', phase, { shouldValidate: true });
    setValue('adjustmentPercent', preset.adjustmentPercent, { shouldValidate: true });
    setValue('proteinPerKg', preset.proteinPerKg, { shouldValidate: true });
    setValue('fatPercent', preset.fatPercent, { shouldValidate: true });
    setAdjustmentDirection(directionOf(preset.adjustmentPercent));
    setAdjustmentMagnitude(Math.abs(preset.adjustmentPercent));
  }

  function onDirectionChange(direction: AdjustmentDirection) {
    setAdjustmentDirection(direction);
    if (direction === 'maintenance') {
      setAdjustmentMagnitude(0);
      setValue('adjustmentPercent', 0, { shouldValidate: true });
      return;
    }
    const magnitudeNumber = adjustmentMagnitude === '' ? 0 : adjustmentMagnitude;
    if (magnitudeNumber === 0) setAdjustmentMagnitude('');
    setValue('adjustmentPercent', deriveAdjustment(direction, magnitudeNumber), { shouldValidate: true });
  }

  function onMagnitudeChange(rawValue: string) {
    if (rawValue === '') {
      setAdjustmentMagnitude('');
      setValue('adjustmentPercent', 0, { shouldValidate: true });
      return;
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    setAdjustmentMagnitude(parsed);
    setValue('adjustmentPercent', deriveAdjustment(adjustmentDirection, parsed), { shouldValidate: true });
  }

  async function onSaveProfile(values: FormValues) {
    saveMutation.mutate(values as BodyProfile, {
      onSuccess: () => setSavedFlash('profile'),
    });
  }

  async function onSaveAsGoals(values: FormValues) {
    setSavedFlash(null);
    try {
      await new Promise<void>((resolve, reject) =>
        saveMutation.mutate(values as BodyProfile, {
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        }),
      );
      applyMutation.mutate(undefined, {
        onSuccess: () => setSavedFlash('goals'),
      });
    } catch {
      // save error already surfaced via banner
    }
  }

  const divergence =
    existing && activeGoal
      ? existing.computed.targetCalories !== activeGoal.calories ||
        existing.computed.proteinGrams !== activeGoal.protein ||
        existing.computed.fatGrams !== activeGoal.fat ||
        existing.computed.carbsGrams !== activeGoal.carbs
      : false;

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">{de.bodyProfile.loading}</div>;

  const error = saveMutation.error ?? applyMutation.error;
  const isPending = saveMutation.isPending || applyMutation.isPending;

  return (
    <form className="space-y-4 p-4" onSubmit={(e) => e.preventDefault()}>
      <h2 className="text-base font-semibold" role="heading">
        {de.settings.calculatorTitle}
      </h2>

      {error && <ErrorBanner error={error} />}
      {savedFlash === 'profile' && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{de.bodyProfile.saved}</p>
      )}
      {savedFlash === 'goals' && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">{de.bodyProfile.appliedAsGoals}</p>
      )}

      {divergence && existing && activeGoal && (
        <div role="status" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
          <p className="font-medium">{de.bodyProfile.divergenceTitle}</p>
          <p>{de.bodyProfile.divergenceBody(existing.computed.targetCalories, activeGoal.calories)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor="bp-weight" label={de.bodyProfile.weight} error={errors.weightKg?.message}>
          <Controller
            name="weightKg"
            control={control}
            render={({ field }) => (
              <DecimalInput
                id="bp-weight"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                className="w-full"
              />
            )}
          />
          {weightTrend?.movingAverage7d !== null && weightTrend?.movingAverage7d !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground">
              {de.weightLog.averageHint(weightTrend.movingAverage7d.toFixed(1))}{' '}
              <button
                type="button"
                aria-label={de.weightLog.useTrailingAvgAria}
                onClick={() =>
                  setValue('weightKg', Number(weightTrend.movingAverage7d!.toFixed(1)), { shouldValidate: true })
                }
                className="text-primary underline-offset-2 hover:underline"
              >
                {de.weightLog.useTrailingAvg}
              </button>
            </p>
          )}
        </Field>
        <Field htmlFor="bp-height" label={de.bodyProfile.height} error={errors.heightCm?.message}>
          <Input
            id="bp-height"
            type="number"
            inputMode="numeric"
            step="1"
            {...register('heightCm')}
            className="w-full"
          />
        </Field>
        <Field htmlFor="bp-age" label={de.bodyProfile.age} error={errors.ageYears?.message}>
          <Input id="bp-age" type="number" inputMode="numeric" step="1" {...register('ageYears')} className="w-full" />
        </Field>
        <Field htmlFor="bp-sex" label={de.bodyProfile.sex} error={errors.sex?.message}>
          <Controller
            name="sex"
            control={control}
            render={({ field }) => (
              <SegmentedControl
                label={de.bodyProfile.sex}
                value={field.value}
                onChange={field.onChange}
                options={SEX_OPTIONS}
              />
            )}
          />
        </Field>
      </div>

      <Field htmlFor="bp-activity" label={de.bodyProfile.activity} error={errors.activityFactor?.message}>
        <select id="bp-activity" {...register('activityFactor')} className={selectCls}>
          {ACTIVITY_FACTORS.map((factor) => (
            <option key={factor} value={factor}>
              {ACTIVITY_LABELS[factor]}
            </option>
          ))}
        </select>
      </Field>

      <Field htmlFor="bp-phase" label={de.bodyProfile.phase} error={errors.goalPhase?.message}>
        <select
          id="bp-phase"
          value={values.goalPhase}
          onChange={(e) => onPhaseChange(e.target.value as GoalPhase)}
          className={selectCls}
        >
          {PHASE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor="bp-protein" label={de.bodyProfile.proteinPerKg} error={errors.proteinPerKg?.message}>
          <Controller
            name="proteinPerKg"
            control={control}
            render={({ field }) => (
              <DecimalInput
                id="bp-protein"
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                className="w-full"
              />
            )}
          />
        </Field>
        <Field htmlFor="bp-fat" label={de.bodyProfile.fatPercent} error={errors.fatPercent?.message}>
          <Input
            id="bp-fat"
            type="number"
            inputMode="numeric"
            step="1"
            {...register('fatPercent')}
            className="w-full"
          />
        </Field>
      </div>

      <Field
        htmlFor="bp-adjustment-magnitude"
        label={de.bodyProfile.adjustment}
        error={errors.adjustmentPercent?.message}
      >
        <SegmentedControl
          label={de.bodyProfile.adjustmentDirectionLabel}
          value={adjustmentDirection}
          onChange={onDirectionChange}
          options={DIRECTION_OPTIONS}
          className="mb-2"
        />
        <Input
          id="bp-adjustment-magnitude"
          type="number"
          inputMode="numeric"
          min={0}
          max={40}
          step={1}
          value={adjustmentMagnitude}
          onChange={(e) => onMagnitudeChange(e.target.value)}
          disabled={adjustmentDirection === 'maintenance'}
          className="w-full disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-muted-foreground">{de.bodyProfile.adjustmentHint}</p>
      </Field>

      <section
        aria-label={de.bodyProfile.previewTitle}
        className="rounded-md border border-input bg-muted/30 p-3 text-sm"
      >
        <h3 className="mb-2 font-medium">{de.bodyProfile.previewTitle}</h3>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          <dt>{de.bodyProfile.ree}</dt>
          <dd className="text-right tabular-nums">{Math.round(preview.ree)} kcal</dd>
          <dt>{de.bodyProfile.tdee}</dt>
          <dd className="text-right tabular-nums">{Math.round(preview.tdee)} kcal</dd>
          <dt>{de.bodyProfile.targetCalories}</dt>
          <dd className="text-right tabular-nums">{preview.targetCalories} kcal</dd>
          <dt>{de.bodyProfile.proteinGrams}</dt>
          <dd className="text-right tabular-nums">{preview.proteinGrams} g</dd>
          <dt>{de.bodyProfile.fatGrams}</dt>
          <dd className="text-right tabular-nums">{preview.fatGrams} g</dd>
          <dt>{de.bodyProfile.carbsGrams}</dt>
          <dd className="text-right tabular-nums">{preview.carbsGrams} g</dd>
          {preview.proteinFatExceedsTarget && (
            <>
              <dt className="col-span-2 mt-2 font-medium text-warning">{de.bodyProfile.warningTitle}</dt>
              <dd className="col-span-2 text-warning">{de.bodyProfile.warningBody}</dd>
            </>
          )}
        </dl>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          onClick={handleSubmit(onSaveProfile)}
          disabled={isPending}
          className="flex-1 border-primary text-primary"
        >
          {saveMutation.isPending ? de.bodyProfile.saving : de.bodyProfile.saveProfile}
        </Button>
        <Button onClick={handleSubmit(onSaveAsGoals)} disabled={isPending} className="flex-1">
          {applyMutation.isPending ? de.bodyProfile.applying : de.bodyProfile.saveAsGoals}
        </Button>
      </div>
    </form>
  );
}

// `<select>` has no primitive yet — it keeps the Input base classes inline.
const selectCls = 'w-full rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm';
