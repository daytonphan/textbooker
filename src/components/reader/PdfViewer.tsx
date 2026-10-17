"use client";

import { useEffect, useRef, useState } from "react";

interface OverlayItem {
  str: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface TextLayerResult {
  pageWidth: number;
  pageHeight: number;
  items: OverlayItem[];
}

/**
 * Page view: a PDFKit-rendered image (the same engine macOS Preview uses,
 * so this looks exactly like opening the file in Preview — including PDF
 * spec edge cases pdf.js's canvas renderer handles differently, like
 * invisible text on OCR'd pages) plus an invisible, positioned text overlay
 * for selection. No react-pdf/pdfjs-dist on the client at all anymore.
 */
export function PdfViewer({ bookId, pageNumber }: { bookId: string; pageNumber: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayWidth, setDisplayWidth] = useState(800);
  const [textLayer, setTextLayer] = useState<TextLayerResult | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setDisplayWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTextLayer(null);

    fetch(`/api/books/${bookId}/pages/${pageNumber}/text-layer`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && !data.error) setTextLayer(data);
      })
      .catch(() => {
        // The selection overlay is a nice-to-have — a failed fetch just
        // means no selectable text on this page, not a broken page.
      });

    return () => {
      cancelled = true;
    };
  }, [bookId, pageNumber]);

  const pageWidth = Math.max(Math.min(displayWidth - 32, 900), 200);
  const scale = textLayer ? pageWidth / textLayer.pageWidth : 1;

  return (
    <div
      ref={containerRef}
      className="flex flex-1 justify-center overflow-auto bg-slate-100 p-4 dark:bg-slate-900"
    >
      <div className="relative bg-white shadow" style={{ width: pageWidth }}>
        <PageImage
          key={pageNumber}
          src={`/api/books/${bookId}/pages/${pageNumber}/image`}
        />
        {textLayer && (
          <div className="absolute inset-0 overflow-hidden">
            {textLayer.items.map((item, index) => (
              <span
                key={index}
                className="absolute cursor-text whitespace-pre text-transparent selection:bg-blue-300/40"
                style={{
                  left: item.left * scale,
                  top: item.top * scale,
                  width: item.width * scale,
                  height: item.height * scale,
                  fontSize: item.height * scale,
                  lineHeight: 1,
                }}
              >
                {item.str}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Own component so a failed load's error state resets per page via key={pageNumber}, not an effect. */
function PageImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="p-8 text-sm text-red-600 dark:text-red-400">Couldn&apos;t render this page.</p>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- server-rendered per-book PDF page, not a static asset for Next's image optimizer
    <img src={src} alt="" className="block w-full" onError={() => setFailed(true)} />
  );
}
