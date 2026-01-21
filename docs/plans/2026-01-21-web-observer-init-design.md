# Component Observer Init (Optional)

## Summary

Add an optional `observerInit` flag to `defineComponent` so property observers can run once during component initialization. When enabled, observers fire after initial attributes are applied, only for properties that have not already triggered an observer via a value change.

## Goals

- Provide a global `observerInit` toggle on `defineComponent` options.
- Trigger observers once on init with `(newValue, undefined)`.
- Avoid duplicate calls when a property has already triggered an observer.

## Non-Goals

- No per-property observer init flags.
- No changes to observer semantics on normal updates.

## Approach

- Add `observerInit?: boolean` to `DefineComponentOptions` (default `false`).
- Track observed property names in each component instance.
- During `connectedCallback`, after applying attributes, call a `#runInitialObservers` method once if enabled.
- Skip initial observer calls for properties that already fired observers.

## Error Handling

- No new error paths. Observers run within existing flow; failures remain user-land.

## Testing

- Add a component test verifying:
  - A property changed before attach triggers observer once.
  - Another property without prior changes fires exactly once on init with `(value, undefined)`.

## Limitations

- Init observers only run once per instance.
- Toggling `observerInit` on hot updates does not retroactively re-run init observers.
