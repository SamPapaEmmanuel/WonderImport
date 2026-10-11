import { resolvePeriod } from './period';

describe('resolvePeriod', () => {
  const now = new Date('2026-10-08T15:30:00Z');

  it('last 30 days includes today', () => {
    expect(resolvePeriod('30d', {}, now)).toEqual({ key: '30d', from: '2026-09-09', to: '2026-10-08', label: 'Last 30 days' });
  });

  it('last 90 days', () => {
    expect(resolvePeriod('90d', {}, now)).toMatchObject({ from: '2026-07-11', to: '2026-10-08' });
  });

  it('year to date starts on 1 January', () => {
    expect(resolvePeriod('ytd', {}, now)).toMatchObject({ from: '2026-01-01', to: '2026-10-08' });
  });

  it('all time is open-ended', () => {
    expect(resolvePeriod('all', {}, now)).toMatchObject({ from: null, to: null });
  });

  it('custom bounds win over a preset', () => {
    expect(resolvePeriod('30d', { from: '2026-06-01', to: '2026-06-30' }, now)).toEqual({ key: 'custom', from: '2026-06-01', to: '2026-06-30', label: 'Custom range' });
  });
});
