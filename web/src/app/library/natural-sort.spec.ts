import { compareNatural } from './natural-sort';

describe('compareNatural', () => {
  const sort = (names: string[]) => [...names].sort(compareNatural);

  it('orders digit runs by value', () => {
    expect(sort(['ch10.txt', 'ch2.txt', 'ch1.txt'])).toEqual(['ch1.txt', 'ch2.txt', 'ch10.txt']);
  });

  it('ignores case', () => {
    expect(sort(['b.txt', 'A.txt', 'c.txt'])).toEqual(['A.txt', 'b.txt', 'c.txt']);
  });

  it('puts a prefix first and treats leading zeros as equal numbers', () => {
    expect(sort(['a10', 'a', 'a02', 'a2x'])).toEqual(['a', 'a02', 'a2x', 'a10']);
  });
});
