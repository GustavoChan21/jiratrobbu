-- Jira Interno TROBBU v15.4
-- Helpdesk: catálogo CRUD de Tipos de solicitud
-- Esta migración ya fue aplicada y validada sobre el proyecto Supabase Jira Interno Trobbu.

create table if not exists public.helpdesk_request_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  color text not null default '#0D47A1',
  icon text not null default 'lucide:ticket',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint helpdesk_request_types_code_format check (code ~ '^[a-z0-9][a-z0-9_-]{1,39}$'),
  constraint helpdesk_request_types_name_not_blank check (btrim(name) <> ''),
  constraint helpdesk_request_types_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint helpdesk_request_types_workspace_code_key unique (workspace_id, code),
  constraint helpdesk_request_types_workspace_name_key unique (workspace_id, name),
  constraint helpdesk_request_types_id_workspace_key unique (id, workspace_id)
);

alter table public.helpdesk_request_types enable row level security;

revoke all on table public.helpdesk_request_types from anon;
revoke all on table public.helpdesk_request_types from authenticated;
grant select, insert, update, delete on table public.helpdesk_request_types to authenticated;
grant select, insert, update, delete on table public.helpdesk_request_types to service_role;

drop policy if exists helpdesk_request_types_select on public.helpdesk_request_types;
create policy helpdesk_request_types_select
on public.helpdesk_request_types
for select to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists helpdesk_request_types_insert on public.helpdesk_request_types;
create policy helpdesk_request_types_insert
on public.helpdesk_request_types
for insert to authenticated
with check (
  private.has_workspace_permission(workspace_id, 'manage_settings')
  or private.has_workspace_permission(workspace_id, 'manage_helpdesk')
);

drop policy if exists helpdesk_request_types_update on public.helpdesk_request_types;
create policy helpdesk_request_types_update
on public.helpdesk_request_types
for update to authenticated
using (
  private.has_workspace_permission(workspace_id, 'manage_settings')
  or private.has_workspace_permission(workspace_id, 'manage_helpdesk')
)
with check (
  private.has_workspace_permission(workspace_id, 'manage_settings')
  or private.has_workspace_permission(workspace_id, 'manage_helpdesk')
);

drop policy if exists helpdesk_request_types_delete on public.helpdesk_request_types;
create policy helpdesk_request_types_delete
on public.helpdesk_request_types
for delete to authenticated
using (
  private.has_workspace_permission(workspace_id, 'manage_settings')
  or private.has_workspace_permission(workspace_id, 'manage_helpdesk')
);

drop trigger if exists trg_helpdesk_request_types_updated on public.helpdesk_request_types;
create trigger trg_helpdesk_request_types_updated
before update on public.helpdesk_request_types
for each row execute function public.set_updated_at();

create or replace function private.seed_helpdesk_request_types(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.helpdesk_request_types
    (workspace_id, code, name, description, color, icon, active, sort_order)
  values
    (p_workspace_id,'support','Soporte','Ayuda operativa, fallas de uso o asistencia general.','#0D47A1','lucide:headphones',true,10),
    (p_workspace_id,'incident','Incidencia','Error, interrupción o comportamiento inesperado que requiere atención.','#FF6363','lucide:triangle-alert',true,20),
    (p_workspace_id,'requirement','Requerimiento','Solicitud de nueva necesidad, módulo, funcionalidad o cambio de alcance.','#4D5A51','lucide:list-plus',true,30),
    (p_workspace_id,'improvement','Mejora','Optimización de una funcionalidad, proceso o experiencia existente.','#249F58','lucide:sparkles',true,40),
    (p_workspace_id,'access','Acceso / permisos','Alta, baja, cambio de acceso, rol o permisos.','#7C5CFC','lucide:key-round',true,50),
    (p_workspace_id,'configuration','Configuración','Cambio de parámetros, catálogos o configuración operativa.','#CA6832','lucide:settings-2',true,60),
    (p_workspace_id,'other','Otro','Solicitud que no encaja en los tipos anteriores.','#6B7280','lucide:circle-ellipsis',true,999)
  on conflict (workspace_id, code) do update
    set name=excluded.name,
        description=excluded.description,
        color=excluded.color,
        icon=excluded.icon,
        sort_order=excluded.sort_order;
end
$function$;

do $$
declare
  v_workspace uuid;
begin
  for v_workspace in select id from public.workspaces loop
    perform private.seed_helpdesk_request_types(v_workspace);
  end loop;
end
$$;

alter table public.helpdesk_tickets
  add column if not exists request_type_id uuid;

alter table public.helpdesk_tickets disable trigger trg_guard_helpdesk_requester_update;

update public.helpdesk_tickets ht
set request_type_id = rt.id
from public.helpdesk_request_types rt
where rt.workspace_id = ht.workspace_id
  and rt.code = case
    when ht.category in ('module','feature','new_requirement') then 'requirement'
    else 'support'
  end
  and ht.request_type_id is null;

alter table public.helpdesk_tickets enable trigger trg_guard_helpdesk_requester_update;

alter table public.helpdesk_tickets
  drop constraint if exists helpdesk_tickets_request_type_workspace_fkey;

alter table public.helpdesk_tickets
  add constraint helpdesk_tickets_request_type_workspace_fkey
  foreign key (request_type_id, workspace_id)
  references public.helpdesk_request_types(id, workspace_id)
  on update restrict
  on delete restrict;

create index if not exists helpdesk_request_types_workspace_active_sort_idx
  on public.helpdesk_request_types(workspace_id, active, sort_order, name);

create index if not exists helpdesk_tickets_workspace_request_type_idx
  on public.helpdesk_tickets(workspace_id, request_type_id);

create or replace function private.ensure_helpdesk_request_type()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_code text;
begin
  if new.request_type_id is null then
    v_code := case
      when new.category in ('module','feature','new_requirement') then 'requirement'
      else 'support'
    end;

    select id into new.request_type_id
    from public.helpdesk_request_types
    where workspace_id = new.workspace_id
      and code = v_code
      and active = true
    order by sort_order, name
    limit 1;

    if new.request_type_id is null then
      perform private.seed_helpdesk_request_types(new.workspace_id);

      select id into new.request_type_id
      from public.helpdesk_request_types
      where workspace_id = new.workspace_id
        and code = v_code
      order by sort_order, name
      limit 1;
    end if;
  end if;

  if tg_op = 'UPDATE'
     and new.request_type_id is not distinct from old.request_type_id
     and new.workspace_id is not distinct from old.workspace_id
     and exists (
       select 1
       from public.helpdesk_request_types rt
       where rt.id = new.request_type_id
         and rt.workspace_id = new.workspace_id
     ) then
    return new;
  end if;

  if not exists (
    select 1
    from public.helpdesk_request_types rt
    where rt.id = new.request_type_id
      and rt.workspace_id = new.workspace_id
      and rt.active = true
  ) then
    raise exception 'Invalid or inactive Helpdesk request type for this workspace';
  end if;

  return new;
end
$function$;
drop trigger if exists trg_00_ensure_helpdesk_request_type on public.helpdesk_tickets;
create trigger trg_00_ensure_helpdesk_request_type
before insert or update of request_type_id, workspace_id, category
on public.helpdesk_tickets
for each row execute function private.ensure_helpdesk_request_type();

alter table public.helpdesk_tickets
  alter column request_type_id set not null;

-- Bootstrap actualizado: nuevos workspaces reciben también AUT y FIN
-- además de los 7 tipos de solicitud.


-- v15.4 · asegurar productos adicionales en workspaces ya existentes
insert into public.products(workspace_id,name,key,description,board_order)
select w.id,'Automatizaciones','AUT','Automatizaciones, integraciones, jobs y procesos automáticos',4
from public.workspaces w
on conflict (workspace_id,key) do update set
  name=excluded.name,
  description=excluded.description,
  board_order=excluded.board_order;

insert into public.products(workspace_id,name,key,description,board_order)
select w.id,'Panel Financiero','FIN','Paneles, conciliación, indicadores y seguimiento financiero',5
from public.workspaces w
on conflict (workspace_id,key) do update set
  name=excluded.name,
  description=excluded.description,
  board_order=excluded.board_order;

create or replace function private.bootstrap_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_super_role uuid;
begin
  perform private.seed_workspace_roles(new.id);
  select id into v_super_role
  from public.workspace_roles
  where workspace_id=new.id and code='superadmin';

  if new.created_by is not null then
    insert into public.workspace_members(workspace_id,user_id,role,role_id,active,all_products)
    values(new.id,new.created_by,'superadmin',v_super_role,true,true)
    on conflict (workspace_id,user_id)
    do update set role='superadmin',role_id=v_super_role,active=true,all_products=true,permissions='{}'::jsonb;
  end if;

  insert into public.products(workspace_id,name,key,description,board_order)
  values
    (new.id,'Web Administrativa','ADM','Administración interna y operación',1),
    (new.id,'Web Socios','SOC','Portal web para socios/inversionistas',2),
    (new.id,'App Socios','APP','Aplicación móvil para socios/inversionistas',3),
    (new.id,'Automatizaciones','AUT','Automatizaciones, integraciones, jobs y procesos automáticos',4),
    (new.id,'Panel Financiero','FIN','Paneles, conciliación, indicadores y seguimiento financiero',5)
  on conflict (workspace_id,key) do update set
    name=excluded.name,
    description=excluded.description,
    board_order=excluded.board_order;

  insert into public.workspace_settings(workspace_id)
  values(new.id)
  on conflict (workspace_id) do nothing;

  insert into public.helpdesk_departments(workspace_id,name,color,active)
  values
    (new.id,'Reservaciones','#0D47A1',true),
    (new.id,'Recepción','#4D5A51',true),
    (new.id,'Gerencia','#21343E',true),
    (new.id,'Administración','#CA6832',true),
    (new.id,'Aperturas','#249F58',true),
    (new.id,'Marketing','#AE6A3E',true),
    (new.id,'Callcenter','#007BFF',true),
    (new.id,'Plataforma','#056D25',true),
    (new.id,'Atención a clientes','#D4DCE0',true),
    (new.id,'Atención a socios','#FF6363',true)
  on conflict (workspace_id,name) do update set color=excluded.color,active=true;

  perform private.seed_helpdesk_request_types(new.id);
  return new;
end
$function$;
