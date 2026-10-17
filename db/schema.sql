-- Textbooker local schema (SQLite). Applied automatically at startup by
-- src/lib/db/client.ts — every statement is idempotent (IF NOT EXISTS), so
-- this file doubles as both the source of truth and the migration.

create table if not exists books (
  id                text primary key,
  title             text not null,
  author            text,
  course            text,
  file_path         text not null,
  file_size_bytes   integer not null,
  page_count        integer not null,
  toc_source        text not null default 'none'
                    check (toc_source in ('auto', 'manual', 'mixed', 'none')),
  last_page_read    integer not null default 1,
  last_read_at      text,
  created_at        text not null default (datetime('now'))
);

create table if not exists toc_entries (
  id           text primary key,
  book_id      text not null references books(id) on delete cascade,
  parent_id    text references toc_entries(id) on delete cascade,
  title        text not null,
  start_page   integer not null,
  kind         text not null default 'section'
               check (kind in ('chapter', 'section', 'exercises', 'review', 'reading', 'other')),
  sort_order   integer not null default 0
);
create index if not exists toc_entries_book_id_idx on toc_entries(book_id);
create index if not exists toc_entries_parent_id_idx on toc_entries(parent_id);

create table if not exists bookmarks (
  id          text primary key,
  book_id     text not null references books(id) on delete cascade,
  page        integer not null,
  label       text,
  created_at  text not null default (datetime('now'))
);
create index if not exists bookmarks_book_id_idx on bookmarks(book_id);
