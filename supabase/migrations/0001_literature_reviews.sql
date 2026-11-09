create table reviews (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 owner text not null, question text not null, criteria text not null, protocol_ref text not null,
 due_on date not null, refresh_days integer not null default 90 check(refresh_days between 1 and 3650),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table searches (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references reviews(id),
 code text not null unique, name text not null, query text not null, searched_on date not null,
 records_found integer not null check(records_found>=0), evidence_ref text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table records (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references reviews(id),
 search_id uuid references searches(id), code text not null unique, name text not null,
 authors text not null default '', year integer check(year between 1500 and 2200), doi text not null default '',
 external_key text not null, study_key text not null default '', owner text not null,
 due_on date not null, abstract text not null default '', fulltext_ref text not null default '',
 retrieval_status text not null default 'pending' check(retrieval_status in ('pending','retrieved','unavailable')),
 retrieval_note text not null default '', duplicate_of uuid references records(id),
 source_row jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(review_id,external_key), check(duplicate_of is null or duplicate_of<>id),
 check(retrieval_status<>'retrieved' or length(trim(fulltext_ref))>0)
);
create table votes (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references records(id),
 stage text not null check(stage in ('abstract','fulltext')), reviewer text not null,
 decision text not null check(decision in ('include','exclude')), reason text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(record_id,stage,reviewer), check(decision<>'exclude' or length(trim(reason))>0)
);
create table resolutions (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references records(id),
 stage text not null check(stage in ('abstract','fulltext')), reviewer text not null,
 decision text not null check(decision in ('include','exclude')), reason text not null check(length(trim(reason))>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(record_id,stage)
);
create table extractions (
 id uuid primary key default gen_random_uuid(), record_id uuid not null references records(id),
 field text not null, value text not null, source_ref text not null, extractor text not null,
 checked_by text, checked_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(record_id,field), check(checked_by is null or checked_by<>extractor),
 check((checked_by is null)=(checked_on is null))
);
create table appraisals (
 id uuid primary key default gen_random_uuid(), record_id uuid not null unique references records(id),
 tool text not null, judgement text not null, rationale text not null, reviewer text not null,
 source_ref text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table activity (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references reviews(id),
 actor text not null, action text not null, details jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references reviews(id),
 source text not null, sha256 text not null, row_count integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(review_id,sha256)
);
create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger touch_reviews before update on reviews for each row execute function touch_updated_at();
alter table reviews enable row level security;
revoke all on reviews from public;
create trigger touch_searches before update on searches for each row execute function touch_updated_at();
alter table searches enable row level security;
revoke all on searches from public;
create trigger touch_records before update on records for each row execute function touch_updated_at();
alter table records enable row level security;
revoke all on records from public;
create trigger touch_votes before update on votes for each row execute function touch_updated_at();
alter table votes enable row level security;
revoke all on votes from public;
create trigger touch_resolutions before update on resolutions for each row execute function touch_updated_at();
alter table resolutions enable row level security;
revoke all on resolutions from public;
create trigger touch_extractions before update on extractions for each row execute function touch_updated_at();
alter table extractions enable row level security;
revoke all on extractions from public;
create trigger touch_appraisals before update on appraisals for each row execute function touch_updated_at();
alter table appraisals enable row level security;
revoke all on appraisals from public;
create trigger touch_activity before update on activity for each row execute function touch_updated_at();
alter table activity enable row level security;
revoke all on activity from public;
create trigger touch_imports before update on imports for each row execute function touch_updated_at();
alter table imports enable row level security;
revoke all on imports from public;

create index records_review on records(review_id);
create index votes_record on votes(record_id);
create index extractions_record on extractions(record_id);
create index searches_review on searches(review_id);
create view screening_state as
 select r.id record_id, s.stage, count(v.id)::integer votes,
 case when z.id is not null then z.decision
      when count(v.id)=2 and min(v.decision)=max(v.decision) then min(v.decision)
      when count(v.id)=2 then 'conflict' else 'pending' end decision,
 coalesce(z.reason,string_agg(nullif(v.reason,''),'; ' order by v.reviewer),'') reason
 from records r cross join (values ('abstract'),('fulltext')) s(stage)
 left join votes v on v.record_id=r.id and v.stage=s.stage
 left join resolutions z on z.record_id=r.id and z.stage=s.stage
 group by r.id,s.stage,z.id,z.decision,z.reason;
create view record_status as
 select r.*,rv.code review, a.decision abstract_decision,a.votes abstract_votes,
 f.decision fulltext_decision,f.votes fulltext_votes,f.reason exclusion_reason,
 case when r.duplicate_of is not null then 'duplicate'
      when a.decision='exclude' then 'abstract_excluded'
      when a.decision='conflict' then 'abstract_conflict'
      when a.decision='pending' then 'abstract_pending'
      when r.retrieval_status='unavailable' then 'not_retrieved'
      when r.retrieval_status='pending' then 'retrieval_pending'
      when f.decision='exclude' then 'fulltext_excluded'
      when f.decision='conflict' then 'fulltext_conflict'
      when f.decision='pending' then 'fulltext_pending'
      else 'included' end status
 from records r join reviews rv on rv.id=r.review_id
 join screening_state a on a.record_id=r.id and a.stage='abstract'
 join screening_state f on f.record_id=r.id and f.stage='fulltext';
create view review_week as
 select rv.code review,rv.name,rv.owner,rv.due_on,count(s.id)::integer records,
 count(s.id) filter(where s.status='included')::integer included,
 count(s.id) filter(where s.status like '%conflict')::integer conflicts,
 count(s.id) filter(where s.status like '%pending')::integer waiting
 from reviews rv left join record_status s on s.review_id=rv.id group by rv.id;
create view extraction_queue as
 select r.review,r.code,r.name,r.owner,e.field,e.value,e.extractor,e.source_ref,
 e.checked_by,e.checked_on from record_status r left join extractions e on e.record_id=r.id
 where r.status='included' and (e.id is null or e.checked_by is null);
create view compliance_findings as
 select rv.id review_id,rv.code reference,'search_missing' rule,'PRISMA 6-7' source,'No recorded search' detail
 from reviews rv where not exists(select 1 from searches s where s.review_id=rv.id)
 union all select rv.id,rv.code,'search_stale','Local refresh policy','Search refresh is due'
 from reviews rv where exists(select 1 from searches s where s.review_id=rv.id and s.searched_on+rv.refresh_days<current_date)
 union all select r.review_id,r.code,'screening_incomplete','PRISMA 8,16','Unfinished decision: '||r.status
 from record_status r where r.status like '%pending' or r.status like '%conflict'
 union all select r.review_id,r.code,'retrieval_evidence','PRISMA 16','Record why the report could not be retrieved'
 from record_status r where r.status='not_retrieved' and trim(r.retrieval_note)=''
 union all select r.review_id,r.code,'extraction_unchecked','PRISMA 9-10; local dual-check policy','Missing or unchecked extraction'
 from record_status r where r.status='included' and
 (not exists(select 1 from extractions e where e.record_id=r.id) or exists(select 1 from extractions e where e.record_id=r.id and e.checked_by is null))
 union all select r.review_id,r.code,'appraisal_missing','PRISMA 11,18','No recorded critical appraisal'
 from record_status r where r.status='included' and not exists(select 1 from appraisals a where a.record_id=r.id)
 union all select r.review_id,r.code,'study_link_missing','PRISMA 16','Included report has no study grouping key'
 from record_status r where r.status='included' and trim(r.study_key)='';
revoke all on screening_state,record_status,review_week,extraction_queue,compliance_findings from public;
