create table work_order_defects (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  defect_id uuid not null references defects(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(work_order_id, defect_id)
);

alter table work_order_defects enable row level security;

-- Anyone with project access can view the junction rows
-- (the actual read access is gated by the work_orders / defects RLS
--  enforced at the API layer via requireProjectAccess)
create policy "Authenticated users can view work_order_defects"
  on work_order_defects for select
  using (auth.uid() is not null);

create policy "Authenticated users can insert work_order_defects"
  on work_order_defects for insert
  with check (auth.uid() is not null);

create policy "Authenticated users can delete work_order_defects"
  on work_order_defects for delete
  using (auth.uid() is not null);
