import Link from "next/link";
import type { BookmarkRow } from "@/lib/db/types";
import type { TocTreeNode } from "@/lib/pdf/tocTree";
import { KIND_BADGE_CLASSES, KIND_LABELS } from "@/lib/pdf/tocTree";

export function TocSidebar({
  bookId,
  tree,
  currentEntryId,
  bookmarks,
  onJump,
  onRemoveBookmark,
}: {
  bookId: string;
  tree: TocTreeNode[];
  currentEntryId: string | null;
  bookmarks: BookmarkRow[];
  onJump: (page: number) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
}) {
  return (
    <div className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <h2 className="text-sm font-medium">Contents</h2>
        <Link
          href={`/books/${bookId}/toc`}
          className="text-xs text-slate-500 underline hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Edit
        </Link>
      </div>

      <nav className="flex-1 p-2">
        {tree.length === 0 ? (
          <p className="p-2 text-sm text-slate-500 dark:text-slate-400">
            No table of contents yet.
          </p>
        ) : (
          <TocNodeList nodes={tree} currentEntryId={currentEntryId} onJump={onJump} />
        )}
      </nav>

      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <h2 className="px-2 py-1 text-sm font-medium">Bookmarks</h2>
        {bookmarks.length === 0 ? (
          <p className="px-2 py-1 text-sm text-slate-500 dark:text-slate-400">None yet.</p>
        ) : (
          <ul>
            {bookmarks.map((b) => (
              <li key={b.id} className="group flex items-center justify-between rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-900">
                <button
                  type="button"
                  onClick={() => onJump(b.page)}
                  className="flex-1 text-left text-sm"
                >
                  Page {b.page}
                  {b.label && <span className="text-slate-500 dark:text-slate-400"> — {b.label}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveBookmark(b.id)}
                  className="ml-2 text-xs text-slate-400 opacity-0 hover:text-red-600 group-hover:opacity-100 dark:hover:text-red-400"
                  aria-label={`Remove bookmark on page ${b.page}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TocNodeList({
  nodes,
  currentEntryId,
  onJump,
}: {
  nodes: TocTreeNode[];
  currentEntryId: string | null;
  onJump: (page: number) => void;
}) {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onJump(node.start_page)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-900 ${
              node.id === currentEntryId ? "bg-slate-100 font-medium dark:bg-slate-800" : ""
            }`}
          >
            <span className="flex-1 truncate">{node.title}</span>
            {KIND_LABELS[node.kind] && node.kind !== "chapter" && node.kind !== "section" && (
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${KIND_BADGE_CLASSES[node.kind]}`}>
                {KIND_LABELS[node.kind]}
              </span>
            )}
            <span className="shrink-0 text-xs text-slate-400">{node.start_page}</span>
          </button>
          {node.children.length > 0 && (
            <div className="ml-3 border-l border-slate-200 pl-1 dark:border-slate-800">
              <TocNodeList nodes={node.children} currentEntryId={currentEntryId} onJump={onJump} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
