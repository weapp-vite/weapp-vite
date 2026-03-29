# AGENTS Guidelines (retail template)

Scope: everything under `templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/`.

Use this file together with root `AGENTS.md`.

## 1. Source of Truth

- This template must stay aligned with:
  - `apps/tdesign-miniprogram-starter-retail`
- Page mapping, interaction behavior, and major WXML DOM structure should remain parity-compatible.
- Do not add extra business regions, placeholder blocks, or additional interaction flows not present in source app.

## 2. Authoring Constraints

- Page/component source must use Vue SFC + TypeScript.
- Do not reintroduce native mini-program 4-file page/component source style (`.js + .wxml + .wxss + .json`) for business pages/components.
- Styles should use Tailwind utility workflow configured with `weapp-tailwindcss`.
- Avoid ad-hoc copy scripts for WXS sidecar files when normal `weapp-vite` pipeline can resolve them.

## 3. Fast Validation Commands

- Template local checks:
  - `pnpm -C templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template typecheck`
  - `pnpm -C templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template build`
- Parity e2e check:
  - `pnpm vitest run -c ./e2e/vitest.e2e.devtools.config.ts e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts`

Use full e2e matrix only if parity test or shared runtime/compiler tests indicate wider impact.

## 3.1 CLI Alias And AI Workflow

- This template supports both `weapp-vite` and `wv` CLI commands.
- When the dependency is installed, prefer reading local package docs under `node_modules/weapp-vite/dist/docs/` before relying on stale external memory.
- When an AI agent needs a mini-program screenshot, prefer `weapp-vite screenshot` or `wv screenshot`.
- Do not default to generic browser screenshot tools when the target is the mini-program runtime in WeChat DevTools.
- Before screenshot commands that require DevTools, ensure WeChat DevTools is logged in and the service port is enabled.
- When terminal log inspection is needed, prefer `weapp-vite ide logs --open` or `wv ide logs --open`.

## 4. WXML/WXS Notes

- Keep generated WXML valid for WeChat DevTools parser.
- `<wxs />` self-closing and non-self-closing forms are both valid inputs and should remain supported by compile pipeline.
- If WXS import resolution fails, prefer fixing compiler/transform handling over adding template-level workarounds.
