-- ============================================================
-- Migration 002 — Macro Tracking (Phase 2)
-- ============================================================

alter table public.profiles
  add column protein_goal integer not null default 150,
  add column carbs_goal integer not null default 250,
  add column fat_goal integer not null default 65,
  add column fiber_goal integer not null default 30;

alter table public.meals
  add column protein_g numeric(6,1) default 0,
  add column carbs_g numeric(6,1) default 0,
  add column fat_g numeric(6,1) default 0,
  add column fiber_g numeric(6,1) default 0;
