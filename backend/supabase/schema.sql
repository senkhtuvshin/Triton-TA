-- UCSD Course Agent — Supabase Schema
-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ── Homework Errors ──────────────────────────────────────────────────────────
create table if not exists public.homework_errors (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  course_id     text not null,
  homework_id   text not null default '',
  problem       text not null default '',
  topic         text not null default '',
  subtopic      text not null default '',
  description   text not null default '',
  status        text not null default 'unresolved',
  resolved      boolean not null default false,
  attempts      int not null default 1,
  recorded_at   timestamptz not null default now()
);

create index if not exists idx_errors_user_course on public.homework_errors(user_id, course_id);
create index if not exists idx_errors_trending   on public.homework_errors(course_id, topic, status);

-- ── Documents Registry ────────────────────────────────────────────────────────
create table if not exists public.documents_registry (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  document_id   text unique not null,
  file_name     text not null,
  course_id     text not null,
  document_type text not null,
  chunks_indexed int not null default 0,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_docs_user_course on public.documents_registry(user_id, course_id);

-- ── Row-Level Security ────────────────────────────────────────────────────────
alter table public.homework_errors    enable row level security;
alter table public.documents_registry enable row level security;

-- Service-role key (used by the backend) bypasses RLS automatically.
-- These policies protect direct anon/authenticated access from the frontend.
create policy "users_own_errors" on public.homework_errors
  for all using (user_id = auth.uid()::text);

create policy "users_own_docs" on public.documents_registry
  for all using (user_id = auth.uid()::text);
