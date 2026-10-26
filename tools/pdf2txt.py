"""Convert a book-style PDF into a .txt that the Book Reader app can import.

Usage:    python tools/pdf2txt.py in.pdf [out.txt]     (default out: in.txt next to the PDF)
Requires: pip install pypdf

Output: one "Chapter N: Title" line per chapter (matches the app's default chapter regex),
paragraphs separated by a blank line. Text before the first chapter (title page, contents,
preface) is dropped. Tuned for the hpmor.com e-book PDF layout: "CHAPTER <WORD>" headings,
a contents page with the clean titles, indented paragraphs, "*** ... ***" running headers.
"""
import logging
import re
import sys
from collections import namedtuple
from pathlib import Path

from pypdf import PdfReader

logging.getLogger("pypdf").setLevel(logging.ERROR)  # "Rotated text discovered" noise

NUMBERS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN",
           "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN",
           "EIGHTEEN", "NINETEEN", "TWENTY"]

SMALL_WORDS = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to"}

# Running headers ("*** CHAPTER 1 ***") and page numbers ("* 12 *") repeated on every page.
HEADER_RE = re.compile(r"^\*.*\*$")
# The PDF font spaces out capitals ("CHAPTER FI V E"), so squash spaces before looking up the number.
CHAPTER_RE = re.compile(r"^CHAPTER\s+(.+)$")
TOC_ENTRY_RE = re.compile(r"^(.+?)\s*—\s*\d+$")
# Kerning gap inside a word: "P otter" -> "Potter" (A and I are real words, leave them).
KERNING_RE = re.compile(r"\b([B-HJ-Z]) (?=[a-z]{2})")
DROP_CAP_RE = re.compile(r"[“\"]?[A-Z]?")  # the big first letter of a chapter, extracted as its own line
KEY_LEN = 8
END_MARKER = "This book was formatted by"  # colophon page after the last chapter

Line = namedtuple("Line", "text new_paragraph keys")


def letters(text):
    return re.sub(r"[\W_]", "", text).lower()


def number_of(text):
    word = re.sub(r"\s", "", text)
    return NUMBERS.index(word) + 1 if word in NUMBERS else None


def is_header(line):
    return bool(HEADER_RE.match(re.sub(r"\s+", " ", line.strip())))


def page_lines(page):
    """Lines of one page with headers/footers removed and paragraph starts marked.

    The plain extraction gives clean text but loses layout; the layout extraction shows indents
    and gaps (paragraph starts) but squashes some words. So each layout line is matched to a plain line.
    """
    plain = []
    carry = ""  # drop cap letters waiting for the line they belong to
    for raw in (page.extract_text() or "").splitlines():
        raw = raw.strip()
        if not raw or is_header(raw):
            continue
        if DROP_CAP_RE.fullmatch(raw):
            carry += raw
            continue
        text = carry + raw
        # The layout line of a drop-cap paragraph lacks the first letter(s), so accept both keys.
        keys = {letters(text)[:KEY_LEN], letters(text)[len(letters(carry)):][:KEY_LEN]}
        plain.append(Line(text, bool(carry), keys))
        carry = ""

    pos = 0
    gap_before = False
    for raw in (page.extract_text(extraction_mode="layout") or "").splitlines():
        if not raw.strip():
            gap_before = True
            continue
        if is_header(raw):
            continue
        indented = raw.startswith("  ")
        key = letters(raw)[:KEY_LEN]
        for i in range(pos, min(pos + 3, len(plain))):  # small window: skip unmatched layout lines safely
            if key in plain[i].keys:
                if indented or gap_before:
                    plain[i] = plain[i]._replace(new_paragraph=True)
                pos = i + 1
                break
        gap_before = False
    return plain


def contents_titles(reader):
    """Chapter titles from the contents page: a number-word line followed by 'Title — page'."""
    titles = {}
    for page in reader.pages[:20]:
        previous = None
        for line in (page.extract_text(extraction_mode="layout") or "").splitlines():
            line = line.strip()
            entry = TOC_ENTRY_RE.match(line)
            if entry and previous and number_of(previous):
                titles[number_of(previous)] = entry.group(1).strip()
            previous = line or previous
    return titles


def title_case(title):
    """The contents page uses small caps ("part ii", "To"); normalise to "Part II" and lowercase small words."""
    words = []
    for i, word in enumerate(title.split()):
        if re.fullmatch(r"[ivx]+", word, re.I):
            word = word.upper()
        elif word.lower() == "part":
            word = "Part"
        elif i > 0 and word.lower() in SMALL_WORDS:
            word = word.lower()
        words.append(word)
    return " ".join(words)


def unwrap_hyphens(prev, nxt, vocab):
    """Join 'de-' + 'code' as 'decode', but keep the hyphen for compounds seen elsewhere ('well-known')."""
    stem, first = re.search(r"([A-Za-z]+)-$", prev), re.match(r"[a-z]+", nxt)
    if not stem or not first:
        return prev + " " + nxt
    joined = (stem.group(1) + first.group(0)).lower()
    hyphenated = stem.group(1).lower() + "-" + first.group(0)
    if joined in vocab:
        return prev[:-1] + nxt
    # Unknown joined word: a compound if both halves are real words ("emerald-green"), else a split word ("fa-miliar").
    both_known = stem.group(1).lower() in vocab and first.group(0) in vocab
    return prev + nxt if hyphenated in vocab or both_known else prev[:-1] + nxt


def convert(pdf_path):
    reader = PdfReader(pdf_path)
    lines = [l for page in reader.pages for l in page_lines(page)]
    titles = contents_titles(reader)
    # Words seen in the body, used to decide whether a line-end hyphen is part of a compound word.
    vocab = {w.lower() for l in lines for w in re.findall(r"[A-Za-z]+(?:-[A-Za-z]+)*", l.text)}
    vocab |= {part for word in list(vocab) for part in [word.replace("-", "")] if "-" in word}

    out, started = [], False
    chapter_no = 0
    current = ""

    def flush():
        nonlocal current
        if current.strip():
            out.extend([clean(current), ""])
        current = ""

    skipping_title = False
    for line in lines:
        heading = CHAPTER_RE.match(line.text)
        if heading and number_of(heading.group(1)):
            flush()
            chapter_no = number_of(heading.group(1))
            out.extend([f"Chapter {chapter_no}: {title_case(titles.get(chapter_no, ''))}".rstrip(": "), ""])
            started = skipping_title = True
            continue
        if not started:
            continue  # front matter
        if line.text.startswith(END_MARKER):
            break  # colophon after the last chapter
        # The spaced-out all-caps title follows the heading; the contents page gave the clean one.
        if skipping_title and len(line.text) > 1 and line.text == line.text.upper():
            continue
        skipping_title = False
        if current and not line.new_paragraph:
            if current.endswith("-"):
                current = unwrap_hyphens(current, line.text, vocab)
            else:  # an em dash at a line end needs no space after it
                current += ("" if current.endswith("—") else " ") + line.text
        else:
            flush()
            current = line.text
    flush()
    return "\n".join(out).rstrip() + "\n"


def clean(text):
    text = re.sub(r"\s+", " ", KERNING_RE.sub(r"\1", text)).strip()
    return re.sub(r"([“‘]) ", r"\1", text)  # stray gap after an opening quote


def main(argv):
    if not 2 <= len(argv) <= 3:
        raise SystemExit(__doc__)
    pdf = Path(argv[1])
    out = Path(argv[2]) if len(argv) == 3 else pdf.with_suffix(".txt")
    text = convert(str(pdf))
    out.write_text(text, encoding="utf-8")
    print(f"{out}: {len(re.findall(r'^Chapter \d+', text, re.M))} chapters")


if __name__ == "__main__":
    main(sys.argv)
