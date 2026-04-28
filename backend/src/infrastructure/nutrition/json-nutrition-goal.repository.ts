import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DailyGoal } from '../../domain/nutrition/types.ts';
import type { NutritionGoalRepository } from '../../domain/nutrition/nutrition-goal.repository.ts';

export class JsonNutritionGoalRepository implements NutritionGoalRepository {
  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  async save(goal: DailyGoal): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(goal, null, 2), 'utf-8');
  }

  async get(): Promise<DailyGoal | null> {
    if (!existsSync(this.filePath)) return null;
    const raw = await readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as DailyGoal;
  }
}
