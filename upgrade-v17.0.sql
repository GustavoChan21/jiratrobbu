-- Jira Interno TROBBU v17.0
-- Knowledge relevance/RBAC, sprint product filters, configurable credentials,
-- Helpdesk prioritization/routing, Vacations + AI impact, and Knowledge taxonomy.

-- -----------------------------------------------------------------------------
-- 1) Expanded permissions
-- -----------------------------------------------------------------------------
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
      'manage_sprints','qa_review','manage_helpdesk','manage_staff','manage_products','manage_ticket_fields','manage_settings',
      'view_knowledge','create_knowledge','edit_knowledge','delete_knowledge',
      'view_vacations','request_vacations','manage_vacations'
    )
    when p_role='pm' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','delete_tickets',
      'manage_sprints','qa_review','manage_helpdesk','manage_ticket_fields',
      'view_knowledge','create_knowledge','edit_knowledge',
      'view_vacations','request_vacations','manage_vacations'
    )
    when p_role='dev' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets',
      'view_knowledge','view_vacations','request_vacations'
    )
    when p_role='qa' then p_permission in (
      'view_dashboard','view_tickets','create_tickets','edit_tickets','qa_review',
      'view_knowledge','view_vacations','request_vacations'
    )
    when p_role='consulta' then p_permission in (
      'view_dashboard','view_tickets','view_knowledge','view_vacations'
    )
    else false
  end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Knowledge taxonomy by product + category
-- -----------------------------------------------------------------------------
create table if not exists public.knowledge_categories(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  icon text not null default 'lucide:folder',
  color text not null default '#4D5A51',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,code),
  unique(id,workspace_id)
);
create index if not exists idx_knowledge_categories_workspace on public.knowledge_categories(workspace_id,active,sort_order,name);
alter table public.knowledge_categories enable row level security;
revoke all on public.knowledge_categories from anon;
grant select,insert,update,delete on public.knowledge_categories to authenticated;

drop policy if exists knowledge_categories_select on public.knowledge_categories;
create policy knowledge_categories_select on public.knowledge_categories for select to authenticated
using(private.has_workspace_permission(workspace_id,'view_knowledge') or private.has_workspace_permission(workspace_id,'create_knowledge') or private.has_workspace_permission(workspace_id,'edit_knowledge'));
drop policy if exists knowledge_categories_insert on public.knowledge_categories;
create policy knowledge_categories_insert on public.knowledge_categories for insert to authenticated
with check(private.has_workspace_permission(workspace_id,'edit_knowledge'));
drop policy if exists knowledge_categories_update on public.knowledge_categories;
create policy knowledge_categories_update on public.knowledge_categories for update to authenticated
using(private.has_workspace_permission(workspace_id,'edit_knowledge'))
with check(private.has_workspace_permission(workspace_id,'edit_knowledge'));
drop policy if exists knowledge_categories_delete on public.knowledge_categories;
create policy knowledge_categories_delete on public.knowledge_categories for delete to authenticated
using(private.has_workspace_permission(workspace_id,'delete_knowledge'));

drop trigger if exists trg_knowledge_categories_updated on public.knowledge_categories;
create trigger trg_knowledge_categories_updated before update on public.knowledge_categories for each row execute function public.set_updated_at();

insert into public.knowledge_categories(workspace_id,code,name,description,icon,color,sort_order)
select w.id,x.code,x.name,x.description,x.icon,x.color,x.sort_order
from public.workspaces w
cross join (values
  ('systems','Sistemas','Plataformas, integraciones, accesos y soporte técnico.','lucide:monitor-cog','#02488D',10),
  ('reception','Recepción','Operación de recepción, check-in, huéspedes y atención en sitio.','lucide:concierge-bell','#D1AA87',20),
  ('operations','Operaciones','Procesos operativos transversales y ejecución diaria.','lucide:workflow','#4D5A51',30),
  ('policies','Políticas','Políticas internas, criterios y lineamientos.','lucide:shield-check','#0C2B2A',40),
  ('sop','SOP','Procedimientos operativos estándar paso a paso.','lucide:list-checks','#056D25',50),
  ('reservations','Reservaciones','Reservas, tarifas, disponibilidad, OTAs y atención previa a llegada.','lucide:calendar-check','#0D47A1',60),
  ('administration','Administración','Procesos administrativos, pagos y controles internos.','lucide:briefcase-business','#AE6A3E',70),
  ('general','General','Información transversal sin categoría específica.','lucide:folder','#6B7280',999)
) as x(code,name,description,icon,color,sort_order)
on conflict(workspace_id,code) do update set
  name=excluded.name,description=excluded.description,icon=excluded.icon,color=excluded.color,sort_order=excluded.sort_order,active=true;

create or replace function private.seed_default_knowledge_categories()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.knowledge_categories(workspace_id,code,name,description,icon,color,sort_order)
  values
    (new.id,'systems','Sistemas','Plataformas, integraciones, accesos y soporte técnico.','lucide:monitor-cog','#02488D',10),
    (new.id,'reception','Recepción','Operación de recepción, check-in, huéspedes y atención en sitio.','lucide:concierge-bell','#D1AA87',20),
    (new.id,'operations','Operaciones','Procesos operativos transversales y ejecución diaria.','lucide:workflow','#4D5A51',30),
    (new.id,'policies','Políticas','Políticas internas, criterios y lineamientos.','lucide:shield-check','#0C2B2A',40),
    (new.id,'sop','SOP','Procedimientos operativos estándar paso a paso.','lucide:list-checks','#056D25',50),
    (new.id,'reservations','Reservaciones','Reservas, tarifas, disponibilidad, OTAs y atención previa a llegada.','lucide:calendar-check','#0D47A1',60),
    (new.id,'administration','Administración','Procesos administrativos, pagos y controles internos.','lucide:briefcase-business','#AE6A3E',70),
    (new.id,'general','General','Información transversal sin categoría específica.','lucide:folder','#6B7280',999)
  on conflict(workspace_id,code) do nothing;
  return new;
end $$;
revoke all on function private.seed_default_knowledge_categories() from public,anon,authenticated;
drop trigger if exists trg_seed_default_knowledge_categories on public.workspaces;
create trigger trg_seed_default_knowledge_categories after insert on public.workspaces for each row execute function private.seed_default_knowledge_categories();

alter table public.knowledge_articles add column if not exists category_id uuid;
alter table public.knowledge_article_versions add column if not exists category_id uuid;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='knowledge_articles_category_workspace_fkey') then
    alter table public.knowledge_articles add constraint knowledge_articles_category_workspace_fkey
      foreign key(category_id,workspace_id) references public.knowledge_categories(id,workspace_id) on delete restrict;
  end if;
  if not exists(select 1 from pg_constraint where conname='knowledge_versions_category_workspace_fkey') then
    alter table public.knowledge_article_versions add constraint knowledge_versions_category_workspace_fkey
      foreign key(category_id,workspace_id) references public.knowledge_categories(id,workspace_id) on delete restrict;
  end if;
end $$;
create index if not exists idx_knowledge_articles_category on public.knowledge_articles(workspace_id,category_id) where category_id is not null;
create index if not exists idx_knowledge_versions_category on public.knowledge_article_versions(workspace_id,category_id) where category_id is not null;

-- Knowledge RLS now uses dedicated capabilities.
drop policy if exists knowledge_articles_select on public.knowledge_articles;
create policy knowledge_articles_select on public.knowledge_articles for select to authenticated using (
  (status='published' and private.has_workspace_permission(workspace_id,'view_knowledge'))
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or (status='draft' and active_version_id is null and created_by=(select auth.uid()) and private.has_workspace_permission(workspace_id,'create_knowledge'))
);
drop policy if exists knowledge_articles_insert on public.knowledge_articles;
create policy knowledge_articles_insert on public.knowledge_articles for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_knowledge')
  and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists knowledge_articles_update on public.knowledge_articles;
create policy knowledge_articles_update on public.knowledge_articles for update to authenticated
using(
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
)
with check(
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
);
drop policy if exists knowledge_articles_delete on public.knowledge_articles;
create policy knowledge_articles_delete on public.knowledge_articles for delete to authenticated
using(
  private.has_workspace_permission(workspace_id,'delete_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft' and active_version_id is null
  )
);

drop policy if exists knowledge_versions_select on public.knowledge_article_versions;
create policy knowledge_versions_select on public.knowledge_article_versions for select to authenticated using (
  (status in ('published','archived') and private.has_workspace_permission(workspace_id,'view_knowledge'))
  or private.has_workspace_permission(workspace_id,'edit_knowledge')
  or (status='draft' and created_by=(select auth.uid()) and private.has_workspace_permission(workspace_id,'create_knowledge'))
);
drop policy if exists knowledge_versions_insert on public.knowledge_article_versions;
create policy knowledge_versions_insert on public.knowledge_article_versions for insert to authenticated with check (
  private.has_workspace_permission(workspace_id,'create_knowledge')
  and (created_by is null or created_by=(select auth.uid()))
);
drop policy if exists knowledge_versions_update on public.knowledge_article_versions;
create policy knowledge_versions_update on public.knowledge_article_versions for update to authenticated
using(
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft'
  )
)
with check(
  private.has_workspace_permission(workspace_id,'edit_knowledge') or (
    private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid()) and status='draft'
  )
);
drop policy if exists knowledge_versions_delete on public.knowledge_article_versions;
create policy knowledge_versions_delete on public.knowledge_article_versions for delete to authenticated using (
  status='draft' and (
    private.has_workspace_permission(workspace_id,'delete_knowledge') or (
      private.has_workspace_permission(workspace_id,'create_knowledge') and created_by=(select auth.uid())
    )
  )
);
drop policy if exists knowledge_version_events_select on public.knowledge_version_events;
create policy knowledge_version_events_select on public.knowledge_version_events for select to authenticated
using(private.has_workspace_permission(workspace_id,'view_knowledge'));
drop policy if exists knowledge_translations_select on public.knowledge_version_translations;
create policy knowledge_translations_select on public.knowledge_version_translations for select to authenticated using (
  private.has_workspace_permission(workspace_id,'view_knowledge') and exists(
    select 1 from public.knowledge_article_versions v where v.id=version_id and v.workspace_id=knowledge_version_translations.workspace_id
      and (v.status in ('published','archived') or private.has_workspace_permission(v.workspace_id,'edit_knowledge'))
  )
);

drop policy if exists knowledge_media_select on public.knowledge_media;
create policy knowledge_media_select on public.knowledge_media for select to authenticated using (
  exists(select 1 from public.knowledge_articles a where a.id=article_id and a.workspace_id=knowledge_media.workspace_id and (
    (a.status='published' and private.has_workspace_permission(a.workspace_id,'view_knowledge'))
    or private.has_workspace_permission(a.workspace_id,'edit_knowledge')
    or (a.status='draft' and a.active_version_id is null and a.created_by=(select auth.uid()) and private.has_workspace_permission(a.workspace_id,'create_knowledge'))
  ))
);
drop policy if exists knowledge_media_insert on public.knowledge_media;
create policy knowledge_media_insert on public.knowledge_media for insert to authenticated with check (
  uploaded_by=(select auth.uid()) and exists(
    select 1 from public.knowledge_articles a where a.id=article_id and a.workspace_id=knowledge_media.workspace_id and (
      private.has_workspace_permission(a.workspace_id,'edit_knowledge') or (
        private.has_workspace_permission(a.workspace_id,'create_knowledge') and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
      )
    )
  )
);
drop policy if exists knowledge_media_delete on public.knowledge_media;
create policy knowledge_media_delete on public.knowledge_media for delete to authenticated
using(
  private.has_workspace_permission(workspace_id,'delete_knowledge') or private.has_workspace_permission(workspace_id,'edit_knowledge') or exists(
    select 1 from public.knowledge_articles a where a.id=article_id and a.workspace_id=knowledge_media.workspace_id
      and private.has_workspace_permission(a.workspace_id,'create_knowledge') and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
  )
);

-- Preserve category through version lifecycle and use edit_knowledge instead of manage_settings.
create or replace function public.create_knowledge_draft_version(p_article_id uuid,p_change_note text)
returns uuid language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare a public.knowledge_articles%rowtype;src public.knowledge_article_versions%rowtype;v_id uuid;v_no int;
begin
  select * into a from public.knowledge_articles where id=p_article_id;if not found then raise exception 'Knowledge article not found';end if;
  if not private.has_workspace_permission(a.workspace_id,'edit_knowledge') then raise exception 'Insufficient Knowledge permissions';end if;
  if nullif(btrim(coalesce(p_change_note,'')),'') is null then raise exception 'Describe why this new version is being created';end if;
  if a.draft_version_id is not null then raise exception 'This article already has an active draft version';end if;
  if a.active_version_id is not null then select * into src from public.knowledge_article_versions where id=a.active_version_id;
  else src.title:=a.title;src.slug:=a.slug;src.summary:=a.summary;src.content:=a.content;src.content_blocks:=a.content_blocks;src.tags:=a.tags;src.product_id:=a.product_id;src.module_id:=a.module_id;src.category_id:=a.category_id;end if;
  select coalesce(max(version_number),0)+1 into v_no from public.knowledge_article_versions where article_id=a.id;
  insert into public.knowledge_article_versions(article_id,workspace_id,version_number,status,change_note,title,slug,summary,content,content_blocks,tags,product_id,module_id,category_id,created_by,updated_by)
  values(a.id,a.workspace_id,v_no,'draft',btrim(p_change_note),src.title,src.slug,src.summary,src.content,src.content_blocks,src.tags,src.product_id,src.module_id,src.category_id,(select auth.uid()),(select auth.uid())) returning id into v_id;
  update public.knowledge_articles set draft_version_id=v_id where id=a.id;return v_id;
end $$;
revoke all on function public.create_knowledge_draft_version(uuid,text) from public,anon;grant execute on function public.create_knowledge_draft_version(uuid,text) to authenticated;

create or replace function public.publish_knowledge_version(p_version_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;a public.knowledge_articles%rowtype;old_id uuid;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id;if not found then raise exception 'Knowledge version not found';end if;
  select * into a from public.knowledge_articles where id=v.article_id;
  if not private.has_workspace_permission(v.workspace_id,'edit_knowledge') then raise exception 'Insufficient Knowledge permissions';end if;
  perform set_config('app.knowledge_publish','on',true);old_id:=a.active_version_id;
  if old_id is not null and old_id<>v.id then update public.knowledge_article_versions set status='archived' where id=old_id;end if;
  update public.knowledge_article_versions set status='published',published_by=(select auth.uid()),published_at=now() where id=v.id;
  update public.knowledge_articles set title=v.title,slug=v.slug,summary=v.summary,content=v.content,content_blocks=v.content_blocks,tags=v.tags,product_id=v.product_id,module_id=v.module_id,category_id=v.category_id,status='published',active_version_id=v.id,draft_version_id=case when draft_version_id=v.id then null else draft_version_id end,updated_by=(select auth.uid()),updated_at=now() where id=v.article_id;
  return jsonb_build_object('article_id',v.article_id,'version_id',v.id,'version_number',v.version_number);
end $$;
revoke all on function public.publish_knowledge_version(uuid) from public,anon;grant execute on function public.publish_knowledge_version(uuid) to authenticated;

create or replace function public.discard_knowledge_draft_version(p_version_id uuid)
returns boolean language plpgsql security invoker set search_path=public,private,pg_temp as $$
declare v public.knowledge_article_versions%rowtype;
begin
  select * into v from public.knowledge_article_versions where id=p_version_id and status='draft';if not found then raise exception 'Draft version not found';end if;
  if not private.has_workspace_permission(v.workspace_id,'edit_knowledge') then raise exception 'Insufficient Knowledge permissions';end if;
  update public.knowledge_articles set draft_version_id=null where id=v.article_id and draft_version_id=v.id;delete from public.knowledge_article_versions where id=v.id;return true;
end $$;
revoke all on function public.discard_knowledge_draft_version(uuid) from public,anon;grant execute on function public.discard_knowledge_draft_version(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Vacations / absences
-- -----------------------------------------------------------------------------
create table if not exists public.vacation_requests(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  decision_by uuid references auth.users(id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  ai_risk text check(ai_risk is null or ai_risk in ('low','medium','high','critical')),
  ai_recommendation text check(ai_recommendation is null or ai_recommendation in ('approve','approve_with_conditions','review','decline')),
  ai_summary text,
  ai_analysis jsonb not null default '{}'::jsonb,
  ai_analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(end_date>=start_date),
  check(end_date-start_date<=60)
);
create index if not exists idx_vacation_workspace_dates on public.vacation_requests(workspace_id,start_date,end_date,status);
create index if not exists idx_vacation_user_dates on public.vacation_requests(user_id,start_date,end_date,status);
alter table public.vacation_requests enable row level security;
revoke all on public.vacation_requests from anon;
grant select,insert,update,delete on public.vacation_requests to authenticated;

drop policy if exists vacation_requests_select on public.vacation_requests;
create policy vacation_requests_select on public.vacation_requests for select to authenticated using (
  private.is_workspace_member(workspace_id) and (
    user_id=(select auth.uid()) or private.has_workspace_permission(workspace_id,'manage_vacations') or (status='approved' and private.has_workspace_permission(workspace_id,'view_vacations'))
  )
);
drop policy if exists vacation_requests_insert on public.vacation_requests;
create policy vacation_requests_insert on public.vacation_requests for insert to authenticated with check (
  user_id=(select auth.uid()) and private.has_workspace_permission(workspace_id,'request_vacations') and status='pending'
);
drop policy if exists vacation_requests_update on public.vacation_requests;
create policy vacation_requests_update on public.vacation_requests for update to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_vacations') or (user_id=(select auth.uid()) and status='pending')
) with check (
  private.has_workspace_permission(workspace_id,'manage_vacations') or (user_id=(select auth.uid()) and status in ('pending','cancelled'))
);
drop policy if exists vacation_requests_delete on public.vacation_requests;
create policy vacation_requests_delete on public.vacation_requests for delete to authenticated using (
  private.has_workspace_permission(workspace_id,'manage_vacations') or (user_id=(select auth.uid()) and status in ('pending','cancelled'))
);

drop trigger if exists trg_vacation_updated on public.vacation_requests;
create trigger trg_vacation_updated before update on public.vacation_requests for each row execute function public.set_updated_at();

create or replace function private.guard_vacation_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_service boolean:=coalesce(current_setting('request.jwt.claim.role',true),'')='service_role';
  v_manage boolean;
begin
  v_manage:=v_service or private.has_workspace_permission(new.workspace_id,'manage_vacations');
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=new.workspace_id and wm.user_id=new.user_id and wm.active=true) then
    raise exception 'Vacation requester must be an active member of the workspace';
  end if;
  if tg_op='INSERT' then
    if not v_manage then
      new.decision_by:=null;new.decision_note:=null;new.decided_at:=null;
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
  else
    if old.status<>'pending' and new.status is distinct from old.status then raise exception 'Only pending vacation requests can change status';end if;
    if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date or new.user_id is distinct from old.user_id then
      new.ai_risk:=null;new.ai_recommendation:=null;new.ai_summary:=null;new.ai_analysis:='{}'::jsonb;new.ai_analyzed_at:=null;
    end if;
    if not v_manage then
      if new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id then raise exception 'Requester cannot change workspace or owner';end if;
      if new.decision_by is distinct from old.decision_by or new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at
         or new.ai_risk is distinct from old.ai_risk or new.ai_recommendation is distinct from old.ai_recommendation or new.ai_summary is distinct from old.ai_summary
         or new.ai_analysis is distinct from old.ai_analysis or new.ai_analyzed_at is distinct from old.ai_analyzed_at then
        raise exception 'Decision and AI analysis fields are restricted';
      end if;
      if new.status not in ('pending','cancelled') then raise exception 'Requester can only keep pending or cancel the request';end if;
    end if;
  end if;
  if new.status in ('pending','approved') and exists(
    select 1 from public.vacation_requests vr
    where vr.workspace_id=new.workspace_id and vr.user_id=new.user_id and vr.id<>new.id
      and vr.status in ('pending','approved') and vr.start_date<=new.end_date and vr.end_date>=new.start_date
  ) then raise exception 'Ya existe una solicitud pendiente o aprobada que se cruza con estas fechas';end if;
  if new.status='approved' then
    if new.ai_analyzed_at is null or new.ai_analysis is null or new.ai_analysis='{}'::jsonb then
      raise exception 'Analyze sprint impact before approving vacations';
    end if;
    if new.ai_analyzed_at < now()-interval '12 hours' then
      raise exception 'Vacation impact analysis is stale; analyze again before approving';
    end if;
    if exists(
      select 1 from public.tickets t
      where t.workspace_id=new.workspace_id and (t.dev_owner_id=new.user_id or t.qa_owner_id=new.user_id)
        and t.status<>'closed' and t.updated_at>new.ai_analyzed_at
    ) then raise exception 'Assigned work changed after the vacation analysis; analyze again before approving'; end if;
    if exists(
      select 1 from public.sprints s
      where s.workspace_id=new.workspace_id and s.status in ('active','planned')
        and s.start_date<=new.end_date and s.end_date>=new.start_date and s.updated_at>new.ai_analyzed_at
    ) then raise exception 'Sprint planning changed after the vacation analysis; analyze again before approving'; end if;
    if exists(
      select 1 from public.vacation_requests vr
      where vr.workspace_id=new.workspace_id and vr.id<>new.id and vr.status='approved'
        and vr.start_date<=new.end_date and vr.end_date>=new.start_date and vr.updated_at>new.ai_analyzed_at
    ) then raise exception 'Team availability changed after the vacation analysis; analyze again before approving'; end if;
  end if;
  if new.status in ('approved','rejected') then
    if not v_service then new.decision_by=(select auth.uid());
    elsif new.decision_by is null then new.decision_by=(select auth.uid()); end if;
    new.decided_at=coalesce(new.decided_at,now());
  end if;
  return new;
end $$;
revoke all on function private.guard_vacation_request() from public,anon,authenticated;
drop trigger if exists trg_guard_vacation_request on public.vacation_requests;
create trigger trg_guard_vacation_request before insert or update on public.vacation_requests for each row execute function private.guard_vacation_request();

create or replace function private.notify_vacation_request_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then
    insert into public.notifications(workspace_id,user_id,type,title,body,category,metadata)
    select new.workspace_id,wm.user_id,'vacation_requested','Nueva solicitud de vacaciones',
      coalesce(p.full_name,'Colaborador')||' solicitó ausencia del '||to_char(new.start_date,'DD/MM/YYYY')||' al '||to_char(new.end_date,'DD/MM/YYYY')||'.',
      'vacations',jsonb_build_object('entity_type','vacation','entity_id',new.id,'user_id',new.user_id,'start_date',new.start_date,'end_date',new.end_date)
    from public.workspace_members wm left join public.profiles p on p.id=new.user_id
    where wm.workspace_id=new.workspace_id and wm.active=true and wm.user_id<>new.user_id
      and private.member_has_permission(new.workspace_id,wm.user_id,'manage_vacations');
  elsif new.status is distinct from old.status then
    insert into public.notifications(workspace_id,user_id,type,title,body,category,metadata)
    values(new.workspace_id,new.user_id,'vacation_status',
      case new.status when 'approved' then 'Vacaciones aprobadas' when 'rejected' then 'Solicitud de vacaciones rechazada' when 'cancelled' then 'Solicitud de vacaciones cancelada' else 'Solicitud de vacaciones actualizada' end,
      coalesce(new.decision_note,case new.status when 'approved' then 'Tu ausencia fue aprobada y ya aparece en el calendario.' when 'rejected' then 'Revisa el detalle de la decisión.' else 'El estado de tu solicitud cambió.' end),
      'vacations',jsonb_build_object('entity_type','vacation','entity_id',new.id,'status',new.status,'start_date',new.start_date,'end_date',new.end_date));
  end if;
  return new;
end $$;
revoke all on function private.notify_vacation_request_change() from public,anon,authenticated;
drop trigger if exists trg_notify_vacation_request_change on public.vacation_requests;
create trigger trg_notify_vacation_request_change after insert or update of status on public.vacation_requests for each row execute function private.notify_vacation_request_change();

-- -----------------------------------------------------------------------------
-- 4) Knowledge storage helpers use dedicated permissions
-- -----------------------------------------------------------------------------
create or replace function private.can_view_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_dashboard'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'view_knowledge') and (a.status='published' or private.has_workspace_permission(v_workspace,'edit_knowledge')));
  end if;return false;
exception when invalid_text_representation then return false;end $$;
create or replace function private.can_upload_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='tickets' then return exists(select 1 from public.tickets t where t.id=v_parent and t.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets') and private.has_product_access(v_workspace,t.product_id));
  elsif v_scope='sprints' then return exists(select 1 from public.sprints s where s.id=v_parent and s.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'edit_tickets'));
  elsif v_scope='helpdesk' then return exists(select 1 from public.helpdesk_tickets h where h.id=v_parent and h.workspace_id=v_workspace and private.is_workspace_member(v_workspace) and (private.has_workspace_permission(v_workspace,'manage_helpdesk') or h.requester_user_id=(select auth.uid())));
  elsif v_scope='knowledge' then return exists(select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and (
    private.has_workspace_permission(v_workspace,'edit_knowledge') or (private.has_workspace_permission(v_workspace,'create_knowledge') and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null)
  ));
  end if;return false;
exception when invalid_text_representation then return false;end $$;
create or replace function private.can_manage_evidence_object(p_name text)
returns boolean language plpgsql stable security definer
set search_path=public,storage,pg_temp as $$
declare v_workspace uuid;v_parent uuid;v_scope text;
begin
  v_workspace:=split_part(p_name,'/',1)::uuid;v_scope:=split_part(p_name,'/',2);v_parent:=split_part(p_name,'/',3)::uuid;
  if v_scope='helpdesk' then return private.has_workspace_permission(v_workspace,'manage_helpdesk');
  elsif v_scope='sprints' then return private.has_workspace_permission(v_workspace,'manage_sprints');
  elsif v_scope='knowledge' then return private.has_workspace_permission(v_workspace,'delete_knowledge') or private.has_workspace_permission(v_workspace,'edit_knowledge') or exists(
    select 1 from public.knowledge_articles a where a.id=v_parent and a.workspace_id=v_workspace and private.has_workspace_permission(v_workspace,'create_knowledge') and a.created_by=(select auth.uid()) and a.status='draft' and a.active_version_id is null
  );
  end if;return private.has_workspace_permission(v_workspace,'delete_tickets');
exception when invalid_text_representation then return false;end $$;

-- Auto-assignment requires usable routing context at database level.
update public.workspace_members
set helpdesk_routing_description=coalesce(nullif(btrim(helpdesk_routing_description),''),'Atención general de Helpdesk; configurar responsabilidades específicas.')
where helpdesk_auto_assign_enabled=true and length(btrim(coalesce(helpdesk_routing_description,'')))<12;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='workspace_members_helpdesk_routing_context_check') then
    alter table public.workspace_members add constraint workspace_members_helpdesk_routing_context_check
      check (not helpdesk_auto_assign_enabled or length(btrim(coalesce(helpdesk_routing_description,'')))>=12);
  end if;
end $$;

-- Realtime additions.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='knowledge_categories') then alter publication supabase_realtime add table public.knowledge_categories; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='vacation_requests') then alter publication supabase_realtime add table public.vacation_requests; end if;
end $$;
