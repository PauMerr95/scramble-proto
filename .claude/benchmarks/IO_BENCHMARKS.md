# IO_BENCHMARKS

Baseline timings for sequence I/O in the backend. Use them to judge whether a change (codon
storage, DataFusion, new save logic, ...) makes things faster or slower.

## How to run

```sh
cd src-tauri && cargo test --release --lib large_record -- --ignored --nocapture
```

The test is `large_record_timings` in `src-tauri/src/seq/store.rs`. It builds a single-record FASTA
file of 105,000,000 bases (`ACGTN` pattern, 70 bases per input line) in a temp dir, then times each
step below. It runs everything in one thread, with nothing else happening at the same time.

Rules for adding a result:
- Run it 3 times and record the median of each step (single runs vary by ±20%).
- Note the machine and what changed. Compare only against rows from the same machine.
- Add a new row and keep the old ones, so the history stays visible.
- If you change what a step measures, say so in the notes and start a new baseline.

## Steps

| Step | What it measures |
|---|---|
| open | `:e`: stream and validate the 105 Mb source into a canonical working copy (60 bases/line) |
| window | avg of 100 reads of a 30 kb window spread across the record (`get_window`) |
| edit | avg of 1000 single-base inserts into the piece table (`apply_edits`) |
| save, unflushed | `:w` while all 1000 edits are still in memory (snapshot reads through 2001 pieces); includes `fsync` |
| flush | background flush of the 1000 edits into the working copy (no `fsync`) |
| save, flushed | `:w!` after the flush (one clean piece); includes `fsync` |

## Machine

**M1**: AMD Ryzen 5 5500U, 14 GB RAM, SK Hynix 512 GB NVMe SSD (HFM512GD3HX015N), Windows 11 Pro
10.0.26200, rustc 1.93.0. Temp dir `C:\Users\ppret\AppData\Local\Temp`, which is on the SSD and
outside OneDrive.

## Results

Times are medians of 3 runs.

| Date | Machine | Change | open | window | edit | save, unflushed | flush | save, flushed |
|---|---|---|---|---|---|---|---|---|
| 2026-10-25 | M1 | Baseline: working copies in `<data dir>/tmp`, 60 bases/line, `:w`/`:q` (on top of 90cc42e) | 1.45 s | 123 µs | 1.01 µs | 447 ms | 374 ms | 451 ms |

Raw runs for the baseline (open / window / edit / save, unflushed / flush / save, flushed):
- 1.57 s / 123 µs / 1.01 µs / 585 ms / 350 ms / 451 ms
- 1.35 s / 118 µs / 0.97 µs / 447 ms / 374 ms / 545 ms
- 1.45 s / 166 µs / 1.25 µs / 413 ms / 392 ms / 405 ms

## Notes

- The two saves cost about the same. Reading through 2001 pieces costs little next to writing and
  `fsync`ing about 107 MB, so the disk is the limit.
- Before the working-copy change (80 bases/line, no save to source), the backend skill recorded:
  open ≈1.5 s, window ≈0.13 ms, edit ≈1.5 µs, flush ≈0.4 s. Those were single runs on an unknown
  machine, so don't use them as a baseline.
