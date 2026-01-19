# Web runtime rendering design (weapp-vite)

Date: 2026-01-19

## Goals

- Bring `packages/web` to near-device template/rendering compatibility for mini-program apps on web.
- Keep existing Web Components + Shadow DOM approach; upgrade renderer to DOM-diffing.
- Compile WXML at build time to efficient render functions.
- Support template features in priority order: slot (including scoped), template/is/data, import/include, wxs, wx:for semantics, WXSS details.
- Keep the runtime small and isolated to web targets only.

## Non-goals (initial phase)

- Full parity with every platform-specific behavior and edge case.
- Replacing the current router/runtime in `packages/weapp-vite` beyond web integration needs.
- Adding SSR in this phase.

## Architecture

- Keep `packages/web` as the web runtime package.
- Introduce Lit as the render core for DOM diffing, aligned with Web Components and Shadow DOM.
- Move WXML parsing/compilation into build time in the Vite plugin.
- Runtime focuses on component registration, lifecycle wiring, and routing glue.

## Build-time compilation

- `packages/web/src/plugin.ts` gets a WXML compiler stage.
- Each template file exports a `render(scope, ctx)` function that returns a Lit `TemplateResult`.
- `wx:if/elif/else` -> `when` or nested ternaries.
- `wx:for` -> `repeat`, with key strategy:
  - default uses item when it is a primitive value, otherwise falls back to index.
- Interpolation `{{}}` compiles to expressions; text and attribute escaping rules stay consistent.

### `template` / `is` / `data`

- Maintain a per-file template registry.
- `is="name"` binds statically.
- `is="{{expr}}"` compiles to runtime template selection.
- `data` merges into scope when invoking a template (shallow merge).

### `import` / `include`

- Build-time dependency graph that supports relative/absolute paths and sub-packages.
- `import` loads template definitions only.
- `include` inlines nodes directly.

### `slot`

- Default and named slots map to native Web Component slots.
- Scoped slot support: compiler emits slot functions with slot-props passed into child templates.

### `wxs`

- Compile to isolated modules with restricted API.
- Only allow deterministic built-ins (Math/Date/Number) and WXS-to-WXS imports.
- No access to JS globals or component instance.

## Runtime

- Replace current string renderer with LitElement-based components.
- `defineComponent` becomes a thin wrapper around LitElement:
  - `data` and `properties` mapped to reactive state.
  - `setData` merges state and calls `requestUpdate`.
  - `lifetimes` map to `connectedCallback` / `disconnectedCallback` / `firstUpdated`.
- Event bridging:
  - Compiler generates Lit event bindings when possible.
  - For dynamic cases, keep data attribute event mapping as fallback.

## Style (WXSS)

- Continue WXSS -> CSS transform at build time.
- Support `@import` by flattening at build time.
- rpx strategy: configurable design width (default 750).
  - Use `:root { --rpx: <px> }` and convert rpx to `calc(var(--rpx) * N)`.
  - Update `--rpx` on resize.
- Shadow DOM: apply styles via `static styles` + `unsafeCSS`.

## Data flow

- Template renders from a single `scope` object derived from data + properties.
- `setData` updates state and schedules render.
- Observers trigger on property updates with previous and next values.

## Error handling

- Template compile errors are surfaced in build with file/line context.
- Runtime errors (template eval, wxs) are caught and logged with component id.
- Unsupported syntax emits a clear warning and best-effort fallback.

## Testing

- Unit tests in `packages/web/test`:
  - WXML compilation cases (slot, template/is, import/include, wx:for, wxs).
  - WXSS rpx conversion and @import.
- Integration tests using an example app (existing demo or new web demo):
  - Render correctness, event handling, and basic navigation.

## Rollout

- Add Lit as a dependency in `packages/web` only.
- Ship behind existing `weapp.web` config flag.
- Iterate on template coverage and compatibility with component libraries.
