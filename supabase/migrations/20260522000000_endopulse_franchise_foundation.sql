-- endoPulse franchise foundation.
-- Treat endoPulse as a controlled service line instead of only a word in the
-- treatment name. Existing seed data is backfilled below.

alter table public.treatments
  add column if not exists is_endopulse boolean not null default false,
  add column if not exists service_brand text,
  add column if not exists service_line text not null default 'general',
  add column if not exists brand_compliance_required boolean not null default false;

alter table public.treatments
  drop constraint if exists treatments_service_line_check;

alter table public.treatments
  add constraint treatments_service_line_check
  check (service_line in (
    'general',
    'endopulse_treatment',
    'endopulse_machine',
    'endopulse_training'
  ));

update public.treatments
set
  is_endopulse = true,
  service_brand = coalesce(service_brand, 'endoPulse'),
  service_line = case
    when service_line = 'general' then 'endopulse_treatment'
    else service_line
  end,
  brand_compliance_required = true
where lower(name) like '%endopulse%';

create index if not exists treatments_user_endopulse_idx
  on public.treatments (user_id, is_endopulse, is_active);

comment on column public.treatments.is_endopulse is
  'True when this service is part of the controlled endoPulse service line.';

comment on column public.treatments.service_brand is
  'Brand/service mark shown in franchise reporting, e.g. endoPulse.';

comment on column public.treatments.service_line is
  'Controlled service line for franchise reporting and compliance workflows.';

comment on column public.treatments.brand_compliance_required is
  'True when the service should follow brand/franchise standards before being offered.';
