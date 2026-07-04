create table if not exists public.mole_rankings (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 12),
  score integer not null check (score > 0),
  difficulty text not null,
  created_at timestamptz not null default now()
);

alter table public.mole_rankings enable row level security;

create policy "Anyone can read rankings"
on public.mole_rankings
for select
using (true);

create policy "Anyone can submit rankings"
on public.mole_rankings
for insert
with check (
  char_length(name) between 1 and 12
  and score > 0
  and difficulty in ('쉬움', '보통', '어려움')
);
