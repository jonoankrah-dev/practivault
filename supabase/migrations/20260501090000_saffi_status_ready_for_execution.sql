-- Adds a separate explicit handoff state between "approved" and the future executor.
-- Safe and non-destructive: no rows are changed.

alter table public.agent_action_queue
  drop constraint if exists agent_action_queue_status_check;

alter table public.agent_action_queue
  add constraint agent_action_queue_status_check
  check (status in (
    'draft',
    'pending_approval',
    'approved',
    'ready_for_execution',
    'rejected',
    'sent',
    'cancelled',
    'failed'
  ));
