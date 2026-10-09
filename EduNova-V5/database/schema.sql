-- EduNova V5: esquema inicial de Supabase.
-- Si ya creaste tablas en este proyecto, revisa sus columnas antes de ejecutar.
create extension if not exists pgcrypto;
create table if not exists public.tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, subject text, due_date date, priority text not null default 'Normal',
 completed boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.notes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, subject text, content text not null, created_at timestamptz not null default now()
);
create table if not exists public.schedule_items (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, subject text, starts_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.grades (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, subject text, score numeric(6,2) not null check(score >= 0),
 max_score numeric(6,2) not null default 20 check(max_score > 0), created_at timestamptz not null default now()
);
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.schedule_items enable row level security;
alter table public.grades enable row level security;
do $$ declare tbl text; begin foreach tbl in array array['tasks','notes','schedule_items','grades'] loop
 execute format('drop policy if exists "Users manage own %1$s" on public.%1$I',tbl);
 execute format('create policy "Users manage own %1$s" on public.%1$I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',tbl);
end loop; end $$;
