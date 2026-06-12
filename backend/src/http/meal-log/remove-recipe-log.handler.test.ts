import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { makeRemoveRecipeLogHandler } from './remove-recipe-log.handler.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';
import type { LogEntry } from '../../domain/meal-log/types.ts';

function entry(id: string, batchId?: string): LogEntry {
  return {
    id,
    date: '2026-06-11',
    slot: 'lunch',
    loggedAt: '2026-06-11T12:00:00.000Z',
    ...(batchId !== undefined ? { recipeId: 'rec-1', recipeBatchId: batchId, recipePortions: 1 } : {}),
    ingredient: {
      type: 'full',
      name: 'Rice',
      unit: 'g',
      macrosPerUnit: { calories: 1.3, protein: 0.027, carbs: 0.28, fat: 0.003 },
      amount: 100,
    },
  };
}

function makeApp(all: LogEntry[]): { app: Hono; removed: string[][] } {
  const removed: string[][] = [];
  const repo: LogEntryRepository = {
    save: vi.fn<(e: LogEntry) => Promise<void>>(),
    saveMany: vi.fn<(e: LogEntry[]) => Promise<void>>(),
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue(all),
    findByDate: vi.fn<(d: string) => Promise<LogEntry[]>>(),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>(),
    update: vi.fn<(e: LogEntry) => Promise<void>>(),
    remove: vi.fn<(id: string) => Promise<void>>(),
    removeMany: vi.fn<(ids: string[]) => Promise<void>>().mockImplementation(async (ids) => {
      removed.push(ids);
    }),
  };
  const app = new Hono();
  app.post('/remove-recipe-log', makeRemoveRecipeLogHandler(repo));
  return { app, removed };
}

describe('POST /remove-recipe-log', () => {
  it('removes the batch and returns the removed count', async () => {
    const { app, removed } = makeApp([entry('a', 'batch-1'), entry('b', 'batch-1'), entry('c', 'batch-2')]);

    const res = await app.request('/remove-recipe-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipeBatchId: 'batch-1' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 2 });
    expect(removed).toEqual([['a', 'b']]);
  });

  it('returns 404 for an unknown batch id and removes nothing', async () => {
    const { app, removed } = makeApp([entry('a', 'batch-1')]);

    const res = await app.request('/remove-recipe-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipeBatchId: 'missing' }),
    });

    expect(res.status).toBe(404);
    expect(removed).toEqual([]);
  });

  it('returns 400 when recipeBatchId is missing', async () => {
    const { app, removed } = makeApp([entry('a', 'batch-1')]);

    const res = await app.request('/remove-recipe-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    expect(removed).toEqual([]);
  });
});
