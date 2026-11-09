#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table } from './lib/format.mjs';
import { page, table as htmlTable, writeOut } from './lib/render.mjs';

export const entities = ['reviews','searches','records','votes','resolutions','extractions','appraisals','activity','imports'];
export const commands = ['help','list','show','add','log','screen','resolve','retrieve','duplicate','link-study','extract','check-extraction','appraise','import','export','screening-queue','conflicts','fulltext-chase','extraction-check','attention','compliance','weekly-review','search-refresh','flow','owner-load','ready','draft-review-pack','draft-chase','activity','refresh-search'];
const reads = {
 'weekly-review':'select * from review_week order by due_on,review',
 'screening-queue':"select review,code,name,owner,abstract_votes,fulltext_votes,status,due_on from record_status where status in ('abstract_pending','fulltext_pending') order by due_on,code",
 conflicts:"select review,code,name,abstract_decision,fulltext_decision,owner from record_status where status like '%conflict' order by code",
 'fulltext-chase':"select review,code,name,owner,retrieval_status,retrieval_note,due_on from record_status where status in ('retrieval_pending','not_retrieved') order by due_on,code",
 'extraction-check':'select * from extraction_queue order by code,field',
 attention:"select review,code,name,owner,status,due_on from record_status where status like '%conflict' or (due_on<current_date and status not in ('duplicate','abstract_excluded','fulltext_excluded')) order by due_on,code",
 compliance:'select rv.code review,c.reference,c.rule,c.source,c.detail from compliance_findings c join reviews rv on rv.id=c.review_id order by review,rule,reference',
 'search-refresh':"select rv.code review,s.code,s.name,s.searched_on,s.searched_on+rv.refresh_days refresh_due,s.records_found,s.evidence_ref from searches s join reviews rv on rv.id=s.review_id where s.searched_on+rv.refresh_days<current_date order by refresh_due,s.code",
 flow:"select review,status,count(*)::integer reports,count(distinct nullif(study_key,''))::integer linked_studies from record_status group by review,status order by review,status",
 'owner-load':"select review,owner,count(*)::integer records,count(*) filter(where status like '%pending')::integer waiting,count(*) filter(where status like '%conflict')::integer conflicts,count(*) filter(where due_on<current_date and status like '%pending')::integer overdue from record_status where status<>'duplicate' group by review,owner order by review,owner",
 ready:"select rv.code review,rv.name,count(c.rule)::integer findings,case when count(c.rule)=0 and exists(select 1 from records r where r.review_id=rv.id) then 'ready_for_human_review' else 'blocked' end status from reviews rv left join compliance_findings c on c.review_id=rv.id group by rv.id order by review",
 activity:'select rv.code review,a.actor,a.action,a.details,a.created_at from activity a join reviews rv on rv.id=a.review_id order by a.created_at,a.id'
};
function args(argv) {
 const opts={},pos=[];
 for(const a of argv) {if(!a.startsWith('--'))pos.push(a);else {const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(k in opts)throw Error(`Repeated option --${k}`);opts[k]=i<0?true:a.slice(i+1);}}
 return {pos,opts};
}
const need=(o,k)=>{if(typeof o[k]!=='string'||!o[k].trim())throw Error(`--${k}= is required`);return o[k].trim();};
const person=(v)=>String(v).trim().toLowerCase();
function day(v,{past=false}={}) {if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error(`Invalid date ${v}`);if(past&&v>new Date().toISOString().slice(0,10))throw Error('Date cannot be in the future');return v;}
function integer(v,min=0,max=1e8){if(!/^\d+$/.test(String(v))||+v<min||+v>max)throw Error(`Invalid integer ${v}`);return +v;}
function code(v){if(!/^[a-z0-9][a-z0-9-]{1,79}$/i.test(v))throw Error('Code requires 2-80 letters, digits or hyphens');return v.toUpperCase();}
export async function find(db,entity,needle) {
 if(!['reviews','records','searches'].includes(entity))throw Error('Lookup supports reviews, records or searches');
 const rows=await db.query(`select * from ${entity} where lower(code)=lower($1) or lower(name)=lower($1) or id::text like $2 order by code`,[needle,`${needle}%`]);
 if(rows.length!==1)throw Error(`${entity}: ${rows.length?'Ambiguous':'No match'} ${needle}\n${table(rows.map(r=>({code:r.code,name:r.name,id:r.id})),[{key:'code',label:'Code'},{key:'name',label:'Name'},{key:'id',label:'ID'}])}`);
 return rows[0];
}
async function audit(db,review,actor,action,details){await db.query('insert into activity(review_id,actor,action,details) values($1,$2,$3,$4)',[review,actor,action,JSON.stringify(details)]);}
async function locked(db,review){await db.query('select id from reviews where id=$1 for update',[review]);}
async function invalidate(db,r,stage){
 const old={votes:await db.query('select * from votes where record_id=$1',[r.id]),resolutions:await db.query('select * from resolutions where record_id=$1',[r.id]),extractions:await db.query('select * from extractions where record_id=$1',[r.id]),appraisals:await db.query('select * from appraisals where record_id=$1',[r.id])};
 await db.query('delete from resolutions where record_id=$1 and stage=$2',[r.id,stage]);
 if(stage==='abstract'){await db.query("delete from votes where record_id=$1 and stage='fulltext'",[r.id]);await db.query("delete from resolutions where record_id=$1 and stage='fulltext'",[r.id]);}
 await db.query('update extractions set checked_by=null,checked_on=null where record_id=$1',[r.id]);
 await db.query('delete from appraisals where record_id=$1',[r.id]);
 return old;
}
async function included(db,r){const [s]=await db.query('select status from record_status where id=$1',[r.id]);if(s.status!=='included')throw Error('Record must be included after both screening stages');}
async function sheet(file){
 if(!/\.xlsx$/i.test(file))return parseCsv(fs.readFileSync(file,'utf8'));
 const {default:ExcelJS}=await import('exceljs');const w=new ExcelJS.Workbook();await w.xlsx.readFile(file);
 if(w.worksheets.length!==1)throw Error('XLSX must contain one sheet. Export the Studies sheet separately.');
 const s=w.worksheets[0];const headers=[];s.getRow(1).eachCell({includeEmpty:true},(c)=>headers.push(String(c.value??'').trim()));
 if(!headers.length||headers.some(h=>!h)||new Set(headers.map(h=>h.toLowerCase())).size!==headers.length)throw Error('XLSX needs unique nonempty headers');
 const rows=[];s.eachRow((r,n)=>{if(n===1)return;const row={};for(let i=1;i<=Math.max(r.cellCount,headers.length);i++){const v=r.getCell(i).value;if(v&&typeof v==='object')throw Error(`XLSX row ${n}: formulas, rich text and linked cells must be exported as plain values`);if(i>headers.length&&v!==null)throw Error('XLSX row wider than headers');if(i<=headers.length)row[headers[i-1]]=String(v??'');}if(Object.values(row).some(Boolean))rows.push(row);});return rows;
}
function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);const cell=v=>{let s=v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return [keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';}
export async function run(db,argv){
 const {pos,opts:o}=args(argv);const [cmd='help',kind,ref]=pos;
 if(!commands.includes(cmd))throw Error(`Unknown command ${cmd}. Use help.`);
 const shared=['json','actor','dry-run'];
 const allowed={add:['code','name','owner','question','criteria','protocol','due','refresh-days','review','query','on','count','source','search','authors','year','key','study','abstract','doi'],log:['review','note'],screen:['record','stage','decision','reason'],resolve:['record','stage','decision','reason'],retrieve:['record','status','source','note'],duplicate:['record','of','reason'],'link-study':['record','study'],extract:['record','field','value','source'],'check-extraction':['record','field','on'],appraise:['record','tool','judgement','rationale','source'],import:['review','file','map','owner','due','source'],export:['dir'],'draft-review-pack':['review'],'draft-chase':['review'],'refresh-search':['search','on','count','source','query']};
 for(const key of Object.keys(o)){if(![...shared,...(allowed[cmd]||[]),...(reads[cmd]?['review']:[])].includes(key))throw Error(`Unknown option --${key}`);if(['json','dry-run'].includes(key)&&o[key]!==true)throw Error(`--${key} takes no value`);}
 if(cmd==='help')return commands.map(command=>({command}));
 if(reads[cmd]){let rows=await db.query(reads[cmd]);if(o.review){const rv=await find(db,'reviews',o.review);rows=rows.filter(r=>r.review===rv.code);}return rows;}
 if(cmd==='list'){if(!entities.includes(kind))throw Error(`Choose ${entities.join(', ')}`);return db.query(`select * from ${kind} order by created_at,id`);}
 if(cmd==='show'){const r=await find(db,kind,ref||'');if(kind!=='records')return [r];return {record:r,votes:await db.query('select * from votes where record_id=$1 order by stage,reviewer',[r.id]),resolutions:await db.query('select * from resolutions where record_id=$1',[r.id]),extractions:await db.query('select * from extractions where record_id=$1',[r.id]),appraisals:await db.query('select * from appraisals where record_id=$1',[r.id])};}
 if(cmd==='export'){
  const dir=path.resolve(REPO_ROOT,need(o,'dir'));fs.mkdirSync(dir,{recursive:true,mode:0o700});const out={};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{for(const e of entities)out[e]=await db.query(`select * from ${e} order by created_at,id`);}finally{await db.exec('ROLLBACK');}
  const backup=path.join(dir,'literature-reviews.json');fs.writeFileSync(backup,JSON.stringify(out,null,2)+'\n',{mode:0o600});for(const e of entities)fs.writeFileSync(path.join(dir,e+'.csv'),csv(out[e]),{mode:0o600});return [{file:backup,entities:entities.length}];
 }
 if(cmd==='draft-review-pack'||cmd==='draft-chase'){
  const rv=await find(db,'reviews',need(o,'review'));const query=cmd==='draft-chase'?"select code,name,owner,retrieval_status,retrieval_note from record_status where review_id=$1 and status in ('retrieval_pending','not_retrieved') order by code":"select code,name,status,study_key,exclusion_reason from record_status where review_id=$1 order by code";
  const rows=await db.query(query,[rv.id]);const checks=await db.query('select reference,rule,detail from compliance_findings where review_id=$1 order by rule,reference',[rv.id]);
  return [{file:writeOut('drafts',`${cmd}-${rv.code}`,page({title:cmd==='draft-chase'?'Draft report retrieval request':'Draft review handover',subtitle:`${rv.name}. Internal draft. Synthetic seed reports are not research evidence.`,sections:[{title:'Records',html:htmlTable(rows)},{title:'Outstanding checks',html:htmlTable(checks),note:'Resolve checks and review the full reporting checklist before distributing.'}]}))}];
 }
 const actor=person(need(o,'actor'));await db.exec('BEGIN');
 try {
  let result;
  if(cmd==='add'){
   const c=code(need(o,'code')),name=need(o,'name');let r;
   if(kind==='review'){
    const days=integer(o['refresh-days']??90,1,3650);
    [r]=await db.query('insert into reviews(code,name,owner,question,criteria,protocol_ref,due_on,refresh_days) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[c,name,need(o,'owner'),need(o,'question'),need(o,'criteria'),need(o,'protocol'),day(need(o,'due')),days]);
   }else{
    const rv=await find(db,'reviews',need(o,'review'));await locked(db,rv.id);
    if(kind==='search')[r]=await db.query('insert into searches(review_id,code,name,query,searched_on,records_found,evidence_ref) values($1,$2,$3,$4,$5,$6,$7) returning *',[rv.id,c,name,need(o,'query'),day(need(o,'on'),{past:true}),integer(need(o,'count')),need(o,'source')]);
    else if(kind==='record'){
     let search=null;if(o.search){search=await find(db,'searches',o.search);if(search.review_id!==rv.id)throw Error('Search belongs to another review');}
     [r]=await db.query('insert into records(review_id,search_id,code,name,authors,year,external_key,study_key,owner,due_on,abstract,doi) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *',[rv.id,search?.id??null,c,name,o.authors||'',o.year?integer(o.year,1500,2200):null,need(o,'key'),o.study||'',need(o,'owner'),day(need(o,'due')),o.abstract||'',o.doi||'']);
    }else throw Error('add requires review, search or record');
   }
   await audit(db,kind==='review'?r.id:r.review_id,actor,`add-${kind}`,r);result=[r];
  }else if(cmd==='refresh-search'){
   const search=await find(db,'searches',need(o,'search'));await locked(db,search.review_id);
   const on=day(need(o,'on'),{past:true});if(on<search.searched_on)throw Error('Refresh cannot predate the recorded search');
   const [updated]=await db.query('update searches set searched_on=$2,records_found=$3,evidence_ref=$4,query=$5 where id=$1 returning *',[search.id,on,integer(need(o,'count')),need(o,'source'),need(o,'query')]);
   await audit(db,search.review_id,actor,cmd,{before:search,after:updated});result=[updated];
  }else if(cmd==='log'){
   const rv=await find(db,'reviews',need(o,'review'));await locked(db,rv.id);await audit(db,rv.id,actor,'note',{note:need(o,'note')});result=[{logged:true}];
  }else if(cmd==='import'){
   if(kind!=='nested-knowledge')throw Error('import requires nested-knowledge');
   const rv=await find(db,'reviews',need(o,'review'));await locked(db,rv.id);
   const file=path.resolve(REPO_ROOT,need(o,'file'));const rows=await sheet(file);if(!rows.length)throw Error('Import contains no records');
   const map=o.map?JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT,o.map),'utf8')):{};
   if(Object.values(map).some(v=>typeof v!=='string'||!v.trim()))throw Error('Map values must be column names');
   if(Object.keys(map).some(k=>!['title','authors','year','doi','ref','pmid','abstract','study'].includes(k)))throw Error('Unknown map field');
   for(const col of Object.values(map))if(!Object.keys(rows[0]).some(k=>k.toLowerCase()===col.toLowerCase()))throw Error(`Mapped column missing: ${col}`);
   const get=(row,key,...defaults)=>map[key]?pick(row,map[key]):pick(row,...defaults);
   let added=0,repeated=0;const owner=need(o,'owner'),due=day(need(o,'due')),source=need(o,'source');
   for(const raw of rows){
    const name=get(raw,'title','Title').trim();if(!name)throw Error('Every row needs Title');
    const doi=get(raw,'doi','DOI').trim().replace(/^https?:\/\/(dx\.)?doi.org\//i,'').toLowerCase();
    const ext=get(raw,'ref','Ref ID','Reference ID').trim();const pmid=get(raw,'pmid','PubMed ID','PMID').trim();
    if(!doi&&!ext&&!pmid)throw Error('Every row needs DOI, Ref ID or PubMed ID for repeat-safe import');
    const key=doi?`doi:${doi}`:ext?`ref:${ext}`:`pmid:${pmid}`;
    const authors=get(raw,'authors','Authors','Author'),y=get(raw,'year','Publication Year','Year');const year=y?integer(y,1500,2200):null;
    const abstract=get(raw,'abstract','Abstract');const study=get(raw,'study','Study Key');
    const old=await db.query('select * from records where review_id=$1 and external_key=$2',[rv.id,key]);
    if(old.length){if(old[0].name!==name||old[0].authors!==authors||old[0].year!==year||JSON.stringify(Object.entries(old[0].source_row).sort())!==JSON.stringify(Object.entries(raw).sort()))throw Error(`Conflicting repeat ${key}; reconcile before importing`);repeated++;continue;}
    const c='NK-'+crypto.createHash('sha256').update(rv.id+'|'+key).digest('hex').slice(0,16).toUpperCase();
    await db.query('insert into records(review_id,code,name,authors,year,doi,external_key,study_key,owner,due_on,abstract,source_row) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[rv.id,c,name,authors,year,doi,key,study,owner,due,abstract,JSON.stringify(raw)]);added++;
   }
   const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).update(JSON.stringify(map)).digest('hex');
   await db.query('insert into imports(review_id,source,sha256,row_count,actor) values($1,$2,$3,$4,$5) on conflict(review_id,sha256) do nothing',[rv.id,source,hash,rows.length,actor]);
   result=[{rows:rows.length,added,repeated,dry_run:!!o['dry-run'],decisions:'Preserved as source text; no approvals imported'}];await audit(db,rv.id,actor,'import',result[0]);
  }else{
   let r=await find(db,'records',need(o,'record'));await locked(db,r.review_id);r=await find(db,'records',r.code);
   if(r.duplicate_of&&cmd!=='duplicate')throw Error('Duplicate record cannot be screened or extracted');
   if(['screen','resolve'].includes(cmd)){
    const stage=need(o,'stage'),decision=need(o,'decision');if(!['abstract','fulltext'].includes(stage)||!['include','exclude'].includes(decision))throw Error('Invalid stage or decision');
    if(decision==='exclude')need(o,'reason');
    if(stage==='fulltext'){const [s]=await db.query("select decision from screening_state where record_id=$1 and stage='abstract'",[r.id]);if(s.decision!=='include'||r.retrieval_status!=='retrieved')throw Error('Full text requires abstract inclusion and a retrieved report');}
    const votes=await db.query('select * from votes where record_id=$1 and stage=$2',[r.id,stage]);
    if(cmd==='screen'){
     if(votes.length>=2&&!votes.some(v=>v.reviewer===actor))throw Error('Two reviewers have voted; use resolve for a disagreement');
     const old=await invalidate(db,r,stage);
     await db.query('insert into votes(record_id,stage,reviewer,decision,reason) values($1,$2,$3,$4,$5) on conflict(record_id,stage,reviewer) do update set decision=excluded.decision,reason=excluded.reason',[r.id,stage,actor,decision,o.reason||'']);
     await audit(db,r.review_id,actor,cmd,{record:r.code,stage,decision,reason:o.reason||'',before:old});
    }else{
     if(votes.length!==2||votes[0].decision===votes[1].decision)throw Error('Resolution requires two disagreeing reviewers');
     if(votes.some(v=>v.reviewer===actor))throw Error('Resolver must be different from both screeners');
     const old=await invalidate(db,r,stage);
     await db.query('insert into resolutions(record_id,stage,reviewer,decision,reason) values($1,$2,$3,$4,$5)',[r.id,stage,actor,decision,need(o,'reason')]);
     await audit(db,r.review_id,actor,cmd,{record:r.code,stage,decision,reason:o.reason,before:old});
    }
   }else if(cmd==='retrieve'){
    const status=need(o,'status');if(!['retrieved','unavailable','pending'].includes(status))throw Error('Invalid retrieval status');
    const full=status==='retrieved'?need(o,'source'):'';const note=need(o,'note');
    const old=await invalidate(db,r,'fulltext');await db.query("delete from votes where record_id=$1 and stage='fulltext'",[r.id]);
    await db.query('update records set retrieval_status=$2,fulltext_ref=$3,retrieval_note=$4 where id=$1',[r.id,status,full,note]);
    await audit(db,r.review_id,actor,cmd,{record:r.code,status,before:{record:r,...old}});
   }else if(cmd==='duplicate'){
    if(r.duplicate_of)throw Error('Record already marked duplicate');
    const primary=await find(db,'records',need(o,'of'));if(primary.id===r.id||primary.review_id!==r.review_id||primary.duplicate_of)throw Error('Duplicate requires a different primary record in the same review');
    const dependent=await db.query('select id from records where duplicate_of=$1',[r.id]);if(dependent.length)throw Error('Cannot turn a primary with duplicates into another duplicate');
    const old=await invalidate(db,r,'abstract');await db.query('update records set duplicate_of=$2 where id=$1',[r.id,primary.id]);await audit(db,r.review_id,actor,cmd,{record:r.code,primary:primary.code,reason:need(o,'reason'),before:old});
   }else if(cmd==='link-study'){
    await db.query('update records set study_key=$2 where id=$1',[r.id,need(o,'study')]);await audit(db,r.review_id,actor,cmd,{record:r.code,from:r.study_key,to:o.study});
   }else if(cmd==='extract'){
    await included(db,r);const field=need(o,'field'),value=need(o,'value'),source=need(o,'source');const old=await db.query('select * from extractions where record_id=$1 and field=$2',[r.id,field]);
    await db.query('insert into extractions(record_id,field,value,source_ref,extractor) values($1,$2,$3,$4,$5) on conflict(record_id,field) do update set value=excluded.value,source_ref=excluded.source_ref,extractor=excluded.extractor,checked_by=null,checked_on=null',[r.id,field,value,source,actor]);await audit(db,r.review_id,actor,cmd,{record:r.code,field,value,source,before:old});
   }else if(cmd==='check-extraction'){
    await included(db,r);const field=need(o,'field');const [e]=await db.query('select * from extractions where record_id=$1 and field=$2',[r.id,field]);if(!e)throw Error('No extraction for that field');if(e.extractor===actor)throw Error('A different reviewer must check extraction');
    await db.query('update extractions set checked_by=$2,checked_on=$3 where id=$1',[e.id,actor,day(need(o,'on'),{past:true})]);await audit(db,r.review_id,actor,cmd,{record:r.code,field,value:e.value,on:o.on});
   }else if(cmd==='appraise'){
    await included(db,r);const old=await db.query('select * from appraisals where record_id=$1',[r.id]);
    const values=[r.id,need(o,'tool'),need(o,'judgement'),need(o,'rationale'),actor,need(o,'source')];
    await db.query('insert into appraisals(record_id,tool,judgement,rationale,reviewer,source_ref) values($1,$2,$3,$4,$5,$6) on conflict(record_id) do update set tool=excluded.tool,judgement=excluded.judgement,rationale=excluded.rationale,reviewer=excluded.reviewer,source_ref=excluded.source_ref',values);await audit(db,r.review_id,actor,cmd,{record:r.code,tool:o.tool,judgement:o.judgement,before:old});
   }else throw Error(`Unsupported mutation ${cmd}`);
   result=await db.query('select code,name,status from record_status where id=$1',[r.id]);
  }
  await db.exec(o['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
export function display(value){if(Array.isArray(value)){if(!value.length)return '(none)';const cols=Object.keys(value[0]).map(key=>({key,label:key,width:['name','detail','source_ref','evidence_ref'].includes(key)?65:undefined,format:v=>v&&typeof v==='object'?JSON.stringify(v):v}));return table(value,cols);}return JSON.stringify(value,null,2);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):display(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}}
