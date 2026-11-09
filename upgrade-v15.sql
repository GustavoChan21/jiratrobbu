-- Jira Interno TROBBU v15
-- Relaciones entre tickets, módulos/grupos, tags, campos personalizados y reportes.

-- 1) Permiso dedicado para administrar metadatos de tickets.
create or replace function private.role_default_permission(p_role public.app_role,p_permission text)
returns boolean
language sql
immutable
security invoker
set search_path=public,pg_temp
as $$
  select case
    when p_role='superadmin' then true
    when p_role='admin' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_staff','manage_products','manage_settings',
      'manage_ticket_fields'
    )
    when p_role='pm' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_ticket_fields'
    )
    when p_role='dev' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets'
    )
    when p_role='qa' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','qa_review'
    )
    when p_role='consulta' then p_permission in ('view_dashboard','view_tickets')
    else false
  end;
$$;

-- 2) Story Points 1..5.
alter table public.tickets drop constraint if exists tickets_story_points_v15_check;
alter table public.tickets add constraint tickets_story_points_v15_check
  check (story_points is null or (story_points between 1 and 5 and story_points = trunc(story_points)));

-- 3) Secuencia de módulos por workspace.
alter table public.workspace_settings add column if not exists module_seq bigint not null default 0;

create table if not exists public.ticket_modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  module_number bigint,
  module_key text not null,
  name text not null,
  description text,
  color text not null default '#4D5A51',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,module_key),
  unique(id,workspace_id)
);
create index if not exists idx_ticket_modules_workspace on public.ticket_modules(workspace_id,active,name);

alter table public.tickets add column if not exists module_id uuid;
alter table public.tickets drop constraint if exists tickets_module_workspace_fkey;
alter table public.tickets add constraint tickets_module_workspace_fkey
  foreign key(module_id,workspace_id)
  references public.ticket_modules(id,workspace_id)
  on delete set null;
create index if not exists idx_tickets_module on public.tickets(workspace_id,module_id,status);

create table if not exists public.ticket_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  color text not null default '#0D47A1',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,slug),
  unique(id,workspace_id)
);
create index if not exists idx_ticket_tags_workspace on public.ticket_tags(workspace_id,active,name);

create table if not exists public.ticket_tag_links (
  workspace_id uuid not null,
  ticket_id uuid not null,
  tag_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(ticket_id,tag_id),
  foreign key(ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade,
  foreign key(tag_id,workspace_id) references public.ticket_tags(id,workspace_id) on delete cascade
);
create index if not exists idx_ticket_tag_links_workspace on public.ticket_tag_links(workspace_id,tag_id,ticket_id);

create table if not exists public.ticket_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_ticket_id uuid not null,
  target_ticket_id uuid not null,
  link_type text not null check(link_type in ('blocks','relates','follows')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check(source_ticket_id<>target_ticket_id),
  unique(workspace_id,source_ticket_id,target_ticket_id,link_type),
  foreign key(source_ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade,
  foreign key(target_ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade
);
create index if not exists idx_ticket_links_source on public.ticket_links(workspace_id,source_ticket_id,link_type);
create index if not exists idx_ticket_links_target on public.ticket_links(workspace_id,target_ticket_id,link_type);

create table if not exists public.custom_ticket_fields (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  field_key text not null,
  description text,
  field_type text not null check(field_type in ('text','textarea','number','date','boolean','select','multiselect','url')),
  required boolean not null default false,
  placeholder text,
  options jsonb not null default '[]'::jsonb,
  applies_to_all_products boolean not null default true,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,field_key),
  unique(id,workspace_id)
);
create index if not exists idx_custom_ticket_fields_workspace on public.custom_ticket_fields(workspace_id,active,sort_order);

create table if not exists public.custom_ticket_field_products (
  workspace_id uuid not null,
  field_id uuid not null,
  product_id uuid not null,
  primary key(field_id,product_id),
  foreign key(field_id,workspace_id) references public.custom_ticket_fields(id,workspace_id) on delete cascade,
  foreign key(product_id,workspace_id) references public.products(id,workspace_id) on delete cascade
);

create table if not exists public.ticket_custom_field_values (
  workspace_id uuid not null,
  ticket_id uuid not null,
  field_id uuid not null,
  value jsonb not null default 'null'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(ticket_id,field_id),
  foreign key(ticket_id,workspace_id) references public.tickets(id,workspace_id) on delete cascade,
  foreign key(field_id,workspace_id) references public.custom_ticket_fields(id,workspace_id) on delete cascade
);
create index if not exists idx_ticket_custom_values_workspace on public.ticket_custom_field_values(workspace_id,field_id,ticket_id);

create table if not exists public.executive_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  report_type text not null default 'executive' check(report_type in ('executive','chat','infographic')),
  question text,
  metrics jsonb not null default '{}'::jsonb,
  content text,
  provider text not null default 'deterministic',
  model text,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_executive_reports_workspace on public.executive_reports(workspace_id,created_at desc);

-- Updated-at triggers.
drop trigger if exists trg_ticket_modules_updated on public.ticket_modules;
create trigger trg_ticket_modules_updated before update on public.ticket_modules for each row execute function public.set_updated_at();
drop trigger if exists trg_ticket_tags_updated on public.ticket_tags;
create trigger trg_ticket_tags_updated before update on public.ticket_tags for each row execute function public.set_updated_at();
drop trigger if exists trg_custom_ticket_fields_updated on public.custom_ticket_fields;
create trigger trg_custom_ticket_fields_updated before update on public.custom_ticket_fields for each row execute function public.set_updated_at();
drop trigger if exists trg_ticket_custom_field_values_updated on public.ticket_custom_field_values;
create trigger trg_ticket_custom_field_values_updated before update on public.ticket_custom_field_values for each row execute function public.set_updated_at();

-- Auto-claves.
create or replace function private.assign_ticket_module_key()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_seq bigint;
begin
  if new.module_key is null or btrim(new.module_key)='' then
    update public.workspace_settings set module_seq=module_seq+1
    where workspace_id=new.workspace_id returning module_seq into v_seq;
    if v_seq is null then
      insert into public.workspace_settings(workspace_id,module_seq) values(new.workspace_id,1)
      on conflict(workspace_id) do update set module_seq=public.workspace_settings.module_seq+1
      returning module_seq into v_seq;
    end if;
    new.module_number:=v_seq;
    new.module_key:='MOD-'||lpad(v_seq::text,3,'0');
  end if;
  return new;
end
$$;
revoke all on function private.assign_ticket_module_key() from public,anon,authenticated;
drop trigger if exists trg_assign_ticket_module_key on public.ticket_modules;
create trigger trg_assign_ticket_module_key before insert on public.ticket_modules for each row execute function private.assign_ticket_module_key();

create or replace function private.normalize_ticket_tag()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  new.name:=btrim(new.name);
  if new.slug is null or btrim(new.slug)='' then
    new.slug:=trim(both '-' from regexp_replace(lower(new.name),'[^a-z0-9]+','-','g'));
  else
    new.slug:=trim(both '-' from regexp_replace(lower(new.slug),'[^a-z0-9]+','-','g'));
  end if;
  if new.slug='' then raise exception 'La etiqueta necesita un nombre válido'; end if;
  return new;
end
$$;
drop trigger if exists trg_normalize_ticket_tag on public.ticket_tags;
create trigger trg_normalize_ticket_tag before insert or update on public.ticket_tags for each row execute function private.normalize_ticket_tag();

create or replace function private.normalize_custom_field_key()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  new.name:=btrim(new.name);
  if new.field_key is null or btrim(new.field_key)='' then
    new.field_key:=trim(both '_' from regexp_replace(lower(new.name),'[^a-z0-9]+','_','g'));
  else
    new.field_key:=trim(both '_' from regexp_replace(lower(new.field_key),'[^a-z0-9]+','_','g'));
  end if;
  if new.field_key='' then raise exception 'El campo necesita una clave válida'; end if;
  if new.field_type in ('select','multiselect') and jsonb_typeof(new.options)<>'array' then
    raise exception 'Las opciones deben ser una lista';
  end if;
  return new;
end
$$;
drop trigger if exists trg_normalize_custom_field_key on public.custom_ticket_fields;
create trigger trg_normalize_custom_field_key before insert or update on public.custom_ticket_fields for each row execute function private.normalize_custom_field_key();

-- Relaciones: sin duplicados inversos para relates y sin ciclos para blocks.
create or replace function private.guard_ticket_link()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare v_cycle boolean;
begin
  if new.source_ticket_id=new.target_ticket_id then raise exception 'Un ticket no puede relacionarse consigo mismo'; end if;

  if new.link_type='relates' and exists(
    select 1 from public.ticket_links l
    where l.workspace_id=new.workspace_id and l.link_type='relates'
      and l.source_ticket_id=new.target_ticket_id and l.target_ticket_id=new.source_ticket_id
      and (tg_op='INSERT' or l.id<>new.id)
  ) then raise exception 'Esta relación ya existe'; end if;

  if new.link_type='blocks' then
    with recursive chain(id) as (
      select l.target_ticket_id
      from public.ticket_links l
      where l.workspace_id=new.workspace_id and l.link_type='blocks' and l.source_ticket_id=new.target_ticket_id
        and (tg_op='INSERT' or l.id<>new.id)
      union
      select l.target_ticket_id
      from public.ticket_links l join chain c on l.source_ticket_id=c.id
      where l.workspace_id=new.workspace_id and l.link_type='blocks'
        and (tg_op='INSERT' or l.id<>new.id)
    )
    select exists(select 1 from chain where id=new.source_ticket_id) into v_cycle;
    if v_cycle then raise exception 'La dependencia crearía un ciclo de bloqueo'; end if;
  end if;
  return new;
end
$$;
drop trigger if exists trg_guard_ticket_link on public.ticket_links;
create trigger trg_guard_ticket_link before insert or update on public.ticket_links for each row execute function private.guard_ticket_link();

create or replace function private.ticket_has_open_blockers(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.ticket_links l
    join public.tickets blocker on blocker.id=l.source_ticket_id
    where l.target_ticket_id=p_ticket and l.link_type='blocks'
      and blocker.status not in ('qa_passed','closed')
  );
$$;
revoke all on function private.ticket_has_open_blockers(uuid) from public,anon;
grant execute on function private.ticket_has_open_blockers(uuid) to authenticated;

create or replace function private.guard_ticket_blocked_transition()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('in_progress','dev_done','qa_review','qa_rejected','qa_passed','closed')
     and coalesce(current_setting('app.ticket_dependency_override',true),'')<>'1'
     and private.ticket_has_open_blockers(new.id) then
    raise exception 'El ticket está bloqueado por dependencias pendientes';
  end if;
  return new;
end
$$;
drop trigger if exists trg_guard_ticket_blocked_transition on public.tickets;
create trigger trg_guard_ticket_blocked_transition before update of status on public.tickets for each row execute function private.guard_ticket_blocked_transition();

create or replace function private.record_dependency_override(p_ticket uuid,p_note text)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_workspace uuid;
begin
  select workspace_id into v_workspace from public.tickets where id=p_ticket;
  if v_workspace is null then raise exception 'Ticket no encontrado'; end if;
  if not private.has_workspace_role(v_workspace,array['superadmin','admin']::public.app_role[]) then
    raise exception 'Solo Admin o Superadmin puede forzar el avance de un ticket bloqueado';
  end if;
  insert into public.ticket_activity(ticket_id,actor_id,action,metadata)
  values(p_ticket,auth.uid(),'dependency_override',jsonb_build_object('note',coalesce(nullif(btrim(p_note),''),'Sin comentario')));
end
$$;
revoke all on function private.record_dependency_override(uuid,text) from public,anon;
grant execute on function private.record_dependency_override(uuid,text) to authenticated;

create or replace function public.transition_ticket_status(
  p_ticket_id uuid,
  p_status public.ticket_status,
  p_override_blockers boolean default false,
  p_note text default null
)
returns public.tickets
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id=p_ticket_id;
  if not found then raise exception 'Ticket no encontrado o no autorizado'; end if;
  if not private.has_workspace_permission(v_ticket.workspace_id,'edit_tickets')
     or not private.has_product_access(v_ticket.workspace_id,v_ticket.product_id) then
    raise exception 'No tienes permiso para editar este ticket';
  end if;

  if p_override_blockers then
    if not private.has_workspace_role(v_ticket.workspace_id,array['superadmin','admin']::public.app_role[]) then
      raise exception 'Solo Admin o Superadmin puede forzar el avance';
    end if;
    perform set_config('app.ticket_dependency_override','1',true);
    perform private.record_dependency_override(p_ticket_id,p_note);
  end if;

  update public.tickets set status=p_status where id=p_ticket_id returning * into v_ticket;
  return v_ticket;
end
$$;
revoke all on function public.transition_ticket_status(uuid,public.ticket_status,boolean,text) from public,anon;
grant execute on function public.transition_ticket_status(uuid,public.ticket_status,boolean,text) to authenticated;

-- Validación de valores de campos personalizados.
create or replace function private.validate_custom_field_value()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare f public.custom_ticket_fields%rowtype;
declare txt text;
begin
  select * into f from public.custom_ticket_fields where id=new.field_id and workspace_id=new.workspace_id and active;
  if not found then raise exception 'Campo personalizado no disponible'; end if;

  if new.value='null'::jsonb then
    if f.required then raise exception 'El campo % es obligatorio',f.name; end if;
    return new;
  end if;

  if f.field_type in ('text','textarea','date','url','select') and jsonb_typeof(new.value)<>'string' then
    raise exception 'El campo % requiere texto',f.name;
  elsif f.field_type='number' and jsonb_typeof(new.value)<>'number' then
    raise exception 'El campo % requiere número',f.name;
  elsif f.field_type='boolean' and jsonb_typeof(new.value)<>'boolean' then
    raise exception 'El campo % requiere Sí/No',f.name;
  elsif f.field_type='multiselect' and jsonb_typeof(new.value)<>'array' then
    raise exception 'El campo % requiere una lista',f.name;
  end if;

  if f.field_type='date' then
    txt:=trim(both '"' from new.value::text);
    begin perform txt::date; exception when others then raise exception 'El campo % requiere fecha AAAA-MM-DD',f.name; end;
  end if;

  if f.field_type='select' and jsonb_array_length(f.options)>0 and not exists(
    select 1 from jsonb_array_elements_text(f.options) x(value)
    where x.value=trim(both '"' from new.value::text)
  ) then raise exception 'Valor inválido para %',f.name; end if;

  if f.field_type='multiselect' and jsonb_array_length(f.options)>0 and exists(
    select 1 from jsonb_array_elements_text(new.value) v(value)
    where not exists(select 1 from jsonb_array_elements_text(f.options) o(value) where o.value=v.value)
  ) then raise exception 'Valor inválido para %',f.name; end if;

  new.updated_by:=coalesce(new.updated_by,auth.uid());
  return new;
end
$$;
drop trigger if exists trg_validate_custom_field_value on public.ticket_custom_field_values;
create trigger trg_validate_custom_field_value before insert or update on public.ticket_custom_field_values for each row execute function private.validate_custom_field_value();

-- Reporte determinístico por workspace/producto.
create or replace function public.get_workspace_progress_report(p_workspace uuid,p_as_of date default current_date)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare result jsonb;
declare week_end date:=p_as_of + (7-extract(isodow from p_as_of)::int);
begin
  if not private.has_workspace_permission(p_workspace,'view_dashboard') then
    raise exception 'No tienes permiso para consultar reportes de este workspace';
  end if;

  with visible_tickets as (
    select t.*,
      coalesce(t.story_points,1)::numeric as weight,
      case t.status
        when 'backlog' then 0 when 'todo' then 10 when 'in_progress' then 45 when 'dev_done' then 65
        when 'qa_review' then 78 when 'qa_rejected' then 58 when 'qa_passed' then 92 when 'closed' then 100 else 0 end::numeric as progress
    from public.tickets t
    where t.workspace_id=p_workspace and private.has_product_access(t.workspace_id,t.product_id)
  ), product_rows as (
    select p.id,p.key,p.name,
      count(v.id)::int total_tickets,
      coalesce(sum(v.weight),0)::numeric total_sp,
      coalesce(round(sum(v.weight*v.progress)/nullif(sum(v.weight),0),1),0) progress_percent,
      count(v.id) filter(where v.status='backlog')::int backlog,
      count(v.id) filter(where v.status in ('todo','in_progress','dev_done'))::int development,
      count(v.id) filter(where v.status in ('qa_review','qa_rejected','qa_passed'))::int qa,
      count(v.id) filter(where v.status='closed')::int closed,
      count(v.id) filter(where v.due_date<p_as_of and v.status not in ('qa_passed','closed'))::int overdue,
      count(v.id) filter(where v.due_date between p_as_of and week_end and v.status not in ('closed'))::int due_this_week,
      coalesce(sum(v.weight) filter(where v.due_date between p_as_of and week_end and v.status not in ('closed')),0)::numeric sp_due_this_week,
      count(v.id) filter(where private.ticket_has_open_blockers(v.id))::int blocked
    from public.products p
    left join visible_tickets v on v.product_id=p.id
    where p.workspace_id=p_workspace and private.has_product_access(p.workspace_id,p.id)
    group by p.id,p.key,p.name,p.board_order
    order by p.board_order
  ), sprint_rows as (
    select s.id,s.name,s.status,s.start_date,s.end_date,
      count(v.id)::int total_tickets,
      count(v.id) filter(where v.status in ('qa_passed','closed'))::int completed,
      count(v.id) filter(where v.status not in ('qa_passed','closed'))::int remaining,
      coalesce(sum(v.weight),0)::numeric total_sp,
      coalesce(sum(v.weight) filter(where v.status in ('qa_passed','closed')),0)::numeric completed_sp,
      count(v.id) filter(where private.ticket_has_open_blockers(v.id))::int blocked,
      count(v.id) filter(where v.due_date is not null and v.due_date<=coalesce(s.end_date,p_as_of) and v.status not in ('closed'))::int planned_by_sprint_end,
      coalesce(round(100.0*count(v.id) filter(where v.status in ('qa_passed','closed'))/nullif(count(v.id),0),1),0) progress_percent
    from public.sprints s
    left join visible_tickets v on v.sprint_id=s.id
    where s.workspace_id=p_workspace
      and (s.status='active' or (p_as_of between coalesce(s.start_date,p_as_of) and coalesce(s.end_date,p_as_of)))
    group by s.id,s.name,s.status,s.start_date,s.end_date
    order by s.start_date desc nulls last
    limit 3
  ), module_rows as (
    select m.id,m.module_key,m.name,m.color,
      count(v.id)::int total_tickets,
      coalesce(sum(v.weight),0)::numeric total_sp,
      coalesce(round(sum(v.weight*v.progress)/nullif(sum(v.weight),0),1),0) progress_percent,
      count(v.id) filter(where v.status='closed')::int closed
    from public.ticket_modules m
    left join visible_tickets v on v.module_id=m.id
    where m.workspace_id=p_workspace and m.active
    group by m.id,m.module_key,m.name,m.color
    having count(v.id)>0
    order by count(v.id) desc,m.name
  ), totals as (
    select count(*)::int total_tickets,
      coalesce(sum(weight),0)::numeric total_sp,
      coalesce(round(sum(weight*progress)/nullif(sum(weight),0),1),0) progress_percent,
      count(*) filter(where status='closed')::int closed,
      count(*) filter(where status='backlog')::int backlog,
      count(*) filter(where due_date<p_as_of and status not in ('qa_passed','closed'))::int overdue,
      count(*) filter(where due_date between p_as_of and week_end and status not in ('closed'))::int due_this_week,
      count(*) filter(where private.ticket_has_open_blockers(id))::int blocked
    from visible_tickets
  )
  select jsonb_build_object(
    'as_of',p_as_of,
    'week_end',week_end,
    'workspace_id',p_workspace,
    'workspace',(select jsonb_build_object('name',w.name,'slug',w.slug) from public.workspaces w where w.id=p_workspace),
    'totals',(select to_jsonb(totals) from totals),
    'products',coalesce((select jsonb_agg(to_jsonb(product_rows)) from product_rows),'[]'::jsonb),
    'active_sprints',coalesce((select jsonb_agg(to_jsonb(sprint_rows)) from sprint_rows),'[]'::jsonb),
    'modules',coalesce((select jsonb_agg(to_jsonb(module_rows)) from module_rows),'[]'::jsonb)
  ) into result;
  return result;
end
$$;
revoke all on function public.get_workspace_progress_report(uuid,date) from public,anon;
grant execute on function public.get_workspace_progress_report(uuid,date) to authenticated;

-- RLS / grants.
alter table public.ticket_modules enable row level security;
alter table public.ticket_tags enable row level security;
alter table public.ticket_tag_links enable row level security;
alter table public.ticket_links enable row level security;
alter table public.custom_ticket_fields enable row level security;
alter table public.custom_ticket_field_products enable row level security;
alter table public.ticket_custom_field_values enable row level security;
alter table public.executive_reports enable row level security;

grant select,insert,update,delete on public.ticket_modules,public.ticket_tags,public.ticket_tag_links,public.ticket_links,public.custom_ticket_fields,public.custom_ticket_field_products,public.ticket_custom_field_values,public.executive_reports to authenticated;

-- Modules.
drop policy if exists ticket_modules_select on public.ticket_modules;
create policy ticket_modules_select on public.ticket_modules for select to authenticated using(
  private.is_workspace_member(workspace_id) and (
    private.has_workspace_permission(workspace_id,'view_tickets') or private.has_workspace_permission(workspace_id,'manage_ticket_fields')
  )
);
drop policy if exists ticket_modules_manage on public.ticket_modules;
create policy ticket_modules_manage on public.ticket_modules for all to authenticated
using(private.has_workspace_permission(workspace_id,'manage_ticket_fields'))
with check(private.has_workspace_permission(workspace_id,'manage_ticket_fields'));

-- Tags catalog.
drop policy if exists ticket_tags_select on public.ticket_tags;
create policy ticket_tags_select on public.ticket_tags for select to authenticated using(
  private.is_workspace_member(workspace_id) and (
    private.has_workspace_permission(workspace_id,'view_tickets') or private.has_workspace_permission(workspace_id,'create_tickets') or private.has_workspace_permission(workspace_id,'manage_ticket_fields')
  )
);
drop policy if exists ticket_tags_manage on public.ticket_tags;
create policy ticket_tags_manage on public.ticket_tags for all to authenticated
using(private.has_workspace_permission(workspace_id,'manage_ticket_fields'))
with check(private.has_workspace_permission(workspace_id,'manage_ticket_fields'));

-- Tag links.
drop policy if exists ticket_tag_links_select on public.ticket_tag_links;
create policy ticket_tag_links_select on public.ticket_tag_links for select to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_tag_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_tag_links_insert on public.ticket_tag_links;
create policy ticket_tag_links_insert on public.ticket_tag_links for insert to authenticated with check(
  created_by=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_tag_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_tag_links_delete on public.ticket_tag_links;
create policy ticket_tag_links_delete on public.ticket_tag_links for delete to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_tag_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);

-- Ticket links.
drop policy if exists ticket_links_select on public.ticket_links;
create policy ticket_links_select on public.ticket_links for select to authenticated using(
  exists(select 1 from public.tickets s where s.id=source_ticket_id and s.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(s.workspace_id,'view_tickets') and private.has_product_access(s.workspace_id,s.product_id))
  and exists(select 1 from public.tickets t where t.id=target_ticket_id and t.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_links_insert on public.ticket_links;
create policy ticket_links_insert on public.ticket_links for insert to authenticated with check(
  created_by=(select auth.uid())
  and exists(select 1 from public.tickets s where s.id=source_ticket_id and s.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(s.workspace_id,'edit_tickets') and private.has_product_access(s.workspace_id,s.product_id))
  and exists(select 1 from public.tickets t where t.id=target_ticket_id and t.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_links_delete on public.ticket_links;
create policy ticket_links_delete on public.ticket_links for delete to authenticated using(
  exists(select 1 from public.tickets s where s.id=source_ticket_id and s.workspace_id=ticket_links.workspace_id
    and private.has_workspace_permission(s.workspace_id,'edit_tickets') and private.has_product_access(s.workspace_id,s.product_id))
);

-- Custom field definitions.
drop policy if exists custom_ticket_fields_select on public.custom_ticket_fields;
create policy custom_ticket_fields_select on public.custom_ticket_fields for select to authenticated using(
  private.is_workspace_member(workspace_id) and (
    private.has_workspace_permission(workspace_id,'view_tickets') or private.has_workspace_permission(workspace_id,'create_tickets') or private.has_workspace_permission(workspace_id,'manage_ticket_fields')
  )
);
drop policy if exists custom_ticket_fields_manage on public.custom_ticket_fields;
create policy custom_ticket_fields_manage on public.custom_ticket_fields for all to authenticated
using(private.has_workspace_permission(workspace_id,'manage_ticket_fields'))
with check(private.has_workspace_permission(workspace_id,'manage_ticket_fields'));

drop policy if exists custom_ticket_field_products_select on public.custom_ticket_field_products;
create policy custom_ticket_field_products_select on public.custom_ticket_field_products for select to authenticated using(
  private.is_workspace_member(workspace_id)
);
drop policy if exists custom_ticket_field_products_manage on public.custom_ticket_field_products;
create policy custom_ticket_field_products_manage on public.custom_ticket_field_products for all to authenticated
using(private.has_workspace_permission(workspace_id,'manage_ticket_fields'))
with check(private.has_workspace_permission(workspace_id,'manage_ticket_fields'));

-- Custom values.
drop policy if exists ticket_custom_values_select on public.ticket_custom_field_values;
create policy ticket_custom_values_select on public.ticket_custom_field_values for select to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_custom_field_values.workspace_id
    and private.has_workspace_permission(t.workspace_id,'view_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);
drop policy if exists ticket_custom_values_insert on public.ticket_custom_field_values;
create policy ticket_custom_values_insert on public.ticket_custom_field_values for insert to authenticated with check(
  updated_by=(select auth.uid()) and exists(select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_custom_field_values.workspace_id
    and private.has_product_access(t.workspace_id,t.product_id)
    and (private.has_workspace_permission(t.workspace_id,'edit_tickets') or (t.reporter_id=(select auth.uid()) and private.has_workspace_permission(t.workspace_id,'create_tickets'))))
);
drop policy if exists ticket_custom_values_update on public.ticket_custom_field_values;
create policy ticket_custom_values_update on public.ticket_custom_field_values for update to authenticated
using(exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id)))
with check(exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id)));
drop policy if exists ticket_custom_values_delete on public.ticket_custom_field_values;
create policy ticket_custom_values_delete on public.ticket_custom_field_values for delete to authenticated using(
  exists(select 1 from public.tickets t where t.id=ticket_id and private.has_workspace_permission(t.workspace_id,'edit_tickets') and private.has_product_access(t.workspace_id,t.product_id))
);

-- Reports history.
drop policy if exists executive_reports_select on public.executive_reports;
create policy executive_reports_select on public.executive_reports for select to authenticated using(
  private.has_workspace_permission(workspace_id,'view_dashboard')
);
drop policy if exists executive_reports_insert on public.executive_reports;
create policy executive_reports_insert on public.executive_reports for insert to authenticated with check(
  generated_by=(select auth.uid()) and private.has_workspace_permission(workspace_id,'view_dashboard')
);
drop policy if exists executive_reports_delete on public.executive_reports;
create policy executive_reports_delete on public.executive_reports for delete to authenticated using(
  private.has_workspace_role(workspace_id,array['superadmin','admin']::public.app_role[])
);

-- v15 correction: ticket uploaders may read module catalog to classify new tickets.
drop policy if exists ticket_modules_select on public.ticket_modules;
create policy ticket_modules_select on public.ticket_modules for select to authenticated using(
  private.is_workspace_member(workspace_id) and (
    private.has_workspace_permission(workspace_id,'view_tickets')
    or private.has_workspace_permission(workspace_id,'create_tickets')
    or private.has_workspace_permission(workspace_id,'manage_ticket_fields')
  )
);

create or replace function private.notify_ticket_link_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_source public.tickets%rowtype;
  v_target public.tickets%rowtype;
  v_in_app boolean:=true;
  v_title text;
  v_body text;
  v_type text;
  v_user uuid;
begin
  if tg_op='INSERT' then
    select * into v_source from public.tickets where id=new.source_ticket_id;
    select * into v_target from public.tickets where id=new.target_ticket_id;
    if new.link_type='blocks' then
      v_type:='ticket_blocked';v_title:=v_target.ticket_key||' bloqueado por '||v_source.ticket_key;v_body:=v_source.title;
    elsif new.link_type='follows' then
      v_type:='ticket_followup';v_title:=v_source.ticket_key||' da seguimiento a '||v_target.ticket_key;v_body:=v_source.title;
    else
      v_type:='ticket_related';v_title:=v_source.ticket_key||' relacionado con '||v_target.ticket_key;v_body:=coalesce(new.note,v_source.title);
    end if;
  else
    select * into v_source from public.tickets where id=old.source_ticket_id;
    select * into v_target from public.tickets where id=old.target_ticket_id;
    if old.link_type<>'blocks' then return old; end if;
    v_type:='ticket_dependency_released';v_title:='Dependencia retirada · '||coalesce(v_target.ticket_key,'Ticket');v_body:='Ya no está bloqueado por '||coalesce(v_source.ticket_key,'el ticket relacionado')||'.';
  end if;

  select coalesce(in_app_notifications,true) into v_in_app from public.workspace_settings where workspace_id=coalesce(v_target.workspace_id,v_source.workspace_id);
  if coalesce(v_in_app,true) then
    for v_user in
      select distinct x.uid from (
        values(v_target.reporter_id),(v_target.dev_owner_id),(v_target.qa_owner_id),(v_source.dev_owner_id),(v_source.qa_owner_id)
      ) as x(uid)
      where x.uid is not null and x.uid is distinct from auth.uid()
    loop
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(coalesce(v_target.workspace_id,v_source.workspace_id),v_user,coalesce(v_target.id,v_source.id),v_type,v_title,v_body);
    end loop;
  end if;
  if tg_op='INSERT' then return new; else return old; end if;
end
$$;
revoke all on function private.notify_ticket_link_change() from public,anon,authenticated;

drop trigger if exists trg_notify_ticket_link_change on public.ticket_links;
create trigger trg_notify_ticket_link_change
after insert or delete on public.ticket_links
for each row execute function private.notify_ticket_link_change();

create or replace function public.import_backlog_tickets(p_workspace uuid,p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_row jsonb;
  v_count integer:=0;
  v_keys text[]:=array[]::text[];
  v_id uuid;
  v_key text;
  v_sp integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not private.has_workspace_permission(p_workspace,'manage_sprints') then
    raise exception 'Solo PM, Admin, Superadmin o un rol con permiso de Backlog/Sprints puede importar tickets';
  end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Formato de importación inválido'; end if;
  if jsonb_array_length(p_rows)=0 then raise exception 'No hay filas para importar'; end if;
  if jsonb_array_length(p_rows)>250 then raise exception 'Máximo 250 tickets por importación'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if coalesce(nullif(trim(v_row->>'title'),''),'')='' then raise exception 'Todos los tickets requieren título'; end if;
    if coalesce(nullif(v_row->>'product_id',''),'')='' then raise exception 'Todos los tickets requieren producto'; end if;
    v_sp:=case when nullif(v_row->>'story_points','') is null then null else (v_row->>'story_points')::integer end;
    if v_sp is not null and v_sp not between 1 and 5 then raise exception 'Story Points debe estar entre 1 y 5'; end if;
    insert into public.tickets(
      workspace_id,product_id,title,description,type,priority,status,reporter_id,
      sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date
    ) values (
      p_workspace,(v_row->>'product_id')::uuid,left(trim(v_row->>'title'),220),nullif(trim(coalesce(v_row->>'description','')),''),
      coalesce(nullif(v_row->>'type',''),'task')::public.ticket_type,coalesce(nullif(v_row->>'priority',''),'medium')::public.ticket_priority,
      'backlog'::public.ticket_status,auth.uid(),null,nullif(v_row->>'dev_owner_id','')::uuid,nullif(v_row->>'qa_owner_id','')::uuid,v_sp,
      nullif(v_row->>'start_date','')::date,nullif(v_row->>'due_date','')::date
    ) returning id,ticket_key into v_id,v_key;
    v_count:=v_count+1;v_keys:=array_append(v_keys,v_key);
  end loop;
  return jsonb_build_object('ok',true,'imported',v_count,'ticket_keys',to_jsonb(v_keys));
end
$$;
revoke all on function public.import_backlog_tickets(uuid,jsonb) from public,anon;
grant execute on function public.import_backlog_tickets(uuid,jsonb) to authenticated;

-- v15 correction: ticket uploaders can attach configured tags during ticket creation.
drop policy if exists ticket_tag_links_insert on public.ticket_tag_links;
create policy ticket_tag_links_insert on public.ticket_tag_links for insert to authenticated with check(
  created_by=(select auth.uid()) and exists(
    select 1 from public.tickets t where t.id=ticket_id and t.workspace_id=ticket_tag_links.workspace_id
      and private.has_product_access(t.workspace_id,t.product_id)
      and (
        private.has_workspace_permission(t.workspace_id,'edit_tickets')
        or (t.reporter_id=(select auth.uid()) and private.has_workspace_permission(t.workspace_id,'create_tickets'))
      )
  )
);

-- Do not expose custom-field product mappings to Helpdesk-only users.
drop policy if exists custom_ticket_field_products_select on public.custom_ticket_field_products;
create policy custom_ticket_field_products_select on public.custom_ticket_field_products for select to authenticated using(
  exists(
    select 1 from public.custom_ticket_fields f
    where f.id=field_id and f.workspace_id=custom_ticket_field_products.workspace_id
      and (
        private.has_workspace_permission(f.workspace_id,'view_tickets')
        or private.has_workspace_permission(f.workspace_id,'create_tickets')
        or private.has_workspace_permission(f.workspace_id,'manage_ticket_fields')
      )
  )
);

-- v15 final: dependency release/reblock notifications.
create or replace function private.notify_blocker_status_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  dep record;
  v_user uuid;
  v_type text;
  v_title text;
  v_body text;
  was_released boolean := old.status in ('qa_passed','closed');
  is_released boolean := new.status in ('qa_passed','closed');
begin
  if was_released=is_released then return new; end if;

  for dep in
    select l.target_ticket_id,t.workspace_id,t.ticket_key,t.title,t.reporter_id,t.dev_owner_id,t.qa_owner_id
    from public.ticket_links l
    join public.tickets t on t.id=l.target_ticket_id
    where l.source_ticket_id=new.id and l.link_type='blocks'
  loop
    if is_released then
      v_type:='ticket_dependency_released';
      v_title:=dep.ticket_key||' · dependencia liberada';
      v_body:=new.ticket_key||' llegó a '||case when new.status='closed' then 'Cerrado' else 'QA aprobado' end||'. El ticket ya puede continuar si no tiene otros bloqueos.';
    else
      v_type:='ticket_blocked';
      v_title:=dep.ticket_key||' vuelve a estar bloqueado';
      v_body:=new.ticket_key||' dejó un estado liberado y vuelve a bloquear esta actividad.';
    end if;

    for v_user in
      select distinct x.uid from (values(dep.reporter_id),(dep.dev_owner_id),(dep.qa_owner_id)) as x(uid)
      where x.uid is not null and x.uid is distinct from auth.uid()
    loop
      insert into public.notifications(workspace_id,user_id,ticket_id,type,title,body)
      values(dep.workspace_id,v_user,dep.target_ticket_id,v_type,v_title,v_body);
    end loop;
  end loop;
  return new;
end
$$;
revoke all on function private.notify_blocker_status_change() from public,anon,authenticated;
drop trigger if exists trg_notify_blocker_status_change on public.tickets;
create trigger trg_notify_blocker_status_change after update of status on public.tickets for each row execute function private.notify_blocker_status_change();

-- v15 atomic ticket save: core ticket + module + tags + custom fields commit together.
create or replace function public.save_ticket_documented(
  p_ticket_id uuid,
  p_workspace uuid,
  p_product_id uuid,
  p_title text,
  p_description text default null,
  p_type public.ticket_type default 'task',
  p_priority public.ticket_priority default 'medium',
  p_status public.ticket_status default 'backlog',
  p_sprint_id uuid default null,
  p_dev_owner_id uuid default null,
  p_qa_owner_id uuid default null,
  p_story_points integer default null,
  p_start_date date default null,
  p_due_date date default null,
  p_module_id uuid default null,
  p_tag_ids uuid[] default array[]::uuid[],
  p_custom_values jsonb default '{}'::jsonb
)
returns public.tickets
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_ticket public.tickets%rowtype;
  v_can_edit boolean;
  v_field public.custom_ticket_fields%rowtype;
  v_value jsonb;
  v_empty boolean;
  v_tag uuid;
  v_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'El título es obligatorio'; end if;
  if not private.has_workspace_permission(p_workspace,'create_tickets') and p_ticket_id is null then raise exception 'Tu rol no permite crear tickets'; end if;
  if not private.has_product_access(p_workspace,p_product_id) then raise exception 'No tienes acceso al producto seleccionado'; end if;
  if p_story_points is not null and p_story_points not between 1 and 5 then raise exception 'Story Points debe estar entre 1 y 5'; end if;

  v_can_edit:=private.has_workspace_permission(p_workspace,'edit_tickets');

  if p_ticket_id is null then
    insert into public.tickets(workspace_id,product_id,module_id,title,description,type,priority,status,reporter_id,sprint_id,dev_owner_id,qa_owner_id,story_points,start_date,due_date)
    values (
      p_workspace,p_product_id,p_module_id,left(btrim(p_title),220),nullif(btrim(coalesce(p_description,'')),''),p_type,p_priority,
      case when v_can_edit then p_status else 'backlog'::public.ticket_status end,auth.uid(),
      case when v_can_edit then p_sprint_id else null end,case when v_can_edit then p_dev_owner_id else null end,
      case when v_can_edit then p_qa_owner_id else null end,case when v_can_edit then p_story_points else null end,
      case when v_can_edit then p_start_date else null end,case when v_can_edit then p_due_date else null end
    ) returning * into v_ticket;
  else
    select * into v_ticket from public.tickets where id=p_ticket_id and workspace_id=p_workspace;
    if not found then raise exception 'Ticket no encontrado'; end if;
    if not v_can_edit then raise exception 'Tu rol no permite editar tickets'; end if;
    update public.tickets set product_id=p_product_id,module_id=p_module_id,title=left(btrim(p_title),220),description=nullif(btrim(coalesce(p_description,'')),''),type=p_type,priority=p_priority,status=p_status,sprint_id=p_sprint_id,dev_owner_id=p_dev_owner_id,qa_owner_id=p_qa_owner_id,story_points=p_story_points,start_date=p_start_date,due_date=p_due_date
    where id=p_ticket_id returning * into v_ticket;
  end if;

  for v_field in
    select f.* from public.custom_ticket_fields f
    where f.workspace_id=p_workspace and f.active
      and (f.applies_to_all_products or exists(select 1 from public.custom_ticket_field_products fp where fp.field_id=f.id and fp.workspace_id=p_workspace and fp.product_id=p_product_id))
    order by f.sort_order,f.name
  loop
    v_key:=v_field.id::text;v_value:=p_custom_values->v_key;
    v_empty:=v_value is null or v_value='null'::jsonb or (jsonb_typeof(v_value)='string' and btrim(trim(both '"' from v_value::text))='') or (jsonb_typeof(v_value)='array' and jsonb_array_length(v_value)=0);
    if v_field.required and v_empty then raise exception 'El campo % es obligatorio',v_field.name; end if;
  end loop;

  delete from public.ticket_tag_links l where l.ticket_id=v_ticket.id and not (l.tag_id=any(coalesce(p_tag_ids,array[]::uuid[])));
  foreach v_tag in array coalesce(p_tag_ids,array[]::uuid[]) loop
    insert into public.ticket_tag_links(workspace_id,ticket_id,tag_id,created_by) values(p_workspace,v_ticket.id,v_tag,auth.uid()) on conflict(ticket_id,tag_id) do nothing;
  end loop;

  delete from public.ticket_custom_field_values cv
  where cv.ticket_id=v_ticket.id and exists(
    select 1 from public.custom_ticket_fields f where f.id=cv.field_id and f.workspace_id=p_workspace
      and (f.applies_to_all_products or exists(select 1 from public.custom_ticket_field_products fp where fp.field_id=f.id and fp.workspace_id=p_workspace and fp.product_id=p_product_id))
  );

  for v_field in
    select f.* from public.custom_ticket_fields f
    where f.workspace_id=p_workspace and f.active
      and (f.applies_to_all_products or exists(select 1 from public.custom_ticket_field_products fp where fp.field_id=f.id and fp.workspace_id=p_workspace and fp.product_id=p_product_id))
  loop
    v_key:=v_field.id::text;v_value:=p_custom_values->v_key;
    v_empty:=v_value is null or v_value='null'::jsonb or (jsonb_typeof(v_value)='string' and btrim(trim(both '"' from v_value::text))='') or (jsonb_typeof(v_value)='array' and jsonb_array_length(v_value)=0);
    if not v_empty then
      insert into public.ticket_custom_field_values(workspace_id,ticket_id,field_id,value,updated_by) values(p_workspace,v_ticket.id,v_field.id,v_value,auth.uid());
    end if;
  end loop;

  return v_ticket;
end
$$;
revoke all on function public.save_ticket_documented(uuid,uuid,uuid,text,text,public.ticket_type,public.ticket_priority,public.ticket_status,uuid,uuid,uuid,integer,date,date,uuid,uuid[],jsonb) from public,anon;
grant execute on function public.save_ticket_documented(uuid,uuid,uuid,text,text,public.ticket_type,public.ticket_priority,public.ticket_status,uuid,uuid,uuid,integer,date,date,uuid,uuid[],jsonb) to authenticated;
