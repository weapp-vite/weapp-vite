# Web Slot Rendering (Native Web Components)

## Summary

Add native Web Components slot support for `@weapp-vite/web` by ensuring the WXML compiler preserves `<slot>` elements and `slot` attributes. This keeps slot behavior aligned with the browser's Shadow DOM projection without adding runtime logic.

## Goals

- Preserve `<slot>` elements emitted from WXML templates.
- Ensure `slot` attributes remain HTML attributes (never property bindings), even for custom component tags.
- Keep implementation minimal and aligned with existing Lit-based rendering.

## Non-Goals

- No virtual slot rendering or fallback projection logic.
- No support for slot projection in legacy (string) rendering.

## Approach

### Compiler

- Explicitly treat `slot` as a native element in tag normalization to prevent regressions.
- Preserve `slot` attributes as attribute bindings by keeping them in the property binding exclusion list.
- Allow dynamic `name` on `<slot>` via existing interpolation handling.

### Runtime

- No runtime changes. Lit renders the template into Shadow DOM; browser slot projection handles distribution.

## Data Flow

WXML -> `compileWxml` -> Lit template -> Shadow DOM -> Browser slot projection.

## Error Handling

- No new error paths. Compilation relies on existing parsing and interpolation logic.

## Testing

- Compiler test: `<slot>` remains `<slot>` in compiled output.
- Compiler test: `slot="header"` on a custom component remains an attribute binding (no `.` property prefix).
- Optional DOM test (deferred): render a component with slot and assert projection in `shadowRoot`.

## Limitations

- Legacy template rendering cannot project slots.
- Slot behavior requires Shadow DOM support.
