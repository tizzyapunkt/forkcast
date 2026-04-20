import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { DailyGoal } from '../../domain/nutrition/types.js';
import type { NutritionGoalRepository } from '../../domain/nutrition/nutrition-goal.repository.js';

export class JsonNutritionGoalRepository implements NutritionGoalRepository {
  constructor(private readonly filePath: string) {}

  async save(goal: DailyGoal): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(goal, null, 2), 'utf-8');
  }

  async get(): Promise<DailyGoal | null> {
    if (!existsSync(this.filePath)) return null;
    const raw = await readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as DailyGoal;
  }
}
