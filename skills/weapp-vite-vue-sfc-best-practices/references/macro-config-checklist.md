# Macro & Config Checklist

## JSON config strategy

- Component SFC: prefer `defineComponentJson` for both static and dynamic config.
- Page/App SFC: prefer `definePageJson` / `defineAppJson`.
- `<json>` blocks are legacy-compatible fallback only; avoid for new code.

## Macro rules

- One macro family per SFC.
- Top-level calls only.
- Single argument only.
- Prefer deterministic, side-effect-free macro functions.

## IDE/type hints

- Enable `weapp-vite/volar` plugin in `vueCompilerOptions.plugins`.
- Set `vueCompilerOptions.lib` to `wevu` when using wevu script setup macro typing.
