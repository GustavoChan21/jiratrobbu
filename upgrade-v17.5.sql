-- TROBBU Jira Interno v17.5
-- Knowledge native rich-text stabilization + configurable executive cover templates.
-- Baseline: v17.3.1 Final Completo. Re-runnable.

begin;

alter table public.workspace_settings
  add column if not exists knowledge_cover_templates jsonb not null default
  '{"forest":{"background":"#0C2B2A","background_alt":"#4D5A51","text":"#F8F2E8","accent":"#D1AA87","border":"#354A40","title_font":"Inter","body_font":"Inter"},"ivory":{"background":"#FFFDF9","background_alt":"#F1E4CD","text":"#26362F","accent":"#8A6345","border":"#E7D9C4","title_font":"Georgia","body_font":"Inter"},"midnight":{"background":"#07172E","background_alt":"#02488D","text":"#F7FAFF","accent":"#D1AA87","border":"#0B315A","title_font":"Inter","body_font":"Inter"}}'::jsonb;

-- Preserve custom values while filling every missing template/property.
with defaults as (
  select '{"forest":{"background":"#0C2B2A","background_alt":"#4D5A51","text":"#F8F2E8","accent":"#D1AA87","border":"#354A40","title_font":"Inter","body_font":"Inter"},"ivory":{"background":"#FFFDF9","background_alt":"#F1E4CD","text":"#26362F","accent":"#8A6345","border":"#E7D9C4","title_font":"Georgia","body_font":"Inter"},"midnight":{"background":"#07172E","background_alt":"#02488D","text":"#F7FAFF","accent":"#D1AA87","border":"#0B315A","title_font":"Inter","body_font":"Inter"}}'::jsonb as v
)
update public.workspace_settings ws
set knowledge_cover_templates=jsonb_build_object(
  'forest',(select v->'forest' from defaults)||coalesce(ws.knowledge_cover_templates->'forest','{}'::jsonb),
  'ivory',(select v->'ivory' from defaults)||coalesce(ws.knowledge_cover_templates->'ivory','{}'::jsonb),
  'midnight',(select v->'midnight' from defaults)||coalesce(ws.knowledge_cover_templates->'midnight','{}'::jsonb)
);

-- Re-normalize every existing article/version through the canonical v3 block
-- converter. This preserves legacy paragraph/text/heading/media blocks and
-- guarantees the v17.5 editor receives a supported shape without data loss.
update public.knowledge_articles
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),
    content_schema_version=3;

update public.knowledge_article_versions
set content_blocks=private.normalize_knowledge_blocks_v3(content_blocks,content),
    content_schema_version=3;

comment on column public.workspace_settings.knowledge_cover_templates is
  'Workspace-level visual parameters for Knowledge executive cover templates.';

commit;
