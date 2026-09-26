-- U-45 (2026-09-26): project package -> Electronic Product component links.
create table if not exists public.project_components (
  project_id text not null references public.products(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null default 1,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  primary key (project_id, product_id)
);

alter table public.project_components enable row level security;

drop policy if exists "public read project_components" on public.project_components;
create policy "public read project_components"
  on public.project_components for select using (true);

create index if not exists project_components_project_idx
  on public.project_components (project_id, sort_order);

create index if not exists project_components_product_idx
  on public.project_components (product_id);
