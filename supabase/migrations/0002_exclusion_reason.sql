-- Show the reason from the stage that actually excluded the report.
create or replace view record_status as
 select r.*,rv.code review, a.decision abstract_decision,a.votes abstract_votes,
 f.decision fulltext_decision,f.votes fulltext_votes,
 case when a.decision='exclude' then a.reason else f.reason end exclusion_reason,
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
