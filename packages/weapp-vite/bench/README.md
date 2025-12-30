# weapp-vite benchmarks (Vitest bench)

## Run

From repo root:

- `pnpm -C packages/weapp-vite bench`

Or with JSON output:

- `pnpm -C packages/weapp-vite bench -- --outputJson bench/results.json`
- `pnpm -C packages/weapp-vite bench -- --compare bench/results.json`

## Notes

- Benchmarks are designed to avoid network access and keep setup outside measured loops.
- Some suites create temporary fixtures under `packages/weapp-vite/test/fixtures/__temp__/bench` and clean them up automatically.
