"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { regenerateToc, saveTocEntries } from "@/actions/toc";
import type { HeadingSensitivity } from "@/lib/pdf/detectHeadings.server";
import type { BookRow, TocEntryRow, TocKind } from "@/lib/db/types";

interface EditableRow {
  id: string;
  title: string;
  startPage: number;
  kind: TocKind;
  isChild: boolean;
}

const KIND_OPTIONS: { value: TocKind; label: string }[] = [
  { value: "chapter", label: "Chapter" },
  { value: "section", label: "Section" },
  { value: "exercises", label: "Exercises" },
  { value: "review", label: "Review" },
  { value: "reading", label: "Reading" },
  { value: "other", label: "Other" },
];

const SENSITIVITY_OPTIONS: { value: HeadingSensitivity; label: string; hint: string }[] = [
  { value: "fewer", label: "Fewer", hint: "Only clearly larger headings — misses subtler ones" },
  { value: "balanced", label: "Balanced", hint: "Default" },
  { value: "more", label: "More", hint: "Catches subtler headings — more noise" },
];

function toEditableRows(entries: TocEntryRow[]): EditableRow[] {
  // The v1 editor only shows two levels: a row is a "child" if it has any
  // parent at all, nested under whichever top-level row precedes it.
  return entries.map((e) => ({
    id: e.id,
    title: e.title,
    startPage: e.start_page,
    kind: e.kind,
    isChild: e.parent_id !== null,
  }));
}

/** Row 0 can never be a child — nothing precedes it to attach to. */
function sanitize(rows: EditableRow[]): EditableRow[] {
  if (rows.length === 0 || !rows[0].isChild) return rows;
  return rows.map((r, i) => (i === 0 ? { ...r, isChild: false } : r));
}

export function TocEditorClient({
  book,
  initialEntries,
}: {
  book: BookRow;
  initialEntries: TocEntryRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditableRow[]>(() => toEditableRows(initialEntries));
  const [error, setError] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<HeadingSensitivity>("balanced");
  const [minPage, setMinPage] = useState(1);
  const [restrictToTopOfPage, setRestrictToTopOfPage] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRegenerating, startRegenerating] = useTransition();

  function updateRow(index: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [
      { id: crypto.randomUUID(), title: "", startPage: 1, kind: "section", isChild: false },
      ...prev,
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => sanitize(prev.filter((_, i) => i !== index)));
  }

  function moveRow(index: number, direction: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return sanitize(next);
    });
  }

  function handleSave() {
    setError(null);
    let lastTopLevelId: string | null = null;
    const payload = rows.map((row) => {
      const parentId = row.isChild ? lastTopLevelId : null;
      if (!row.isChild) lastTopLevelId = row.id;
      return {
        id: row.id,
        parentId,
        title: row.title,
        startPage: row.startPage,
        kind: row.kind,
      };
    });

    startTransition(async () => {
      try {
        await saveTocEntries(book.id, payload);
        router.push(`/books/${book.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  }

  function handleRegenerate() {
    if (
      !confirm(
        "Re-detect chapters/sections from the PDF at this sensitivity? This replaces every entry below — any edits you've made since the last save are lost.",
      )
    ) {
      return;
    }
    setError(null);
    startRegenerating(async () => {
      try {
        const fresh = await regenerateToc(book.id, sensitivity, minPage, restrictToTopOfPage);
        setRows(toEditableRows(fresh));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't regenerate.");
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div>
            <h1 className="text-lg font-medium">Edit contents — {book.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page numbers are the physical position in the PDF (1–{book.page_count}), not the
              book&apos;s own printed page numbers.
            </p>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="self-start rounded border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            + Add entry
          </button>

          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={row.id} className={`flex items-center gap-2 ${row.isChild ? "ml-6" : ""}`}>
                <div className="flex shrink-0 flex-col leading-none">
                  <button
                    type="button"
                    onClick={() => moveRow(index, -1)}
                    disabled={index === 0}
                    className="text-xs text-slate-400 hover:text-slate-800 disabled:opacity-30 dark:hover:text-slate-200"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(index, 1)}
                    disabled={index === rows.length - 1}
                    className="text-xs text-slate-400 hover:text-slate-800 disabled:opacity-30 dark:hover:text-slate-200"
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => updateRow(index, { isChild: !row.isChild })}
                  disabled={index === 0}
                  title={row.isChild ? "Outdent" : "Indent"}
                  className="shrink-0 rounded border border-slate-300 px-1.5 py-1 text-xs hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-900"
                >
                  {row.isChild ? "⇤" : "⇥"}
                </button>
                <input
                  type="text"
                  value={row.title}
                  onChange={(event) => updateRow(index, { title: event.target.value })}
                  placeholder="Title"
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <input
                  type="number"
                  min={1}
                  max={book.page_count}
                  value={row.startPage}
                  onChange={(event) =>
                    updateRow(index, { startPage: parseInt(event.target.value, 10) || 1 })
                  }
                  className="w-16 shrink-0 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <select
                  value={row.kind}
                  onChange={(event) => updateRow(index, { kind: event.target.value as TocKind })}
                  className="shrink-0 rounded border border-slate-300 px-1.5 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="shrink-0 rounded px-2 py-1 text-sm text-slate-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            ))}
            {rows.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No entries yet — add your first chapter above.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/books/${book.id}`)}
            className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
          >
            Cancel
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h2 className="text-sm font-medium">Too many (or too few) sections?</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adjust detection sensitivity and re-scan the PDF, instead of deleting entries one by
            one.
          </p>
          <fieldset className="flex flex-col gap-1.5">
            {SENSITIVITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-2 text-sm has-[:checked]:font-medium"
              >
                <input
                  type="radio"
                  name="sensitivity"
                  value={opt.value}
                  checked={sensitivity === opt.value}
                  onChange={() => setSensitivity(opt.value)}
                  className="mt-0.5"
                />
                <span>
                  {opt.label}
                  <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                    {opt.hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            Skip pages before
            <input
              type="number"
              min={1}
              max={book.page_count}
              value={minPage}
              onChange={(event) => setMinPage(parseInt(event.target.value, 10) || 1)}
              className="w-20 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            />
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Title/copyright pages often have decorative text far bigger than any real
              heading — no sensitivity setting can tell those apart by size. Skipping straight
              to where the real content starts fixes it directly.
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={restrictToTopOfPage}
              onChange={(event) => setRestrictToTopOfPage(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              Only consider text near the top of each page
              <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                Ignores large text elsewhere on the page (boxed formulas, figure captions) even
                if it would otherwise look heading-sized. Best for books where real headings
                reliably start at the top — may miss headings that start mid-page.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            {isRegenerating ? "Re-scanning…" : "Regenerate from PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
