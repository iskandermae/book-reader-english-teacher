import { sentenceContext, TextSelection } from './capture-selection';

/**
 * Same result and rules as `captureSelection`, for a plain text (a text area's value) where
 * paragraphs are the lines. `start`/`end` are the area's selectionStart/selectionEnd.
 * Returns null when nothing but whitespace (or nothing) is selected.
 */
export function captureTextAreaSelection(value: string, start: number, end: number): TextSelection | null {
  const raw = value.slice(start, end);
  const text = raw.trim();
  if (!text) return null;
  // Work on the trimmed range: a triple-click also selects the line break, which must not pull in the next paragraph.
  const from = start + (raw.length - raw.trimStart().length);
  const to = from + text.length;

  const lines: { text: string; offset: number }[] = [];
  let offset = 0;
  for (const line of value.split('\n')) {
    lines.push({ text: line, offset });
    offset += line.length + 1;
  }
  // The trimmed range starts and ends on non-whitespace, so both ends lie inside a line.
  const inside = (position: number) => lines.findIndex((l) => position >= l.offset && position <= l.offset + l.text.length);
  const first = inside(from);
  const last = inside(to - 1);

  if (first !== last) {
    const context = lines.slice(first, last + 1).map((l) => l.text).join('\n');
    return { text, context, paragraph: context };
  }
  const line = lines[first];
  return { text, context: sentenceContext(line.text, from - line.offset, to - line.offset), paragraph: line.text };
}
