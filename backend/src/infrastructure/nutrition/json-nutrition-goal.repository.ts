import type { DailyGoal } from '../../domain/nutrition/types.ts';
import type { NutritionGoalRepository } from '../../domain/nutrition/nutrition-goal.repository.ts';
import type { JsonDocument } from '../json-document/json-document.ts';

export class JsonNutritionGoalRepository implements NutritionGoalRepository {
  constructor(private readonly document: JsonDocument) {}

  async save(goal: DailyGoal): Promise<void> {
    await this.document.write(JSON.stringify(goal, null, 2));
  }

  async get(): Promise<DailyGoal | null> {
    const raw = await this.document.read();
    if (raw === null) return null;
    return JSON.parse(raw) as DailyGoal;
  }
}
