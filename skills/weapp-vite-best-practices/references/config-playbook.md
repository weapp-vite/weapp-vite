# weapp-vite Config Playbook

## 1) Minimal starter

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoRoutes: true,
  },
})
```

## 2) Common growth path

- Add `autoImportComponents.globs/resolvers` when local/component-library usage expands.
- Add `subPackages` only after directory boundaries are stable.
- Add `chunks` strategy/overrides only after observing real output duplication.

## 3) Subpackage decision hints

- Start with normal subpackage + default chunks.
- Move to `sharedStrategy: 'hoist'` when duplication dominates package size.
- Keep `duplicate` when subpackage cold-start and loading latency are priority.

## 4) CI hints

- Separate build from IDE upload.
- Keep dist roots consistent with `project.config.json`.
- Use non-interactive CLI flags for automation.
