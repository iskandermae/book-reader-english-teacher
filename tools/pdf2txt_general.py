"""Convert an arbitrary PDF into a .txt file that the Book Reader app can import.

Usage:    python tools/pdf2txt_general.py in.pdf [out.txt]     (default out: in.txt next to the PDF)
Requires: pip install pypdf

Extracts text page-by-page, joins wrapped lines within paragraphs, preserves paragraph
breaks (separated by a blank line), and writes UTF-8 text.
"""
import logging
import re
import sys
from pathlib import Path

from pypdf import PdfReader

logging.getLogger("pypdf").setLevel(logging.ERROR)


def clean_page_text(raw_text):
    """Normalize line endings and split page text into paragraphs."""
    if not raw_text:
        return []
    # Normalize line endings
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    # Split by two or more newlines to identify paragraphs
    blocks = re.split(r"\n\s*\n+", text)
    paragraphs = []
    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        # Join lines within a paragraph with spaces, handling basic hyphenation
        para = ""
        for line in lines:
            if not para:
                para = line
            elif para.endswith("-") and len(para) > 1 and para[-2].isalpha() and line[0].isalpha():
                para = para[:-1] + line
            else:
                para += " " + line
        # Collapse multiple spaces
        para = re.sub(r"[ \t]+", " ", para).strip()
        if para:
            paragraphs.append(para)
    return paragraphs


def convert(pdf_path):
    reader = PdfReader(pdf_path)
    all_paragraphs = []

    for page in reader.pages:
        # Extract text using default mode
        text = page.extract_text()
        if not text:
            continue
        paragraphs = clean_page_text(text)
        all_paragraphs.extend(paragraphs)

    # Separate paragraphs by a blank line
    return "\n\n".join(all_paragraphs) + ("\n" if all_paragraphs else "")


def main(argv):
    if not 2 <= len(argv) <= 3:
        raise SystemExit(__doc__)
    pdf = Path(argv[1])
    if not pdf.is_file():
        raise SystemExit(f"Error: file not found: {pdf}")
    out = Path(argv[2]) if len(argv) == 3 else pdf.with_suffix(".txt")
    text = convert(str(pdf))
    out.write_text(text, encoding="utf-8")
    print(f"{out}: converted {len(PdfReader(str(pdf)).pages)} pages to {len(text.splitlines())} lines")


if __name__ == "__main__":
    main(sys.argv)
