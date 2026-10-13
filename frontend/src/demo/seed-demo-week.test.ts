import { InMemoryJsonDocument } from '../../../backend/src/infrastructure/json-document/in-memory-json-document.ts';
import { buildDemoApp, seedCallFor } from './demo-app';
import { seedDemoWeek } from './seed-demo-week';

interface WeekLog {
  days: { date: string; totals: { calories: number } }[];
}

async function seededApp(locale: 'de' | 'en') {
  const app = await buildDemoApp((name) => new InMemoryJsonDocument(null, name));
  const { weekStart } = await seedDemoWeek(seedCallFor(app), { locale });
  return { app, weekStart };
}

describe('seedDemoWeek', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it.each([
    ['en', 'Red Lentil Dal'],
    ['de', 'Linsen-Dal'],
  ] as const)('plans all seven days with %s recipe names', async (locale, dal) => {
    const { app, weekStart } = await seededApp(locale);

    const week = (await (await app.request(`/week-log/${weekStart}`)).json()) as WeekLog;
    expect(week.days).toHaveLength(7);
    for (const day of week.days) expect(day.totals.calories).toBeGreaterThan(1500);

    const recipes = (await (await app.request('/recipes')).json()) as { name: string }[];
    expect(recipes.map((r) => r.name)).toContain(dal);
  });
});
