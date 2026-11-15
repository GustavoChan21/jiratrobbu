-- Jira Interno TROBBU v17.18.1 · richer audit event detail
begin;

create or replace function private.capture_app_audit()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_row jsonb:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb:=case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb:=case when TG_OP='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_workspace uuid; v_actor uuid:=(select auth.uid()); v_session_id uuid;
  v_changed jsonb:='[]'::jsonb; v_changes jsonb:='{}'::jsonb; v_module text;
  v_action text:=lower(TG_OP); v_entity_id text; v_label text; v_metadata jsonb:='{}'::jsonb;
begin
  begin v_session_id:=nullif((select auth.jwt()->>'session_id'),'')::uuid; exception when others then v_session_id:=null; end;
  begin v_workspace:=nullif(v_row->>'workspace_id','')::uuid; exception when others then v_workspace:=null; end;
  if v_workspace is null then
    if TG_TABLE_NAME in ('ticket_comments','ticket_activity') then select workspace_id into v_workspace from public.tickets where id=nullif(v_row->>'ticket_id','')::uuid;
    elsif TG_TABLE_NAME='sprint_comments' then select workspace_id into v_workspace from public.sprints where id=nullif(v_row->>'sprint_id','')::uuid;
    elsif TG_TABLE_NAME in ('helpdesk_comments','helpdesk_activity') then select workspace_id into v_workspace from public.helpdesk_tickets where id=nullif(v_row->>'helpdesk_ticket_id','')::uuid;
    end if;
  end if;
  if v_workspace is null then return coalesce(new,old); end if;

  if TG_OP='UPDATE' then
    select coalesce(jsonb_agg(k order by k),'[]'::jsonb),coalesce(jsonb_object_agg(k,jsonb_build_object('before',before_v,'after',after_v)),'{}'::jsonb)
    into v_changed,v_changes
    from (
      select n.key k,
        case when n.key in ('password','token','secret','credentials','content','content_blocks') then to_jsonb('[contenido actualizado]'::text) else v_old->n.key end before_v,
        case when n.key in ('password','token','secret','credentials','content','content_blocks') then to_jsonb('[contenido actualizado]'::text) else n.value end after_v
      from jsonb_each(v_new) n
      where (v_old->n.key) is distinct from n.value and n.key not in ('updated_at','content_updated_at')
    ) q;
  end if;

  v_module:=case when TG_TABLE_NAME like 'helpdesk_%' then 'helpdesk' when TG_TABLE_NAME like 'knowledge_%' then 'knowledge' when TG_TABLE_NAME like 'vacation_%' then 'vacations' when TG_TABLE_NAME in ('sprints','sprint_comments','sprint_attachments') then 'sprints' when TG_TABLE_NAME in ('workspace_members','workspace_roles','workspace_member_products') then 'staff' when TG_TABLE_NAME='workspace_settings' then 'settings' when TG_TABLE_NAME in ('products','ticket_modules','ticket_tags','ticket_tag_links','custom_ticket_fields','custom_ticket_field_products','ticket_custom_field_values') then 'catalogs' else 'tickets' end;

  if TG_TABLE_NAME='knowledge_version_events' then v_action:=coalesce(v_row->>'event_type',lower(TG_OP));
  elsif TG_TABLE_NAME='knowledge_article_versions' and TG_OP='INSERT' and coalesce(v_row->>'status','')='draft' then v_action:=case when coalesce((v_row->>'version_number')::int,1)>1 then 'version_created' else 'draft_created' end;
  elsif TG_TABLE_NAME='knowledge_article_versions' and TG_OP='UPDATE' and (v_old->>'status') is distinct from (v_new->>'status') and v_new->>'status'='published' then v_action:='published';
  elsif TG_TABLE_NAME='knowledge_article_versions' and TG_OP='UPDATE' and coalesce(v_new->>'status','')='draft' and v_changed <> '[]'::jsonb then v_action:='draft_updated';
  elsif TG_OP='UPDATE' and (v_old->>'status') is distinct from (v_new->>'status') and (v_new ? 'status') then v_action:='status_change';
  elsif TG_OP='UPDATE' and ((v_old->>'assigned_to') is distinct from (v_new->>'assigned_to') or (v_old->>'dev_owner_id') is distinct from (v_new->>'dev_owner_id') or (v_old->>'qa_owner_id') is distinct from (v_new->>'qa_owner_id')) then v_action:='assignment_change';
  elsif TG_OP='INSERT' and TG_TABLE_NAME like '%comments' then v_action:='comment_added';
  elsif TG_OP='DELETE' and TG_TABLE_NAME like '%comments' then v_action:='comment_deleted';
  elsif TG_OP='INSERT' and TG_TABLE_NAME like '%attachments' then v_action:='attachment_added';
  elsif TG_OP='DELETE' and TG_TABLE_NAME like '%attachments' then v_action:='attachment_deleted';
  elsif TG_OP='INSERT' then v_action:='created'; elsif TG_OP='DELETE' then v_action:='deleted'; else v_action:='updated'; end if;

  v_entity_id:=coalesce(v_row->>'id',v_row->>'ticket_id',v_row->>'helpdesk_ticket_id',v_row->>'sprint_id',v_row->>'article_id',v_row->>'user_id',v_row->>'workspace_id');
  v_label:=coalesce(v_row->>'ticket_key',v_row->>'module_key',v_row->>'name',v_row->>'title',v_row->>'subject',v_row->>'file_name',v_row->>'code',v_row->>'user_id',v_entity_id,TG_TABLE_NAME);
  v_metadata:=jsonb_build_object('table',TG_TABLE_NAME,'operation',TG_OP,'changed_fields',v_changed,'changes',v_changes);
  if TG_TABLE_NAME='knowledge_article_versions' then v_metadata:=v_metadata||jsonb_build_object('article_id',v_row->>'article_id','version_number',v_row->>'version_number','version_status',v_row->>'status','change_note',v_row->>'change_note'); end if;
  if TG_TABLE_NAME='knowledge_version_events' then v_metadata:=v_metadata||jsonb_build_object('article_id',v_row->>'article_id','version_id',v_row->>'version_id','knowledge_event_type',v_row->>'event_type','note',v_row->>'note'); end if;
  if v_row ? 'status' then v_metadata:=v_metadata||jsonb_build_object('status',v_row->>'status','previous_status',v_old->>'status'); end if;
  if v_row ? 'assigned_to' then v_metadata:=v_metadata||jsonb_build_object('assigned_to',v_row->>'assigned_to','previous_assigned_to',v_old->>'assigned_to'); end if;
  if v_row ? 'dev_owner_id' then v_metadata:=v_metadata||jsonb_build_object('dev_owner_id',v_row->>'dev_owner_id','previous_dev_owner_id',v_old->>'dev_owner_id'); end if;
  if v_row ? 'qa_owner_id' then v_metadata:=v_metadata||jsonb_build_object('qa_owner_id',v_row->>'qa_owner_id','previous_qa_owner_id',v_old->>'qa_owner_id'); end if;

  insert into public.app_audit_events(workspace_id,actor_id,auth_session_id,source,event_type,module,action,entity_type,entity_id,entity_label,metadata)
  values(v_workspace,v_actor,v_session_id,case when v_actor is null then 'system' else 'database' end,'data_change',v_module,v_action,TG_TABLE_NAME,v_entity_id,left(v_label,240),v_metadata);
  return coalesce(new,old);
end;
$$;
revoke all on function private.capture_app_audit() from public,anon,authenticated;
commit;
