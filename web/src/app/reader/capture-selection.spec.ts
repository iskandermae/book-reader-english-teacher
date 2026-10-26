import { captureSelection, sentenceContext } from './capture-selection';

describe('sentenceContext', () => {
  const text = 'First one. Second one! Third one? Last one.';
  const at = (s: string) => text.indexOf(s);

  it('returns the only sentence', () => {
    expect(sentenceContext('Just one sentence.', 5, 8)).toBe('Just one sentence.');
  });

  it('returns the middle sentence', () => {
    expect(sentenceContext(text, at('one!'), at('one!') + 3)).toBe('Second one!');
  });

  it('returns the first and the last sentence', () => {
    expect(sentenceContext(text, 0, 5)).toBe('First one.');
    expect(sentenceContext(text, at('Last'), text.length)).toBe('Last one.');
  });

  it('keeps a selection that ends right after a sentence end in that sentence', () => {
    expect(sentenceContext(text, 0, at('Second'))).toBe('First one.');
  });

  it('starts at the sentence when the selection begins exactly at its start', () => {
    expect(sentenceContext(text, at('Second'), at('Second') + 3)).toBe('Second one!');
  });

  it('returns the whole paragraph when it has no punctuation', () => {
    expect(sentenceContext('no punctuation here', 3, 6)).toBe('no punctuation here');
  });

  it('joins sentences when the selection spans several', () => {
    expect(sentenceContext(text, at('one!'), at('Third') + 2)).toBe('Second one! Third one?');
  });
});

describe('captureSelection', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML =
      '<article><p>Alpha one. Beta two.</p><p>Gamma three.</p><p>Delta four.</p></article><aside>Menu</aside>';
    root = document.querySelector('article')!;
  });

  /** Selects [from, to) of the text node of the nth element matching `selector`. */
  function select(selector: string, from: number, to: number, endSelector = selector) {
    const range = document.createRange();
    range.setStart(document.querySelector(selector)!.firstChild!, from);
    range.setEnd(document.querySelector(endSelector)!.firstChild!, to);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
  }

  it('captures the trimmed text with its sentence', () => {
    expect(captureSelection(select('p', 11, 17), root)).toEqual({ text: 'Beta t', context: 'Beta two.' });
  });

  it('uses the full paragraphs for a multi-paragraph selection', () => {
    const selection = select('p', 6, 3, 'p:nth-child(2)');
    expect(captureSelection(selection, root)).toEqual({
      text: 'one. Beta two.Gam',
      context: 'Alpha one. Beta two.\nGamma three.',
    });
  });

  it('does not include the next paragraph when the selection ends at its offset 0 (triple-click)', () => {
    const range = document.createRange();
    range.setStart(document.querySelector('p')!.firstChild!, 0);
    range.setEnd(document.querySelector('p:nth-child(2)')!.firstChild!, 0);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    expect(captureSelection(selection, root)).toEqual({ text: 'Alpha one. Beta two.', context: 'Alpha one. Beta two.' });
  });

  it('ignores a whitespace-only selection', () => {
    expect(captureSelection(select('p', 5, 6), root)).toBeNull();
  });

  it('ignores a collapsed selection', () => {
    expect(captureSelection(select('p', 2, 2), root)).toBeNull();
  });

  it('ignores a selection outside the chapter text', () => {
    expect(captureSelection(select('aside', 0, 4), root)).toBeNull();
  });
});
