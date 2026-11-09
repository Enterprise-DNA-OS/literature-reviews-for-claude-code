# Reporting checks and local rules

Checked 9 November 2026. This is research workflow administration. It is not clinical advice, legal advice, a quality certification or a validated regulatory submission system.

The source is the [PRISMA 2020 checklist](https://www.prisma-statement.org/prisma-2020-checklist) and its [expanded checklist](https://www.prisma-statement.org/s/PRISMA_2020_expanded_checklist-yc78.pdf). PRISMA describes what to report; it is not a statute and does not prescribe every method used here. See also the [authors' explanation and elaboration](https://www.bmj.com/content/372/bmj.n160).

| Finding | Source and implemented check |
|---|---|
| search_missing | Items 6 and 7 describe information sources and search strategies. Flag reviews with no search record. Record the query, date, reported count and evidence reference. |
| search_stale | Local policy only. Flag a search older than that review's refresh_days. Ninety days is the demo default, not a legal deadline. /refresh-search records new evidence and retains the previous record in activity. |
| screening_incomplete | Items 8 and 16 describe selection methods and results. Flag unfinished screening and disagreements. Two distinct screeners and a separate resolver are the local policy; identities and independence require external verification. |
| retrieval_evidence | Item 16 covers the selection flow. When a report is unavailable, retain a note explaining the attempt. The CLI requires it; the check also detects incomplete records loaded by other authorised database tools. |
| extraction_unchecked | Items 9 and 10 describe data collection and data items. Flag included reports with no extraction or unchecked values. A different recorded checker is our local policy. The software never establishes that a value is true. |
| appraisal_missing | Items 11 and 18 cover risk-of-bias methods and assessments. Flag included reports with no appraisal record. A free-text judgement does not implement or validate a particular appraisal instrument. |
| study_link_missing | Item 16 distinguishes records, reports and studies. Flag included reports without a study grouping key. A person establishes which reports belong to the same study. |

/ready is blocked by any finding or an empty review. Ready means ready for a human review, not publication approval. Complete the full checklist separately: synthesis methods, certainty, results, registration, funding and other reporting requirements are not checked here.

Source references are text supplied by a person; no referenced paper, evidence file or URL is fetched or verified. Historical imported status is stored as source text and never treated as a new decision. Synthetic seed reports must never be cited as evidence. Never put patient-level records into this demo.

Every record has created_at and updated_at. Mutations record actor and prior values in activity. Screening changes invalidate downstream checks and appraisals. The demo has no login, electronic signature, blind-review isolation or immutable audit storage. Database access policies must be designed for the organisation before shared operation.
