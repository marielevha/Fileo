alter table public.contents
  add column if not exists summary text,
  add column if not exists body text,
  add column if not exists task_key text,
  add column if not exists duration_seconds integer,
  add column if not exists transcript text,
  add column if not exists video_url text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists status text not null default 'draft',
  add column if not exists created_by uuid references public.app_users(id) on delete set null;

update public.contents
set
  summary = coalesce(summary, body_json ->> 'summary'),
  body = coalesce(body, body_json ->> 'body'),
  task_key = coalesce(task_key, body_json ->> 'task_key'),
  transcript = coalesce(transcript, body_json ->> 'transcript'),
  video_url = coalesce(video_url, body_json ->> 'video_url'),
  status = case when published_at is null then 'draft' else 'published' end
where summary is null
   or body is null
   or task_key is null
   or transcript is null
   or video_url is null
   or status = 'draft';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contents_duration_nonnegative'
  ) then
    alter table public.contents
      add constraint contents_duration_nonnegative
      check (duration_seconds is null or duration_seconds >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'contents_status_valid'
  ) then
    alter table public.contents
      add constraint contents_status_valid
      check (status in ('draft', 'published', 'archived'));
  end if;
end
$$;

create index if not exists contents_published_idx
on public.contents (kind, locale, status, sort_order, published_at desc)
where status = 'published';

alter table public.contents enable row level security;
alter table public.app_users enable row level security;
alter table public.plans enable row level security;
alter table public.tickets enable row level security;

alter function public.set_updated_at() set search_path = pg_catalog;
