# Web WXS Enhancements (Require + Module Handling)

## Summary

Extend WXS handling for web: resolve `.ts/.js` dependencies (treat as WXS), warn on missing `require()` targets at build and runtime, and warn on duplicate `module` names in `<wxs>` tags. Use a `?wxs` query to route non-`.wxs*` sources through the WXS transform without affecting normal TS/JS modules.

## Goals

- Resolve `require()` targets in order: `.wxs` → `.wxs.ts` → `.wxs.js` → `.ts` → `.js`.
- Support `<wxs src>` pointing to `.ts/.js` while still compiling as WXS (CommonJS-style).
- Emit build-time warnings for unresolved `require()` and duplicate module names.
- Emit runtime warnings when `require()` is called with an unresolved id.

## Non-Goals

- No general package-name resolution for `require()`.
- No runtime sandboxing changes.

## Approach

- Keep `.wxs*` detection for normal WXS files; add a `?wxs` query marker for `.ts/.js` WXS imports.
- Update WXS path resolution to include `.ts`/`.js` in the fallback order while still rejecting non-relative/absolute requests.
- Modify `transformWxsToEsm` to return `warnings` and to generate a `require()` that warns once at runtime if the id is not mapped.
- On WXML compile, detect duplicate `<wxs module>` names and warn (later wins).

## Error Handling

- If `require()` cannot be resolved, emit a build warning and let runtime `require()` warn once and return `undefined`.
- If `<wxs module>` repeats, emit a warning but keep the last definition.

## Testing

- WXS transform warns on unresolved `require()`.
- `require()` runtime warning is emitted once when id is missing.
- `<wxs module>` duplicate names warn in `compileWxml`.
- `.ts/.js` WXS sources are compiled via `?wxs` imports and still handled by WXS transform.

## Limitations

- Only relative/absolute `require()` is supported.
- `?wxs` is an internal convention for the web build.
