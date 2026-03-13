---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp.autoImportComponents: true` 在含有 `wevu` 依赖的项目里未自动扫描 `src/components/**/*.vue` 的问题。现在 wevu 项目会默认补上主包和分包下的 Vue SFC 组件扫描规则，生成的 `auto-import-components.json`、`typed-components.d.ts` 与 `components.d.ts` 能正确包含这些组件，而 `typed-router.d.ts` 仍只负责页面路由类型。
