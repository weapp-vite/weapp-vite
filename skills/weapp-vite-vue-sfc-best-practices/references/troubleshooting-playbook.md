# SFC Troubleshooting Playbook

1. Component not rendered

- Check `usingComponents` path/case.
- Check `component: true` for component targets.

2. State not reflected

- Ensure runtime APIs come from `wevu`.
- Ensure template actually consumes changed reactive state.

3. Hook not firing

- Ensure synchronous registration in `setup()`.
- Ensure hook type matches page/component context.

4. Unexpected template output

- Check directive compatibility limits (`v-model`, `v-bind`).
- Reduce to explicit bindings to isolate compile transform issues.
