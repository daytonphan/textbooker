# Textbooker

Turns a PDF textbook into a navigable table of contents. This will include chapters, sections,
exercises, and readings, made to be auto-detected and jumpable, along with bookmarks and
resume-last-position.

This is the local-only MVP. Everything runs on your machine (`npm run dev`),
with a SQLite database and PDFs stored under `data/` (gitignored). Please see "What's next" below.

## Running it

```bash
npm install   # also copies the pdf.js worker into public/ via postinstall
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Upload a PDF, and it'll try
to auto-detect chapters/sections/exercises/readings from the file itself. You can
inspect and fix the result any time from a book's "Edit contents" link.

## How structure detection works

Two layers, merged (`src/lib/pdf/mergeToc.ts`):

1. **Embedded outline** (`src/lib/pdf/extractOutline.server.ts`) — the PDF's
   own bookmark tree, when it has one.
2. **Heuristic heading scan** (`src/lib/pdf/detectHeadings.server.ts`) — scans
   every page's text for short, large, or keyword-matching lines (regex
   ruleset in `src/lib/pdf/classify.ts`) to catch exercises/review/reading
   sections.

The manual editor at `/books/[id]/toc` is the
correction path as this is not perfect.

## What's next (deferred and not built yet)

Phone access, cloud storage/deploy, and a lightweight access gate were
researched but intentionally left out of this MVP to keep the first version
focused on getting structure detection right against a real textbook.