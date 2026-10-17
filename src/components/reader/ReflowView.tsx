"use client";

import { useEffect, useState } from "react";
import { KIND_BADGE_CLASSES, KIND_LABELS } from "@/lib/pdf/tocTree";
import type { ReflowBlock } from "@/lib/pdf/reflowPage.server";

const MATH_NOTICE_DISMISSED_KEY = "textbooker:reflow-notice-dismissed";
const INDENT_CLASSES = ["", "pl-6", "pl-12", "pl-16"];

export function ReflowView({ bookId, pageNumber }: { bookId: string; pageNumber: number }) {
  const [blocks, setBlocks] = useState<ReflowBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(true); // default true avoids an SSR/client flash; corrected on mount

  // One-time read of external state (localStorage) on mount — not a
  // derive-from-props anti-pattern, so the synchronous setState below is
  // intentional despite the lint rule flagging it regardless.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNoticeDismissed(localStorage.getItem(MATH_NOTICE_DISMISSED_KEY) === "1");
    } catch {
      // localStorage can throw in a locked-down browsing context — a missed
      // one-time notice isn't worth failing the page over.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBlocks(null);
    setError(null);

    fetch(`/api/books/${bookId}/pages/${pageNumber}/text`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
        } else {
          setBlocks(data.blocks);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this page's text.");
      });

    return () => {
      cancelled = true;
    };
  }, [bookId, pageNumber]);

  function dismissNotice() {
    setNoticeDismissed(true);
    try {
      localStorage.setItem(MATH_NOTICE_DISMISSED_KEY, "1");
    } catch {
      // Fine to no-op — worst case the notice reappears next time.
    }
  }

  return (
    <div className="flex flex-1 justify-center overflow-auto bg-white p-6 dark:bg-slate-950">
      <div className="w-full max-w-[65ch]">
        {!noticeDismissed && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
            <p>
              Text view is great for reading prose, but math notation (fractions, exponents) may
              not display perfectly — switch to Page view for equations.
            </p>
            <button
              type="button"
              onClick={dismissNotice}
              className="shrink-0 text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {!error && !blocks && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading text…</p>
        )}
        {!error && blocks && blocks.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No text found on this page — it may be an image (a figure, diagram, or scanned page).
            Try Page view instead.
          </p>
        )}
        {!error &&
          blocks &&
          blocks.map((block, index) => {
            const indentClass = INDENT_CLASSES[Math.min(block.indentLevel, INDENT_CLASSES.length - 1)];
            if (block.kind === "heading") {
              const kindLabel = block.tocKind ? KIND_LABELS[block.tocKind] : "";
              return (
                <h3
                  key={index}
                  className={`mt-6 mb-3 flex items-center gap-2 text-lg font-semibold first:mt-0 ${indentClass}`}
                >
                  <span>{block.text}</span>
                  {kindLabel && block.tocKind && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${KIND_BADGE_CLASSES[block.tocKind]}`}
                    >
                      {kindLabel}
                    </span>
                  )}
                </h3>
              );
            }
            return (
              <p
                key={index}
                className={`mb-4 text-[17px] leading-relaxed text-slate-800 dark:text-slate-200 ${indentClass}`}
              >
                {block.text}
              </p>
            );
          })}
      </div>
    </div>
  );
}
