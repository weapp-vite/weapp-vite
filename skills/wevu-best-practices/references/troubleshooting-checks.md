# wevu Troubleshooting Checks

1. State not updating

- Confirm APIs are imported from `wevu`.
- Confirm template depends on changed reactive value.

2. Hook not firing

- Confirm hook registered synchronously in `setup()`.
- Confirm hook belongs to page/component context.

3. Component render issues

- Confirm `usingComponents` path and `component: true`.
- Confirm mini-program event names/semantics.

4. Store reactivity loss

- Confirm `storeToRefs` is used for destructuring.
