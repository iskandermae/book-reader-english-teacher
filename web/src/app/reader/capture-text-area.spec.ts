import { captureTextAreaSelection } from './capture-text-area';

describe('captureTextAreaSelection', () => {
  const value = 'Alpha one. Beta two.\nGamma three.\nDelta four.';
  const at = (s: string) => value.indexOf(s);

  it('captures the trimmed text with its sentence', () => {
    expect(captureTextAreaSelection(value, at('Beta t'), at('Beta t') + 6)).toEqual({ text: 'Beta t', context: 'Beta two.' });
  });

  it('returns null for a collapsed or whitespace-only selection', () => {
    expect(captureTextAreaSelection(value, 3, 3)).toBeNull();
    expect(captureTextAreaSelection('a   b', 1, 4)).toBeNull();
  });

  it('trims the selection', () => {
    expect(captureTextAreaSelection(value, at('Beta') - 1, at('Beta') + 5)).toEqual({ text: 'Beta', context: 'Beta two.' });
  });

  it('returns the whole paragraphs when several are selected', () => {
    expect(captureTextAreaSelection(value, at('two'), at('Delta') + 2)).toEqual({
      text: 'two.\nGamma three.\nDe',
      context: value,
    });
  });

  it('does not add the next paragraph when the selection ends with a line break (triple-click)', () => {
    const line = 'Gamma three.\n';
    expect(captureTextAreaSelection(value, at('Gamma'), at('Gamma') + line.length)).toEqual({
      text: 'Gamma three.',
      context: 'Gamma three.',
    });
  });

  it('works on the last paragraph and on a single paragraph without a line break', () => {
    expect(captureTextAreaSelection(value, at('four'), value.length)).toEqual({ text: 'four.', context: 'Delta four.' });
    expect(captureTextAreaSelection('Just text.', 0, 4)).toEqual({ text: 'Just', context: 'Just text.' });
  });
});
