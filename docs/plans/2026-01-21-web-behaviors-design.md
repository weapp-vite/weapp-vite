# Web Behaviors Merge

## Summary

Add behavior normalization in `defineComponent` to merge `properties`, `data`, `methods`, and `lifetimes` from `behaviors`, including recursive behaviors. Component definitions override behaviors, and lifecycle hooks run behaviors first, component last.

## Goals

- Support `behaviors` as an array of objects.
- Merge `properties`, `data`, `methods`, `lifetimes` with component overriding behaviors.
- Expand nested behaviors recursively.

## Non-Goals

- No behavior factory functions.
- No deep merge for `data`.

## Approach

- Implement a `normalizeBehaviors` helper inside `component.ts`.
- Expand behaviors depth-first; keep a `visited` set to avoid cycles.
- Merge `properties/data/methods` with “last wins” semantics.
- Merge `lifetimes` by composing functions; behaviors run first, component last.

## Error Handling

- Ignore non-object behaviors and warn once.
- On cycles, warn once and skip further expansion.

## Testing

- Verify merge order for data/methods/properties.
- Verify `lifetimes` order (behaviors before component).
- Verify nested behaviors are expanded.

## Limitations

- Only shallow merge for data.
