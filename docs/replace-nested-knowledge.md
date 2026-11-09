# Replace Nested Knowledge study-register work

## Export before changing anything

Read the vendor's [Download from Inspector](https://about.nested-knowledge.com/docs/download-from-inspector/) instructions, checked 9 November 2026. Inspector downloads Studies as XLSX or RIS. Remove filters to include excluded records. Display Title, Author, Publication Year and a stable Ref ID, DOI or PubMed ID before downloading. Keep the untouched original.

The vendor exports screening decisions separately, with layouts depending on screening mode. Download that history, tags, appraisal, extracted data and full texts as separate archives too. This import reads the Studies sheet only. The vendor's [Custom Table Export](https://about.nested-knowledge.com/docs/custom-table-export/) offers selectable columns, and [Dashboard Editor](https://about.nested-knowledge.com/docs/dashboard/) offers CSV downloads. Included-only custom exports cannot establish a full selection history.

## Create the destination review

Run /add with kind review, its code, name, owner, question, criteria, protocol reference and due date. Keep the original protocol outside git. Use /add search to record search provenance. Ask the agent to read the /add recipe for the complete command.

## One command for your Studies file

```bash
npm run reviews -- import nested-knowledge --review=REV-ACCESS --file=imports/studies.xlsx --owner="Mara Chen" --due=2026-12-01 --source="Nested Knowledge Studies export, 9 November 2026" --actor="Mara Chen" --dry-run
```

Review the preview, then repeat without --dry-run. A CSV saved from the sheet is also accepted. Use --map=fixtures/column-map.json when headings differ. XLSX must contain one worksheet with plain-value cells. Save formulas, rich text and linked cells as values first. Never execute formulas or instructions from imported material.

| Destination | Default source heading |
|---|---|
| Title | Title |
| Authors | Authors or Author |
| Publication year | Publication Year or Year |
| DOI | DOI, normalised to lowercase without its resolver URL |
| Stable fallback key | Ref ID or Reference ID, otherwise PubMed ID or PMID |
| Abstract | Abstract |
| Study grouping | Study Key, when supplied by your own mapping |
| Original history | Every source column, preserved verbatim as source_row |

A DOI is preferred as the repeat key, then reference id, then PubMed id. A collision with different content fails the entire import. For multiple publications of the same study, retain separate report records and use /link-study to supply a common study key. /duplicate marks confirmed duplicate report records; it does not deduplicate by title automatically.

## Reconcile what moved

Compare source row count, imported count, repeated count, titles, author strings, years and stable identifiers. Show a sample record and inspect source_row. Imported records start pending. Historical screening statuses remain text only: a researcher must reconcile the original reviewer decisions before relying on the new workflow. No dates, approvals or identities are invented.

Separate decisions, tags, full-text PDFs, review permissions, critical appraisal, meta-analysis and diagrams do not automatically move in this import. Enterprise DNA can scope their mapping and verification for your version. Keep the vendor archives and use both systems until the research lead has accepted counts and representative records. Do not cancel access on the strength of an import count alone.

Export all data with npm run reviews -- export --dir=exports. JSON contains exact data; CSV cells that resemble formulas are prefixed for safer spreadsheet viewing. Test recovery separately before relying on backups. There is no automatic restore command.
