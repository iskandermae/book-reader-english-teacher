/**
 * Natural file-name order, the same rule as the backend (NaturalFileNameComparer.cs):
 * digit runs compare by value (ch2 before ch10), other characters ignore case.
 * Keep both in sync: the list the user sees must match the order the server merges the files in.
 */
export function compareNatural(x: string, y: string): number {
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (isDigit(x[i]) && isDigit(y[j])) {
      const [numX, nextI] = digitRun(x, i);
      const [numY, nextJ] = digitRun(y, j);
      // Without leading zeros a longer run is a bigger number; equal lengths compare digit by digit.
      const byNumber = numX.length - numY.length || compareCodes(numX, numY);
      if (byNumber !== 0) return byNumber;
      i = nextI;
      j = nextJ;
    } else {
      const byChar = compareCodes(x[i].toUpperCase(), y[j].toUpperCase());
      if (byChar !== 0) return byChar;
      i++;
      j++;
    }
  }
  // The shorter name (a prefix of the other) comes first.
  return x.length - i - (y.length - j);
}

const isDigit = (c: string) => c >= '0' && c <= '9';

/** Reads the digit run at `start`; returns it without leading zeros and the index after it. */
function digitRun(s: string, start: number): [string, number] {
  let end = start;
  while (end < s.length && isDigit(s[end])) end++;
  return [s.slice(start, end).replace(/^0+/, ''), end];
}

// Plain code-unit comparison (not localeCompare), so the result does not depend on the browser locale.
const compareCodes = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
