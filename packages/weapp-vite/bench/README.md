# weapp-vite benchmarks (Vitest bench)

## Run

From repo root:

- `pnpm -C packages/weapp-vite bench`

Each run writes a timestamped JSON report to `packages/weapp-vite/bench/results/`.

## Notes

- Benchmarks are designed to avoid network access and keep setup outside measured loops.
- Some suites create temporary fixtures under `packages/weapp-vite/test/fixtures/__temp__/bench` and clean them up automatically.
