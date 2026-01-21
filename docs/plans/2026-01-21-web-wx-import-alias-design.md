# WXML Alias Tags: wx-import / wx-include

## Summary

Support `<wx-import>` and `<wx-include>` as aliases for `<import>` and `<include>` in `@weapp-vite/web` WXML compilation. The behavior remains identical to existing tags; only recognition is extended.

## Goals

- Recognize `<wx-import src="...">` and `<wx-include src="...">` as special nodes.
- Collect template dependencies the same way as `<import>` / `<include>`.
- Avoid changes to rendering or runtime behavior.

## Non-Goals

- No new runtime APIs or slot/render changes.
- No changes to attribute-based template imports.

## Approach

### Compiler

- Extend `collectSpecialNodes` to treat `wx-import` as `import` and `wx-include` as `include`.
- Reuse existing `resolveTemplatePath` handling for `src`.
- Do not emit alias nodes into the render tree.

### Runtime

- No runtime changes required.

## Data Flow

WXML -> parse -> collect special nodes -> import/include lists -> generate `import` lines -> render function.

## Error Handling

- If `src` is missing or resolution fails, ignore the alias node (same as current behavior).
- No new warnings or errors.

## Testing

- Add compiler test for `<wx-import>` and `<wx-include>` to assert:
  - Generated code contains the expected `import` statements.
  - Alias tags are not present in rendered output.
  - `dependencies` includes resolved template paths.

## Limitations

- Only tag-level aliasing is supported (no attribute-based aliases).
