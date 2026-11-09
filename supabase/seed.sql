do $$
declare rv uuid; sr uuid; rec uuid; other uuid;
begin
 if exists(select 1 from reviews where code='REV-ACCESS') then return; end if;
 insert into reviews(code,name,owner,question,criteria,protocol_ref,due_on) values
 ('REV-ACCESS','Library access evidence review','Mara Chen','Which library access models are described in the selected reports?','Synthetic demo only. Include primary reports about library access; exclude editorials.','demo:protocol-v1',current_date+10) returning id into rv;
 insert into searches(review_id,code,name,query,searched_on,records_found,evidence_ref) values
 (rv,'SEARCH-01','Demo catalogue','library AND access',current_date-120,6,'demo:search-log') returning id into sr;
 insert into records(review_id,search_id,code,name,authors,year,external_key,study_key,owner,due_on,fulltext_ref,retrieval_status) values
 (rv,sr,'REC-001','Regional library access pilot','Demo Author A',2025,'demo-001','STUDY-A','Mara Chen',current_date-3,'demo:report-001','retrieved') returning id into rec;
 insert into votes(record_id,stage,reviewer,decision) values (rec,'abstract','mara chen','include'),(rec,'abstract','leo park','include'),(rec,'fulltext','mara chen','include'),(rec,'fulltext','leo park','include');
 insert into extractions(record_id,field,value,source_ref,extractor) values(rec,'access_model','Evening opening','demo:report-001 p2','mara chen');
 insert into records(review_id,search_id,code,name,authors,year,external_key,owner,due_on) values
 (rv,sr,'REC-002','Library opening survey','Demo Author B',2024,'demo-002','Leo Park',current_date-2) returning id into rec;
 insert into votes(record_id,stage,reviewer,decision,reason) values (rec,'abstract','mara chen','include',''),(rec,'abstract','leo park','exclude','Population unclear');
 insert into records(review_id,search_id,code,name,authors,year,external_key,owner,due_on) values
 (rv,sr,'REC-003','Rural library access report','Demo Author C',2023,'demo-003','Mara Chen',current_date-1) returning id into rec;
 insert into votes(record_id,stage,reviewer,decision) values (rec,'abstract','mara chen','include'),(rec,'abstract','leo park','include');
 insert into records(review_id,search_id,code,name,authors,year,external_key,owner,due_on) values
 (rv,sr,'REC-004','Library editorial','Demo Author D',2024,'demo-004','Leo Park',current_date+3) returning id into rec;
 insert into votes(record_id,stage,reviewer,decision,reason) values (rec,'abstract','mara chen','exclude','Editorial'),(rec,'abstract','leo park','exclude','Editorial');
 insert into records(review_id,search_id,code,name,authors,year,external_key,owner,due_on) values
 (rv,sr,'REC-005','Unscreened library report','Demo Author E',2025,'demo-005','Mara Chen',current_date+2) returning id into other;
 insert into records(review_id,search_id,code,name,authors,year,external_key,owner,due_on,duplicate_of) values
 (rv,sr,'REC-006','Duplicate library report','Demo Author E',2025,'demo-006','Leo Park',current_date+2,other);
 insert into activity(review_id,actor,action,details) values (rv,'demo seed','seed','{"synthetic":true,"note":"No real studies or clinical claims"}');
end $$;
