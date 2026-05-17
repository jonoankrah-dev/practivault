-- Public Millie Sales Chat table (fast MVP)
-- Stores conversations from the public chat at chat.endopulse.co.uk

create table public.millie_public_chats (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,                    -- groups one visitor's conversation
  user_id uuid references auth.users(id) not null,   -- always the endoPulse owner
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  
  -- Contact info (populated as visitor shares it)
  contact_name text,
  contact_phone text,
  contact_email text,
  interest text,                               -- e.g. "tummy", "full face + training", "dual machine"
  
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_millie_public_chats_session on public.millie_public_chats(session_id);
create index idx_millie_public_chats_user on public.millie_public_chats(user_id);
create index idx_millie_public_chats_created on public.millie_public_chats(created_at desc);