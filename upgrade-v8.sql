-- Jira Interno TROBBU · Upgrade v8
-- Privacidad de perfiles: solo perfil propio o colaboradores que comparten workspace.

create or replace function private.shares_workspace_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members other
      on other.workspace_id=me.workspace_id
     and other.active=true
    where me.user_id=(select auth.uid())
      and me.active=true
      and other.user_id=p_user
  );
$$;
revoke all on function private.shares_workspace_with(uuid) from public,anon;
grant execute on function private.shares_workspace_with(uuid) to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id=(select auth.uid())
  or private.shares_workspace_with(id)
);
