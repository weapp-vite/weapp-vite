# Macro & Config Checklist

## JSON config strategy

- Static config: prefer `<json>` / `<json lang="jsonc">`.
- Dynamic/merged config: use Script Setup JSON macros.

## Macro rules

- One macro family per SFC.
- Top-level calls only.
- Single argument only.
- Prefer deterministic, side-effect-free macro functions.

## IDE/type hints

- Enable `weapp-vite/volar` plugin in `vueCompilerOptions.plugins`.
- Set `vueCompilerOptions.lib` to `wevu` when using wevu script setup macro typing.
