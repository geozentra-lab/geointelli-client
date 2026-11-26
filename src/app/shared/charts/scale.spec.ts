import { axisMoney, linear, timeTicks, zeroBasedTicks } from './scale';

const utc = (y: number, m = 0, d = 1) => new Date(Date.UTC(y, m, d));

describe('Chart scales', () => {
  it('starts money and counts at zero with three to five round ticks', () => {
    expect(zeroBasedTicks(1_180_000)).toEqual([0, 500_000, 1_000_000, 1_500_000]);
    expect(zeroBasedTicks(985_000)).toEqual([0, 250_000, 500_000, 750_000, 1_000_000]);
    expect(zeroBasedTicks(7, 4)).toEqual([0, 2, 4, 6, 8]);
    expect(zeroBasedTicks(0)).toEqual([0, 1]);
    for (const max of [12, 99_000, 612_000, 2_400_000]) {
      const ticks = zeroBasedTicks(max);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)!).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(5);
    }
  });

  it('writes axis money compactly', () => {
    expect([0, 950, 400_000, 1_200_000, 15_000_000].map(axisMoney)).toEqual([
      '$0',
      '$950',
      '$400K',
      '$1.2M',
      '$15M',
    ]);
  });

  it('puts time ticks on calendar years: every 2 on desktop, every 5 on phones', () => {
    const from = utc(2006, 5, 20);
    const to = utc(2027, 4, 1);
    expect(timeTicks(from, to, 900).map((t) => t.label)).toEqual([
      '2008', '2010', '2012', '2014', '2016', '2018', '2020', '2022', '2024', '2026',
    ]);
    expect(timeTicks(from, to, 320).map((t) => t.label)).toEqual(['2010', '2015', '2020', '2025']);
  });

  it('uses months when the span is under two years', () => {
    const labels = timeTicks(utc(2025, 10, 15), utc(2026, 9, 1), 900).map((t) => t.label);
    expect(labels).toEqual(['Dec', '2026', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
  });

  it('maps linearly, and a flat domain to the middle', () => {
    expect(linear(0, 10, 100, 200)(5)).toBe(150);
    expect(linear(3, 3, 0, 40)(3)).toBe(20);
  });
});
