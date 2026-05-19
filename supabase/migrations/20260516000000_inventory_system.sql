-- =============================================================================
-- Inventory System for PractiVault (endoPulse & General Use)
-- Supports consumable tracking for Hermes + general business use
-- =============================================================================

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text default 'consumable', -- consumable, equipment, supplies
  unit text default 'unit',           -- unit, ml, vial, cartridge, pack
  quantity numeric(10,2) not null default 0,
  min_stock_level numeric(10,2) default 5,
  cost_per_unit numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_user_idx on public.inventory_items(user_id);
create index if not exists inventory_items_name_idx on public.inventory_items(user_id, name);

alter table public.inventory_items enable row level security;

drop policy if exists "inventory_items_select_own" on public.inventory_items;
create policy "inventory_items_select_own"
  on public.inventory_items for select
  using (auth.uid() = user_id);

drop policy if exists "inventory_items_insert_own" on public.inventory_items;
create policy "inventory_items_insert_own"
  on public.inventory_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "inventory_items_update_own" on public.inventory_items;
create policy "inventory_items_update_own"
  on public.inventory_items for update
  using (auth.uid() = user_id);

-- Track inventory deductions (for audit + Hermes execution)
create table if not exists public.inventory_deductions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,           -- denormalized for history
  quantity_deducted numeric(10,2) not null,
  source text default 'hermes',      -- hermes, manual, booking
  reference_id text,                 -- booking id or treatment id
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_deductions_user_idx on public.inventory_deductions(user_id);
create index if not exists inventory_deductions_item_idx on public.inventory_deductions(inventory_item_id);

alter table public.inventory_deductions enable row level security;

drop policy if exists "inventory_deductions_select_own" on public.inventory_deductions;
create policy "inventory_deductions_select_own"
  on public.inventory_deductions for select
  using (auth.uid() = user_id);

drop policy if exists "inventory_deductions_insert_own" on public.inventory_deductions;
create policy "inventory_deductions_insert_own"
  on public.inventory_deductions for insert
  with check (auth.uid() = user_id);

-- Function to auto-update updated_at
create or replace function update_inventory_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function update_inventory_updated_at();