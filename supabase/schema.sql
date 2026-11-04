-- Этап 0: профили и счётчики использования. Выполнить в Supabase SQL editor (или через MCP).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','premium')),
  created_at timestamptz not null default now()
);
create table if not exists public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('legit','outfit','search')),
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, feature, day)
);
alter table public.profiles enable row level security;
alter table public.usage_daily enable row level security;
-- plan менять с клиента нельзя: только чтение. Обновляет сервер/RevenueCat webhook.
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own usage read" on public.usage_daily for select using (auth.uid() = user_id);
-- Инкремент только через функцию, чтобы счётчик нельзя было занизить с клиента.
create or replace function public.consume_usage(p_feature text) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into usage_daily(user_id, feature, day, count) values (auth.uid(), p_feature, current_date, 1)
  on conflict (user_id, feature, day) do update set count = usage_daily.count + 1
  returning count into v_count;
  return v_count;
end $$;
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into profiles(id) values (new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
