# Literature Reviews for Claude Code

Screen reports, settle disagreements, check extracted values and prepare the evidence pack from a database you own. For research consultancies that manage systematic literature review operations. The coding agent runs the commands; reviewers make the research decisions.

## Three ways to run it

- **Do it yourself.** Install the MIT-licensed code, run the demo and bring a study export. Hosting and coding-agent use have their own costs. Works with Claude Code, Codex, OpenCode or Cursor.
- **We customise it.** Enterprise DNA brings your Nested Knowledge records across and builds your fields, criteria, documents and reviewer process. A web front end or a different stack can be scoped for your version. One setup fee, then a retainer.
- **We run it for you.** Omni by Enterprise DNA installs, connects and operates your version alongside the business. One setup fee, then a monthly retainer. [Book 30 minutes with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=nested-knowledge).

## Start with synthetic records

Node 20 or newer. No database account or paid model API is needed for the demo.

```bash
npm install
npm run demo
npm test
npm run view
npm run docs
npm run reviews -- weekly-review --json
```

Open this folder in your coding agent. Ask it to run /screening-queue, /conflicts or /weekly-review. All names, reports and extracted values in the demo are invented for testing, not real research findings. The demo covers library access reports, not patient care.

Without DATABASE_URL, PGlite persists under .data/db. Set DATA_DIR to an absolute directory to keep another local database. Set DATABASE_URL to use PostgreSQL, then run npm run migrate against an empty database. Do not seed shared working data. PostgreSQL seeding requires the explicit --demo-database flag. SQL migrations use PostgreSQL-compatible types and no extensions.

## The review week

| Ritual | What it does |
|---|---|
| /weekly-review | Reviews, deadlines, included reports and decision backlog |
| /screening-queue | Abstract and full-text records waiting for reviewers |
| /conflicts | Disagreements requiring a third recorded reviewer |
| /fulltext-chase | Reports still requested or unavailable |
| /extraction-check | Included reports missing checked extracted values |
| /search-refresh | Searches due under your recorded refresh interval |
| /compliance | Reporting evidence gaps, with cited sources |
| /ready | Readiness for a human review of the evidence pack |

Use /help for every CLI command. The .claude/commands folder holds a recipe for each command plus /docs, /view, /new-view and /customise.

## Record a real decision

```bash
npm run reviews -- screen --record=REC-005 --stage=abstract --decision=include --actor="Mara Chen"
npm run reviews -- screen --record=REC-005 --stage=abstract --decision=exclude --reason="Outside agreed scope" --actor="Leo Park"
npm run reviews -- resolve --record=REC-005 --stage=abstract --decision=include --reason="Protocol criterion reviewed" --actor="Jo Bell"
```

Names are case-insensitive, and record codes or unique UUID prefixes work. Ambiguous names list candidates and exit with an error. Each screening stage requires two distinct recorded reviewers. A third person records the resolution when they disagree. This is a local workflow policy, not a claim that PRISMA mandates two reviewers for every review.

Full-text screening requires abstract inclusion and a recorded report reference. Extraction requires inclusion at both stages. An extractor cannot check their own value. Revising a decision clears the affected resolution, downstream full-text decisions where applicable, extraction checks and appraisal. The previous values remain in activity. Replacing a report reference clears its full-text decisions and checks. Updating an extracted value clears its check.

Actor names record operator-supplied statements. This version does not authenticate reviewers or hide one reviewer's vote from another. Use a separate blinded process where your protocol requires it. Shared operation needs authenticated identities, scoped roles and backups. Database owners can alter history; it is not a tamper-proof audit service.

## Bring your Nested Knowledge history

In Study Inspector, remove filters and download Studies as XLSX. Include Title plus a stable Ref ID, DOI or PubMed ID, and retain Author and Publication Year. A CSV saved from that sheet works too.

```bash
npm run reviews -- import nested-knowledge --review=REV-ACCESS --file=fixtures/nested-knowledge-studies.csv --owner="Mara Chen" --due=2026-12-01 --source="Synthetic Studies export" --actor="Mara Chen" --dry-run
npm run reviews -- import nested-knowledge --review=REV-ACCESS --file=fixtures/nested-knowledge-studies.csv --owner="Mara Chen" --due=2026-12-01 --source="Synthetic Studies export" --actor="Mara Chen"
npm run reviews -- export --dir=exports
```

The one-command importer accepts a plain-value, single-sheet XLSX or CSV and an optional --map=fixtures/column-map.json. It preserves every source column, including historical decision text. Records enter as pending, never as newly approved. It does not recreate separate reviewer histories, attached PDFs, tags, appraisals, access permissions or statistical analyses. [Export steps and reconciliation](docs/replace-nested-knowledge.md) explain these boundaries. The sample is synthetic and is not a certified export from a live customer account.

Repeated identical rows do not duplicate records. A conflicting repeat rejects the whole import. Dry runs roll back every write. The full JSON export contains all nine entities and exact original field text. CSV exports protect spreadsheet cells that resemble formulas. The JSON backup is an archive; automated restore is not included.

## Documents and views

Change brand.json to set the business name, logo reference and colours. npm run docs renders a protocol record, report exclusion log and draft evidence pack for each review. npm run view renders the week, reporting checks and flow counts. These are read-only HTML snapshots, printable to PDF. /draft-chase writes an internal retrieval request and /draft-review-pack writes a handover draft. Neither sends or publishes.

Flow counts cover records held here, distinguish reports from study keys, and identify duplicates separately. They are not a complete PRISMA diagram or a substitute for reconciling search totals, report retrieval and multiple publications of a study. [What no front end means](docs/why-no-front-end.md).

## Ten questions to ask across your own records

1. Which reviews have deadlines but unresolved screening disagreements? `npm run reviews -- conflicts`
2. Who has overdue screening work across our reviews? `npm run reviews -- owner-load`
3. Which reports need another reviewer before full-text retrieval? `npm run reviews -- screening-queue`
4. Which included reports have an unchecked extracted value? `npm run reviews -- extraction-check`
5. Which searches have passed our own refresh interval? `npm run reviews -- search-refresh`
6. Which report requests have stalled with each owner? `npm run reviews -- fulltext-chase`
7. How many reports sit at each decision stage, with study groupings kept separate? `npm run reviews -- flow`
8. Which reviews still need appraisal or study-link evidence? `npm run reviews -- compliance`
9. What changed when a reviewer revised an earlier decision? `npm run reviews -- activity`
10. Which review packs are ready for a human methodology check? `npm run reviews -- ready`

These are executable questions about this database, not claims that another vendor cannot build a report.

## Your first hour: ten things to ask for

1. Put our name and logo on the evidence pack.
2. Preview our Studies export and show every unmapped column.
3. Add our review types to the review record.
4. Set our search refresh interval.
5. Add our exclusion reason vocabulary.
6. Group the Monday queue by reviewer.
7. Add our source-page format to extraction.
8. Add our appraisal checklist fields.
9. Build a view of deadlines by client code.
10. Add our handover checklist to the draft pack.

/customise writes a new migration, tests it on disposable data and applies it to the selected database. Keep personal information and unpublished reports outside git.

## Reporting checks and verification

[Compliance notes](docs/compliance.md) map each finding to PRISMA reporting guidance or an explicit local policy. This desk records evidence and decisions. It does not search literature services, appraise a paper automatically, calculate a meta-analysis, advise on treatment or certify regulatory compliance. Your research lead owns the protocol and the interpretation.

npm test creates a disposable database, migrates and seeds twice, exercises every CLI command, and checks disagreement resolution, invalidation, self-check rejection, date validation, XLSX and CSV imports, repeat detection, rollback, exports and HTML escaping. TEST_DATABASE_URL selects an isolated test schema in a disposable PostgreSQL database. The manually dispatched CI workflow runs Linux, Windows and PostgreSQL tests.

MIT. Copyright 2026 Enterprise DNA. Not affiliated with Nested Knowledge or Anthropic.
