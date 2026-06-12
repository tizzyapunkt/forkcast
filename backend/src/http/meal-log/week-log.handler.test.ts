import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { makeGetWeekLogHandler } from './get-week-log.handler.ts';
import { makeCopyLogDayHandler } from './copy-log-day.handler.ts';
import type { LogEntryRepository } from '../../domain/meal-log/log-entry.repository.ts';
import type { LogEntry, WeekLog } from '../../domain/meal-log/types.ts';

function makeRepo(byDate: Record<string, LogEntry[]> = {}): { repo: LogEntryRepository; saved: LogEntry[] } {
  const saved: LogEntry[] = [];
  const repo: LogEntryRepository = {
    save: vi.fn<(e: LogEntry) => Promise<void>>(),
    saveMany: vi.fn<(e: LogEntry[]) => Promise<void>>().mockImplementation(async (e) => {
      saved.push(...e);
    }),
    findAll: vi.fn<() => Promise<LogEntry[]>>().mockResolvedValue(Object.values(byDate).flat()),
    findByDate: vi.fn<(d: string) => Promise<LogEntry[]>>().mockImplementation(async (d) => byDate[d] ?? []),
    findById: vi.fn<(id: string) => Promise<LogEntry | null>>().mockResolvedValue(null),
    update: vi.fn<(e: LogEntry) => Promise<void>>(),
    remove: vi.fn<(id: string) => Promise<void>>(),
    removeMany: vi.fn<(ids: string[]) => Promise<void>>(),
  };
  return { repo, saved };
}

function makeApp(repo: LogEntryRepository) {
  const app = new Hono();
  app.get('/week-log/:startDate', makeGetWeekLogHandler(repo));
  app.post('/copy-log-day', makeCopyLogDayHandler(repo));
  return app;
}

describe('GET /week-log/:startDate', () => {
  it('returns 200 with seven days', async () => {
    const { repo } = makeRepo();
    const res = await makeApp(repo).request('/week-log/2026-06-08');
    expect(res.status).toBe(200);
    const body = (await res.json()) as WeekLog;
    expect(body.startDate).toBe('2026-06-08');
    expect(body.days).toHaveLength(7);
  });

  it('returns 400 for a malformed startDate', async () => {
    const { repo } = makeRepo();
    const res = await makeApp(repo).request('/week-log/not-a-date');
    expect(res.status).toBe(400);
  });
});

describe('POST /copy-log-day', () => {
  const sourceEntry: LogEntry = {
    id: 'a',
    date: '2026-06-08',
    slot: 'lunch',
    loggedAt: '2026-06-08T08:00:00.000Z',
    ingredient: {
      type: 'full',
      name: 'Reis',
      unit: 'g',
      macrosPerUnit: { calories: 1, protein: 0, carbs: 0, fat: 0 },
      amount: 100,
    },
  };

  it('copies a day onto the next and returns 201 with the clones', async () => {
    const { repo, saved } = makeRepo({ '2026-06-08': [sourceEntry] });
    const res = await makeApp(repo).request('/copy-log-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDate: '2026-06-08', toDate: '2026-06-09' }),
    });
    expect(res.status).toBe(201);
    const clones = (await res.json()) as LogEntry[];
    expect(clones).toHaveLength(1);
    expect(clones[0]!.date).toBe('2026-06-09');
    expect(saved).toHaveLength(1);
  });

  it('returns 400 for an invalid body', async () => {
    const { repo } = makeRepo();
    const res = await makeApp(repo).request('/copy-log-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromDate: 'x' }),
    });
    expect(res.status).toBe(400);
  });
});
