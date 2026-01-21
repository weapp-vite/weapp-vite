# api-extractor Vue types demo design

## Goals

- Extract Vue types into multiple declaration files and a single rollup declaration.
- Use api-extractor to roll up declarations from a TypeScript-only entry.
- Keep the demo minimal and easy to run inside the monorepo.

## Non-goals

- Bundling runtime JavaScript.
- Publishing the demo as a package.

## Approach

- Add a new app at `apps/api-extractor-vue-types-demo`.
- Create `src/` modules that re-export Vue types and define a few helper types:
  - `reactivity.ts` for Ref/ComputedRef-related types.
  - `component.ts` for component instance/public types.
  - `props.ts` for prop extraction helpers.
  - `index.ts` as the declaration entry point.

## Build pipeline

- `tsc -p tsconfig.build.json` emits `dist/types/*.d.ts` for the multi-file output.
- `api-extractor run --local` reads `dist/types/index.d.ts` and produces
  `dist/rollup/index.d.ts` as the single-file output.

## Tooling rationale

- TypeScript provides the most predictable per-file `.d.ts` output.
- api-extractor provides stable rollup output and better API surface control.

## Risks

- None expected beyond version alignment with Vue and TypeScript.
