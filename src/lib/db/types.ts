export type TocKind = "chapter" | "section" | "exercises" | "review" | "reading" | "other";
export type TocSource = "auto" | "manual" | "mixed" | "none";

export interface BookRow {
  id: string;
  title: string;
  author: string | null;
  course: string | null;
  file_path: string;
  file_size_bytes: number;
  page_count: number;
  toc_source: TocSource;
  last_page_read: number;
  last_read_at: string | null;
  created_at: string;
}

export interface TocEntryRow {
  id: string;
  book_id: string;
  parent_id: string | null;
  title: string;
  start_page: number;
  kind: TocKind;
  sort_order: number;
}

export interface BookmarkRow {
  id: string;
  book_id: string;
  page: number;
  label: string | null;
  created_at: string;
}
