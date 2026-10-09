import { cookingSearch, parseCookingSearch, type CookingSession } from './cooking-url';

const session: CookingSession = {
  recipeId: 'pasta',
  weekStart: '2026-10-12',
  batches: ['2026-10-14~b-1', '2026-10-16~b-2'],
  extra: 2,
};

describe('cooking session in the URL', () => {
  it('roundtrips recipe, week, batches and people eating along', () => {
    expect(parseCookingSearch(cookingSearch(session))).toEqual(session);
  });

  it('leaves out an empty selection and zero extra portions', () => {
    const search = cookingSearch({ ...session, batches: null, extra: 0 });

    expect(search).toBe('?cook=pasta&week=2026-10-12');
    expect(parseCookingSearch(search)).toEqual({ ...session, batches: null, extra: 0 });
  });

  it('is not a session without a recipe or a valid week', () => {
    expect(parseCookingSearch('')).toBeNull();
    expect(parseCookingSearch('?cook=pasta')).toBeNull();
    expect(parseCookingSearch('?cook=pasta&week=soon')).toBeNull();
  });

  it('drops malformed batch refs and a malformed extra count', () => {
    expect(parseCookingSearch('?cook=pasta&week=2026-10-12&b=nope,2026-10-14~b-1&extra=-3')).toEqual({
      recipeId: 'pasta',
      weekStart: '2026-10-12',
      batches: ['2026-10-14~b-1'],
      extra: 0,
    });
  });
});
