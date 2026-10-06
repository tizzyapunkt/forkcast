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
import { Banner } from '../../components/ui/banner';
import { Select } from '../../components/ui/select';
import { t } from '../../i18n';
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
    .number<number>({ error: t.bodyProfile.validation.weightNumber })
    .positive(t.bodyProfile.validation.weightPositive)
    .max(300, t.bodyProfile.validation.weightMax),
  heightCm: z.coerce
    .number<number>({ error: t.bodyProfile.validation.heightNumber })
    .positive(t.bodyProfile.validation.heightPositive)
    .max(250, t.bodyProfile.validation.heightMax),
  ageYears: z.coerce
    .number<number>({ error: t.bodyProfile.validation.ageNumber })
    .int(t.bodyProfile.validation.ageInteger)
    .min(1, t.bodyProfile.validation.ageRange)
    .max(120, t.bodyProfile.validation.ageRange),
  sex: z.enum(['male', 'female'] as const),
  activityFactor: z.coerce.number<number>(),
  goalPhase: z.enum(['recomposition', 'fat-loss', 'gain'] as const),
  proteinPerKg: z.coerce
    .number<number>()
    .positive(t.bodyProfile.validation.proteinPositive)
    .max(5, t.bodyProfile.validation.proteinMax),
  fatPercent: z.coerce
    .number<number>()
    .int(t.bodyProfile.validation.fatPercentInteger)
    .min(10, t.bodyProfile.validation.fatPercentRange)
    .max(60, t.bodyProfile.validation.fatPercentRange),
  adjustmentPercent: z.coerce
    .number<number>()
    .int(t.bodyProfile.validation.adjustmentInteger)
    .min(-40, t.bodyProfile.validation.adjustmentRange)
    .max(40, t.bodyProfile.validation.adjustmentRange),
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
  [PAL.sedentary]: t.bodyProfile.activityOptions.sedentary,
  [PAL.light]: t.bodyProfile.activityOptions.light,
  [PAL.moderate]: t.bodyProfile.activityOptions.moderate,
  [PAL.veryActive]: t.bodyProfile.activityOptions.veryActive,
  [PAL.extreme]: t.bodyProfile.activityOptions.extreme,
};

const PHASE_OPTIONS: { value: GoalPhase; label: string }[] = [
  { value: 'recomposition', label: t.bodyProfile.phaseOptions.recomposition },
  { value: 'fat-loss', label: t.bodyProfile.phaseOptions['fat-loss'] },
  { value: 'gain', label: t.bodyProfile.phaseOptions.gain },
];

type AdjustmentDirection = 'deficit' | 'maintenance' | 'surplus';

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: t.bodyProfile.sexMale },
  { value: 'female', label: t.bodyProfile.sexFemale },
];

const DIRECTION_OPTIONS: { value: AdjustmentDirection; label: string }[] = [
  { value: 'deficit', label: t.bodyProfile.adjustmentDirection.deficit },
  { value: 'maintenance', label: t.bodyProfile.adjustmentDirection.maintenance },
  { value: 'surplus', label: t.bodyProfile.adjustmentDirection.surplus },
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

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">{t.bodyProfile.loading}</div>;

  const error = saveMutation.error ?? applyMutation.error;
  const isPending = saveMutation.isPending || applyMutation.isPending;

  return (
    <form className="space-y-4 p-4" onSubmit={(e) => e.preventDefault()}>
      <h2 className="text-base font-semibold" role="heading">
        {t.settings.calculatorTitle}
      </h2>

      {error && <ErrorBanner error={error} />}
      {savedFlash === 'profile' && <Banner tone="success">{t.bodyProfile.saved}</Banner>}
      {savedFlash === 'goals' && <Banner tone="success">{t.bodyProfile.appliedAsGoals}</Banner>}

      {divergence && existing && activeGoal && (
        <Banner
          tone="warning"
          hint={t.bodyProfile.divergenceBody(existing.computed.targetCalories, activeGoal.calories)}
        >
          {t.bodyProfile.divergenceTitle}
        </Banner>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor="bp-weight" label={t.bodyProfile.weight} error={errors.weightKg?.message}>
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
            <p className="text-xs text-muted-foreground">
              {t.weightLog.averageHint(weightTrend.movingAverage7d.toFixed(1))}{' '}
              <button
                type="button"
                aria-label={t.weightLog.useTrailingAvgAria}
                onClick={() =>
                  setValue('weightKg', Number(weightTrend.movingAverage7d!.toFixed(1)), { shouldValidate: true })
                }
                className="text-primary underline-offset-2 hover:underline"
              >
                {t.weightLog.useTrailingAvg}
              </button>
            </p>
          )}
        </Field>
        <Field htmlFor="bp-height" label={t.bodyProfile.height} error={errors.heightCm?.message}>
          <Input
            id="bp-height"
            type="number"
            inputMode="numeric"
            step="1"
            {...register('heightCm')}
            className="w-full"
          />
        </Field>
        <Field htmlFor="bp-age" label={t.bodyProfile.age} error={errors.ageYears?.message}>
          <Input id="bp-age" type="number" inputMode="numeric" step="1" {...register('ageYears')} className="w-full" />
        </Field>
        <Field htmlFor="bp-sex" label={t.bodyProfile.sex} error={errors.sex?.message}>
          <Controller
            name="sex"
            control={control}
            render={({ field }) => (
              <SegmentedControl
                label={t.bodyProfile.sex}
                value={field.value}
                onChange={field.onChange}
                options={SEX_OPTIONS}
              />
            )}
          />
        </Field>
      </div>

      <Field htmlFor="bp-activity" label={t.bodyProfile.activity} error={errors.activityFactor?.message}>
        <Select id="bp-activity" {...register('activityFactor')}>
          {ACTIVITY_FACTORS.map((factor) => (
            <option key={factor} value={factor}>
              {ACTIVITY_LABELS[factor]}
            </option>
          ))}
        </Select>
      </Field>

      <Field htmlFor="bp-phase" label={t.bodyProfile.phase} error={errors.goalPhase?.message}>
        <Select id="bp-phase" value={values.goalPhase} onChange={(e) => onPhaseChange(e.target.value as GoalPhase)}>
          {PHASE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor="bp-protein" label={t.bodyProfile.proteinPerKg} error={errors.proteinPerKg?.message}>
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
        <Field htmlFor="bp-fat" label={t.bodyProfile.fatPercent} error={errors.fatPercent?.message}>
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
        label={t.bodyProfile.adjustment}
        error={errors.adjustmentPercent?.message}
      >
        <SegmentedControl
          label={t.bodyProfile.adjustmentDirectionLabel}
          value={adjustmentDirection}
          onChange={onDirectionChange}
          options={DIRECTION_OPTIONS}
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
        <p className="text-xs text-muted-foreground">{t.bodyProfile.adjustmentHint}</p>
      </Field>

      <section
        aria-label={t.bodyProfile.previewTitle}
        className="rounded-md border border-input bg-muted/30 p-3 text-sm"
      >
        <h3 className="mb-2 font-medium">{t.bodyProfile.previewTitle}</h3>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          <dt>{t.bodyProfile.ree}</dt>
          <dd className="text-right tabular-nums">{Math.round(preview.ree)} kcal</dd>
          <dt>{t.bodyProfile.tdee}</dt>
          <dd className="text-right tabular-nums">{Math.round(preview.tdee)} kcal</dd>
          <dt>{t.bodyProfile.targetCalories}</dt>
          <dd className="text-right tabular-nums">{preview.targetCalories} kcal</dd>
          <dt>{t.bodyProfile.proteinGrams}</dt>
          <dd className="text-right tabular-nums">{preview.proteinGrams} g</dd>
          <dt>{t.bodyProfile.fatGrams}</dt>
          <dd className="text-right tabular-nums">{preview.fatGrams} g</dd>
          <dt>{t.bodyProfile.carbsGrams}</dt>
          <dd className="text-right tabular-nums">{preview.carbsGrams} g</dd>
          {preview.proteinFatExceedsTarget && (
            <>
              <dt className="col-span-2 mt-2 font-medium text-warning-ink">{t.bodyProfile.warningTitle}</dt>
              <dd className="col-span-2 text-warning-ink">{t.bodyProfile.warningBody}</dd>
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
          {saveMutation.isPending ? t.bodyProfile.saving : t.bodyProfile.saveProfile}
        </Button>
        <Button onClick={handleSubmit(onSaveAsGoals)} disabled={isPending} className="flex-1">
          {applyMutation.isPending ? t.bodyProfile.applying : t.bodyProfile.saveAsGoals}
        </Button>
      </div>
    </form>
  );
}
