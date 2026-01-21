# Template `data` Shorthand for `<template is>`

## Summary

Support `data="{{item: item, index: index}}"` shorthand on `<template is>` by auto-wrapping into an object literal during compilation. The result still uses `ctx.mergeScope`, so `data` only affects template scope and overrides parent fields.

## Goals

- Allow object-literal shorthand in `data` interpolation.
- Keep existing `ctx.mergeScope` semantics (data overrides, parent scope retained).
- Avoid runtime changes.

## Non-Goals

- No new runtime API or generic data parsing.
- No attribute-based template import changes.

## Approach

- In `renderTemplateInvoke`, detect when `data` contains a single interpolation expression.
- If the expression does not start with `{`, `[`, or `(` and contains a top-level `:`, wrap it as `{ ... }` before `ctx.eval`.
- Pass the evaluated object to `ctx.mergeScope` as before.

## Error Handling

- Use existing `ctx.eval` behavior; evaluation errors return `undefined`.
- `mergeScope` ignores non-object values by returning the parent scope.

## Testing

- Compiler test: `data="{{item: item, index: index}}"` should be wrapped as `{ item: item, index: index }`.
- Compiler test: `data="{{item}}"` should remain unchanged.
- Optional runtime test: template renders `data` overrides over parent scope.

## Limitations

- Heuristic parsing only; complex expressions with `:` may not be wrapped.
