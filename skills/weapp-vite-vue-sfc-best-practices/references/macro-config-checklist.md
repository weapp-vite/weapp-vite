# Macro & Config Checklist

## JSON config strategy

- Component SFC: prefer `defineComponentJson` for both static and dynamic config.
- Page/App SFC: prefer `definePageJson` / `defineAppJson`.
- `<json>` blocks are legacy-compatible fallback only; avoid for new code.

## Macro rules

- One JSON macro per SFC role.
- `definePageMeta` is a separate page-meta macro and may coexist with `definePageJson` in page SFCs.
- Top-level calls only.
- Single argument only.
- Prefer deterministic, side-effect-free macro functions.

## IDE/type hints

- Enable `weapp-vite/volar` plugin in `vueCompilerOptions.plugins`.
- Set `vueCompilerOptions.lib` to `wevu` when using wevu script setup macro typing.
