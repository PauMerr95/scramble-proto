---
name: ncbi-datasets
description: Fetching and ingesting data from the NCBI Datasets v2 REST API in scramble-proto — query building, rate limits, paginated reports, large zip data packages, streaming to disk, and handing results to storage/the viewer. Use when implementing or changing anything that talks to api.ncbi.nlm.nih.gov or processes downloaded data packages.
---

# NCBI Datasets v2 ingest

Docs: https://www.ncbi.nlm.nih.gov/datasets/docs/v2/api/rest-api/. The OpenAPI spec at `https://www.ncbi.nlm.nih.gov/datasets/docs/v2/openapi3/openapi3.docs.yaml` is authoritative for exact parameter and field names. Check it before hard-coding.

## Where it runs

**All NCBI I/O lives in Rust** (`reqwest` with `stream` feature + `tokio`), not the Angular `HttpClient` that Scramble sketched. Reasons:
- Responses can be GBs. They must stream to disk, never through the webview or JSON IPC.
- The API key stays in the backend (`UserInfo.api_key`, default from the `NCBI_API_KEY` env var).
- Rate limiting and retries need one shared place.

The frontend keeps building the *query* (`QueryPacket { how, what, specifier }` → path segments; see `src/app/services/ncbi-data-service.ts` for the label → path maps). It sends the packet to a command such as `ncbi_fetch(packet, onProgress: Channel<Progress>)` and gets back a job id or result metadata.

## API facts

- Base: `https://api.ncbi.nlm.nih.gov/datasets/v2/`. Genome routes: `genome/{accession|taxon|bioproject|biosample|assembly_name|sequence_accession|wgs}/{specifier}/{dataset_report|sequence_reports|annotation_report|download|download_summary|...}`.
- Auth: header `api-key: <key>` (or the `api_key` query param). **Rate limit 5 req/s without a key, 10 req/s with one.** Put a token-bucket limiter around the shared `reqwest::Client` and retry 429/5xx with exponential backoff + jitter.
- Reports (`dataset_report`, `sequence_reports`, `annotation_report`) are paginated: `page_size` + `page_token`, and the response carries `next_page_token`. Loop until there's no token, and stream each page into storage. Don't accumulate all pages in memory.
- Prefer JSON Lines for reports where offered. Each line is one record, so it parses incrementally (`serde_json::Deserializer::from_reader(...).into_iter()` or line-by-line) and maps straight to Arrow/DataFusion rows.
- `.../download` returns a **zip "data package"**: `ncbi_dataset/data/<accession>/*.fna` (genomic FASTA), optional annotation files (GFF3/GTF/protein/CDS, selected via the annotation-type parameter), `assembly_data_report.jsonl`, and `dataset_catalog.json` (the manifest; read it instead of guessing paths). Call `download_summary` first to show the expected size and record count before committing.
- NCBI recommends **dehydrated** packages (metadata + remote file locations only) for ≥1,000 genomes or >15 GB. The files are then fetched individually ("rehydration"). For bulk jobs, implement the equivalent: download dehydrated, then fetch the listed files with bounded concurrency inside the rate limit.

## Large-data pipeline

1. **Download**: stream `bytes_stream()` to a temp file under the app data dir, emit progress (bytes / Content-Length if present), and support cancel through a `CancellationToken`. Resume with `Range` requests where the server supports it.
2. **Unpack**: `zip` crate, reading entries by name from `dataset_catalog.json`. Stream-copy each entry. Never `read_to_end` an `.fna`.
3. **Ingest**: stream each extracted `.fna` through `seq::fasta::import` (or `SeqStore::import`). It already streams, splits multi-FASTA into one canonical file per record, validates IUPAC, and rolls back on error. Import works from a path, so extract to a temp file first or add a reader-based variant. Load reports (`.jsonl`) and annotations into DataFusion/Parquet tables keyed by accession.
4. **Expose**: return `RecordMeta` only and append it through `DataSessionService` (as `importFasta` does). The viewer pulls windows on demand (see the `scramble-backend` and `scramble-frontend` skills).

Run the whole job off the main thread as a tracked task (job id → status in managed state) so the UI can show progress, survive navigation, and cancel.

## Data realities to handle

- Genomic FASTA contains `N` runs, IUPAC ambiguity codes, and lowercase soft-masking. The store keeps all of them as-is, and codon's refactor supports all IUPAC codes. Anything outside IUPAC (e.g. protein FASTA from annotation packages) is rejected by the nucleotide store, so route it elsewhere.
- Multi-record files (chromosomes/contigs/scaffolds): eukaryotic assemblies can have 10⁴–10⁶ contigs. List them paged/virtualized too.
- Single records can exceed 200 Mb (e.g. human chr1 ≈ 248 Mb), which exceeds browser scroll-height limits at 1 row per line (see frontend skill).

## Testing

- Unit-test URL/query construction and report parsing against small saved fixture responses. Don't hit the live API in tests.
- For manual end-to-end checks, use a small assembly (e.g. a bacterial or viral accession) before trying anything eukaryotic.
