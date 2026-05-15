import type { BodyProfile, GoalPhase, Sex } from './types.ts';
import { ALLOWED_ACTIVITY_FACTORS } from './constants.ts';

export class BodyProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BodyProfileValidationError';
  }
}

const ALLOWED_SEX: readonly Sex[] = ['male', 'female'];
const ALLOWED_PHASES: readonly GoalPhase[] = ['recomposition', 'fat-loss', 'gain'];

export function validateBodyProfile(input: BodyProfile): BodyProfile {
  if (!(input.weightKg > 0)) throw new BodyProfileValidationError('weightKg must be > 0');
  if (input.weightKg > 300) throw new BodyProfileValidationError('weightKg must be <= 300');
  if (!(input.heightCm > 0)) throw new BodyProfileValidationError('heightCm must be > 0');
  if (input.heightCm > 250) throw new BodyProfileValidationError('heightCm must be <= 250');
  if (!Number.isInteger(input.ageYears)) throw new BodyProfileValidationError('ageYears must be an integer');
  if (input.ageYears <= 0 || input.ageYears > 120) throw new BodyProfileValidationError('ageYears must be in (0, 120]');
  if (!ALLOWED_SEX.includes(input.sex))
    throw new BodyProfileValidationError(`sex must be one of ${ALLOWED_SEX.join(', ')}`);
  if (!ALLOWED_ACTIVITY_FACTORS.includes(input.activityFactor))
    throw new BodyProfileValidationError(`activityFactor must be one of ${ALLOWED_ACTIVITY_FACTORS.join(', ')}`);
  if (!ALLOWED_PHASES.includes(input.goalPhase))
    throw new BodyProfileValidationError(`goalPhase must be one of ${ALLOWED_PHASES.join(', ')}`);
  if (!(input.proteinPerKg > 0)) throw new BodyProfileValidationError('proteinPerKg must be > 0');
  if (input.proteinPerKg > 5) throw new BodyProfileValidationError('proteinPerKg must be <= 5');
  if (!Number.isInteger(input.fatPercent)) throw new BodyProfileValidationError('fatPercent must be an integer');
  if (input.fatPercent < 10 || input.fatPercent > 60)
    throw new BodyProfileValidationError('fatPercent must be in [10, 60]');
  if (!Number.isInteger(input.adjustmentPercent))
    throw new BodyProfileValidationError('adjustmentPercent must be an integer');
  if (input.adjustmentPercent < -40 || input.adjustmentPercent > 40)
    throw new BodyProfileValidationError('adjustmentPercent must be in [-40, 40]');
  return input;
}
