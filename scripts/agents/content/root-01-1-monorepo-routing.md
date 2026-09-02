## 1. Monorepo Routing

- Core bundler/compiler/runtime work:
  - `packages/weapp-vite`
  - `packages-runtime/wevu`
  - `packages-runtime/wevu-compiler`
  - `packages-runtime/weapi`
  - `packages-runtime/web`
  - `packages-runtime/web-apis`
  - related integration checks in `e2e/` and `e2e-apps/github-issues`
- Template/app parity work:
  - source app in `apps/*`
  - target template in `templates/*`
- Docs and site:
  - `website/`, `docs/`

Avoid cross-package edits unless the change is truly shared.
