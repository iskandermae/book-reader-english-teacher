export interface TextSelection {
  /** The trimmed selected text. */
  text: string;
  /** The sentence(s) around the selection (same paragraph), or the whole paragraphs if several are selected. */
  context: string;
  /** The paragraph of the selection, or all selected paragraphs joined if several are selected. */
  paragraph: string;
}

/** Sentence end: . ! ? (possibly repeated) followed by whitespace. Deliberately simple, no NLP. */
const SENTENCE_END = /[.!?]+\s+/g;

/** The sentence(s) of `paragraph` that overlap the selected range [start, end). */
export function sentenceContext(paragraph: string, start: number, end: number): string {
  let from = 0;
  let to = paragraph.length;
  // A sentence starts where the previous one ended; the last one that starts at or before `start` is the first needed.
  for (const m of paragraph.matchAll(SENTENCE_END)) {
    const boundary = m.index + m[0].length;
    if (boundary <= start) from = boundary;
    // The first boundary at or after `end` closes the last needed sentence (a selection ending on a boundary stays inside its own sentence).
    else if (boundary >= end) {
      to = boundary;
      break;
    }
  }
  return paragraph.slice(from, to).trim();
}

/**
 * Reads the browser selection and returns it with its context, or null when there is nothing usable:
 * collapsed, whitespace only, or not entirely inside a paragraph (`p`) of `root`.
 */
export function captureSelection(selection: Selection | null, root: HTMLElement): TextSelection | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const text = range.toString().trim();
  if (!text) return null;

  const first = paragraphOf(range.startContainer, root);
  let last = paragraphOf(range.endContainer, root);
  if (!first || !last) return null;

  const all = Array.from(root.querySelectorAll('p'));
  // A triple-click ends at offset 0 of the next paragraph; nothing of that paragraph is selected, so it is not context.
  const endsBeforeLast = range.endOffset === 0 && last !== first;
  if (endsBeforeLast) last = all[all.indexOf(last) - 1];

  if (first !== last) {
    const context = all
      .slice(all.indexOf(first), all.indexOf(last) + 1)
      .map((p) => p.textContent)
      .join('\n');
    return { text, context, paragraph: context };
  }

  const paragraph = first.textContent ?? '';
  const start = offsetIn(first, range.startContainer, range.startOffset);
  const end = endsBeforeLast ? paragraph.length : offsetIn(first, range.endContainer, range.endOffset);
  return { text, context: sentenceContext(paragraph, start, end), paragraph };
}

function paragraphOf(node: Node, root: HTMLElement): HTMLParagraphElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  const p = element?.closest('p');
  return p && root.contains(p) ? p : null;
}

/** Character offset of a range boundary from the start of the paragraph's text. */
function offsetIn(paragraph: HTMLParagraphElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.setEnd(node, offset);
  return range.toString().length;
}
