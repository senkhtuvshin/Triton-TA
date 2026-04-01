-- ─────────────────────────────────────────────────────────────────────────────
-- UCSD Course Agent — Supabase Migration v2
-- Run this in your Supabase project: SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable the uuid extension if not already active
create extension if not exists "uuid-ossp";

-- ── User Courses ─────────────────────────────────────────────────────────────
-- Stores user-added custom courses (built-ins math20c/cse12 live in code).

create table if not exists courses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  course_id   text not null,    -- slug, e.g. "cse_105"
  course_code text not null,    -- display code, e.g. "CSE 105"
  course_name text default '',  -- subtitle, e.g. "Theory of Computation"
  created_at  timestamptz default now(),
  unique (user_id, course_id)
);

alter table courses enable row level security;

create policy "Users manage their own courses"
  on courses for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ── Homework Errors ───────────────────────────────────────────────────────────
-- Already created in v1 — no changes needed.
-- Reproduced here as reference:
--
-- create table if not exists homework_errors (
--   id          uuid primary key default uuid_generate_v4(),
--   user_id     uuid references auth.users(id) on delete cascade,
--   course_id   text,
--   homework_id text,
--   problem     text,
--   topic       text,
--   subtopic    text,
--   description text,
--   status      text default 'unresolved',
--   recorded_at timestamptz default now(),
--   resolved    boolean default false,
--   attempts    int default 1
-- );


-- ── Documents Registry ────────────────────────────────────────────────────────
-- Already created in v1 — no changes needed.


-- ── Assignments / Calendar Events ─────────────────────────────────────────────
-- Stores ALL calendar events: scraped from Canvas, extracted from PDFs, manual.

create table if not exists assignments (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  course_id   text not null,

  -- Standardised Event Schema (Phase 4)
  title       text not null,
  type        text check (type in ('EXAM', 'ASSIGNMENT', 'QUIZ', 'LECTURE', 'OFFICE_HOURS'))
                   default 'ASSIGNMENT',
  due_date    text,           -- ISO-8601 date string or "TBD"
  weight      int  default 0  check (weight >= 0 and weight <= 100),
  description text default '',

  completed   boolean   default false,
  source      text      default 'manual',  -- 'manual' | 'scraped' | 'syllabus' | 'google_doc'
  created_at  timestamptz default now()
);

alter table assignments enable row level security;

create policy "Users manage their own assignments"
  on assignments for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast per-course queries
create index if not exists idx_assignments_user_course
  on assignments (user_id, course_id, due_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Crowdsourced heatmap view (read-only, no RLS needed — no PII exposed)
-- Counts unresolved errors by topic across ALL users for each course.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view trending_topics as
select
  course_id,
  topic,
  count(*)::int as error_count
from homework_errors
where status = 'unresolved'
  and topic is not null
  and topic <> ''
group by course_id, topic
order by course_id, error_count desc;
