-- Standardize assistant attribution on the Saffi spelling.
-- Existing rows may have been written before the product name was finalized.

alter table public.activity_events
  drop constraint if exists activity_events_created_by_check;

alter table public.agent_action_queue
  drop constraint if exists agent_action_queue_created_by_check;

update public.activity_events
set source = 'saffi'
where source = 'safi';

update public.activity_events
set feature = 'saffi_chat'
where feature = 'safi_chat';

update public.activity_events
set created_by = 'saffi'
where created_by = 'safi';

update public.agent_action_queue
set created_by = 'saffi'
where created_by = 'safi';

alter table public.activity_events
  add constraint activity_events_created_by_check
  check (created_by in ('user', 'saffi', 'system', 'integration'));

alter table public.agent_action_queue
  add constraint agent_action_queue_created_by_check
  check (created_by in ('user', 'saffi', 'system', 'integration'));
