"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { BookRow, BookmarkRow, TocEntryRow } from "@/lib/db/types";
import { buildTocTree, findCurrentEntry, findNextEntryOfKind } from "@/lib/pdf/tocTree";
import { TocSidebar } from "@/components/reader/TocSidebar";
import { PdfViewer } from "@/components/reader/PdfViewer";
import { ReflowView } from "@/components/reader/ReflowView";
import { updateReadingProgress } from "@/actions/books";
import { removeBookmarkAction, toggleBookmark } from "@/actions/bookmarks";

const VIEW_MODE_KEY = "textbooker:view-mode";
type ViewMode = "page" | "text";

export function ReaderClient({
  book,
  tocEntries,
  bookmarks: initialBookmarks,
}: {
  book: BookRow;
  tocEntries: TocEntryRow[];
  bookmarks: BookmarkRow[];
}) {
  const [currentPage, setCurrentPage] = useState(book.last_page_read);
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("page");
  const [, startTransition] = useTransition();

  // Client-only: window/localStorage don't exist during the server-rendered
  // pass, so this runs after mount rather than as a lazy useState initializer
  // (which would create a hydration mismatch against the server-rendered HTML).
  // This is a one-time read of genuine external state (localStorage,
  // matchMedia) on mount, not a derive-from-props anti-pattern — the eslint
  // rule below flags the synchronous setState regardless, but a
  // useSyncExternalStore rewrite isn't worth it for a one-off preference
  // default in a single-user local app.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored === "page" || stored === "text") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setViewMode(stored);
        return;
      }
    } catch {
      // Ignore — fall through to the width-based default.
    }
    setViewMode(window.matchMedia("(max-width: 768px)").matches ? "text" : "page");
  }, []);

  function handleSetViewMode(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // A missed preference save isn't worth surfacing to the user.
    }
  }

  const tree = useMemo(() => buildTocTree(tocEntries), [tocEntries]);
  const currentEntry = useMemo(
    () => findCurrentEntry(tocEntries, currentPage),
    [tocEntries, currentPage],
  );
  const nextExercises = useMemo(
    () => findNextEntryOfKind(tocEntries, "exercises", currentPage),
    [tocEntries, currentPage],
  );
  const nextReading = useMemo(
    () => findNextEntryOfKind(tocEntries, "reading", currentPage),
    [tocEntries, currentPage],
  );
  const isBookmarked = bookmarks.some((b) => b.page === currentPage);

  function jumpTo(page: number) {
    setCurrentPage(Math.min(Math.max(page, 1), book.page_count));
  }

  // Debounced save of reading position — fires after navigation settles
  // rather than on every single page change.
  useEffect(() => {
    const timeout = setTimeout(() => {
      startTransition(() => {
        updateReadingProgress(book.id, currentPage);
      });
    }, 800);
    return () => clearTimeout(timeout);
  }, [book.id, currentPage, startTransition]);

  // Arrow-key page turning, ignored while typing in the page-jump box.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "ArrowRight") jumpTo(currentPage + 1);
      if (event.key === "ArrowLeft") jumpTo(currentPage - 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, book.page_count]);

  function handleToggleBookmark() {
    const existing = bookmarks.find((b) => b.page === currentPage);
    if (existing) {
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
    } else {
      setBookmarks((prev) =>
        [
          ...prev,
          {
            id: crypto.randomUUID(),
            book_id: book.id,
            page: currentPage,
            label: null,
            created_at: new Date().toISOString(),
          },
        ].sort((a, b) => a.page - b.page),
      );
    }
    startTransition(() => {
      toggleBookmark(book.id, currentPage);
    });
  }

  function handleRemoveBookmark(bookmarkId: string) {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
    startTransition(() => {
      removeBookmarkAction(book.id, bookmarkId);
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <Link
          href="/"
          className="shrink-0 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Library
        </Link>
        <button
          type="button"
          onClick={() => setIsTocOpen((v) => !v)}
          className="shrink-0 rounded px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-900"
        >
          Contents
        </button>
        <div className="flex shrink-0 rounded-md border border-slate-200 p-0.5 text-sm dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleSetViewMode("page")}
            className={`rounded px-2 py-1 ${
              viewMode === "page"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
            }`}
          >
            Page
          </button>
          <button
            type="button"
            onClick={() => handleSetViewMode("text")}
            className={`rounded px-2 py-1 ${
              viewMode === "text"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
            }`}
          >
            Text
          </button>
        </div>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium">{book.title}</p>
          {currentEntry && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {currentEntry.title}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleToggleBookmark}
          className={`shrink-0 rounded px-2 py-1 text-lg leading-none ${
            isBookmarked
              ? "text-amber-500"
              : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
          }`}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this page"}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {isTocOpen && (
          <TocSidebar
            bookId={book.id}
            tree={tree}
            currentEntryId={currentEntry?.id ?? null}
            bookmarks={bookmarks}
            onJump={jumpTo}
            onRemoveBookmark={handleRemoveBookmark}
          />
        )}
        {viewMode === "page" ? (
          <PdfViewer bookId={book.id} pageNumber={currentPage} />
        ) : (
          <ReflowView bookId={book.id} pageNumber={currentPage} />
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => jumpTo(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-900"
        >
          ← Prev
        </button>
        <PageJumpInput page={currentPage} pageCount={book.page_count} onJump={jumpTo} />
        <button
          type="button"
          onClick={() => jumpTo(currentPage + 1)}
          disabled={currentPage >= book.page_count}
          className="rounded px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-900"
        >
          Next →
        </button>
        {nextExercises && (
          <button
            type="button"
            onClick={() => jumpTo(nextExercises.start_page)}
            className="rounded bg-amber-100 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
          >
            Next exercises →
          </button>
        )}
        {nextReading && (
          <button
            type="button"
            onClick={() => jumpTo(nextReading.start_page)}
            className="rounded bg-teal-100 px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-200 dark:bg-teal-950 dark:text-teal-300"
          >
            Next reading →
          </button>
        )}
      </div>
    </div>
  );
}

function PageJumpInput({
  page,
  pageCount,
  onJump,
}: {
  page: number;
  pageCount: number;
  onJump: (page: number) => void;
}) {
  return (
    // Uncontrolled + keyed by page: remounts (resetting to the new page) on
    // external navigation, without a useEffect fighting the user's typing.
    <form
      key={page}
      onSubmit={(event) => {
        event.preventDefault();
        const raw = new FormData(event.currentTarget).get("page");
        const parsed = typeof raw === "string" ? parseInt(raw, 10) : NaN;
        if (!Number.isNaN(parsed)) onJump(parsed);
      }}
      className="flex items-center gap-1 text-sm"
    >
      <input
        type="number"
        name="page"
        min={1}
        max={pageCount}
        defaultValue={page}
        className="w-14 rounded border border-slate-300 px-1.5 py-1 text-center dark:border-slate-700 dark:bg-slate-900"
      />
      <span className="text-slate-400">/ {pageCount}</span>
    </form>
  );
}
