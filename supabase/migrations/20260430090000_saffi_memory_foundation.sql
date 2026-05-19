-- =============================================================================
-- Saffi memory system — foundation
-- activity_events: durable log of important app/business events
-- agent_action_queue: Saffi's prepared actions awaiting approval
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  platform text,
  feature text,
  event_type text not null,
  entity_type text,
  entity_id text,
  client_id uuid,
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  visibility text not null default 'private'
    check (visibility in ('private', 'team', 'public')),
  sensitivity text not null default 'normal'
    check (sensitivity in ('normal', 'sensitive', 'restricted')),
  created_by text not null default 'system'
    check (created_by in ('user', 'saffi', 'system', 'integration')),
  created_at timestamptz not null default now()
);

create index if not exists activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc);
create index if not exists activity_events_user_source_idx
  on public.activity_events (user_id, source, created_at desc);
create index if not exists activity_events_user_event_type_idx
  on public.activity_events (user_id, event_type, created_at desc);
create index if not exists activity_events_client_idx
  on public.activity_events (client_id, created_at desc)
  where client_id is not null;
create index if not exists activity_events_entity_idx
  on public.activity_events (entity_type, entity_id)
  where entity_id is not null;
create index if not exists activity_events_payload_gin
  on public.activity_events using gin (payload jsonb_path_ops);

alter table public.activity_events enable row level security;

drop policy if exists "activity_events_select_own" on public.activity_events;
create policy "activity_events_select_own"
  on public.activity_events for select
  using (auth.uid() = user_id);

drop policy if exists "activity_events_insert_own" on public.activity_events;
create policy "activity_events_insert_own"
  on public.activity_events for insert
  with check (auth.uid() = user_id);

create table if not exists public.agent_action_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_event_id uuid references public.activity_events(id) on delete set null,
  action_type text not null
    check (action_type in (
      'send_message', 'post_social', 'send_quote', 'send_invoice',
      'follow_up', 'schedule_meeting', 'create_task', 'custom'
    )),
  channel text,
  platform text,
  target_client_id uuid,
  target_contact text,
  target_meta jsonb not null default '{}'::jsonb,
  title text not null,
  draft_body text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending_approval'
    check (status in (
      'draft', 'pending_approval', 'approved', 'rejected',
      'sent', 'cancelled', 'failed'
    )),
  approval_required boolean not null default true,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejected_reason text,
  executed_at timestamptz,
  execution_result jsonb,
  created_by text not null default 'saffi'
    check (created_by in ('user', 'saffi', 'system', 'integration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_action_queue_user_status_idx
  on public.agent_action_queue (user_id, status, created_at desc);
create index if not exists agent_action_queue_user_pending_idx
  on public.agent_action_queue (user_id, created_at desc)
  where status in ('draft', 'pending_approval');
create index if not exists agent_action_queue_event_idx
  on public.agent_action_queue (activity_event_id)
  where activity_event_id is not null;
create index if not exists agent_action_queue_target_client_idx
  on public.agent_action_queue (target_client_id)
  where target_client_id is not null;

alter table public.agent_action_queue enable row level security;

drop policy if exists "agent_action_queue_select_own" on public.agent_action_queue;
create policy "agent_action_queue_select_own"
  on public.agent_action_queue for select
  using (auth.uid() = user_id);

drop policy if exists "agent_action_queue_insert_own" on public.agent_action_queue;
create policy "agent_action_queue_insert_own"
  on public.agent_action_queue for insert
  with check (auth.uid() = user_id);

drop policy if exists "agent_action_queue_update_own" on public.agent_action_queue;
create policy "agent_action_queue_update_own"
  on public.agent_action_queue for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists agent_action_queue_set_updated_at on public.agent_action_queue;
create trigger agent_action_queue_set_updated_at
  before update on public.agent_action_queue
  for each row execute function public.set_updated_at();
