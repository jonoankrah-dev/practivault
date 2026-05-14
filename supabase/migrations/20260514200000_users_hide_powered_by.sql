-- White-label: allow paid tenants to hide "Powered by PractiVault" in the app shell.
alter table public.users
  add column if not exists hide_powered_by boolean not null default false;

comment on column public.users.hide_powered_by is 'When true, sidebar omits the PractiVault attribution line (white-label).';
