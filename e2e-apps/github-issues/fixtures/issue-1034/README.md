# autoRoutes.extensions 回归

开发基线：`e29dee8a5fbd4eda4048c6c2f87a62937af8a4d0`。

本场景让主包、普通分包和独立分包各有同名 `index.vue` / `index.js`。仅选择 Vue 页面，Vue 显式导入的 JS 仍作为业务依赖保留；生成的模块清单记录归一化模块身份和 chunk 归属，确认没有把分包业务提升到主包。

- 构建检查过滤页、配套模板/JSON、最终模块归属与路由类型。
- classic/stateful 依次删除所选 Vue 页面、检查 app.json 和路由类型移除、恢复并检查新声明与模板。classic 另验收显式业务模块更新。
- 两种 runtime provider 均导航三类页面并点击按钮。stateful HMR 开启真实 IDE 热重载，连续修改显式业务依赖并检查文字变化及本地计数保留。
- 缓存回归验证 app.vue 本身未变时，路由快照变化仍会更新 JSON 宏结果；源码图回归验证仅在模板使用的值 import 不被独立 TS 分析删除。

```sh
pnpm --filter weapp-vite build
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/issue-1034-auto-routes.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/issue-1034-auto-routes.runtime.test.ts e2e/ide/issue-1034-auto-routes-hmr.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-1034-auto-routes.runtime.test.ts e2e/ide/issue-1034-auto-routes-hmr.runtime.test.ts
```

E2E 串行执行。本轮构建/watch 3 项通过，两种 runtime provider 各 2 项通过，warning/error/exception 均为 0。使用 Node 24.18.0、pnpm 12.6.0、WeChat DevTools 2.02.2609231 和基础库 3.17.2。此为 PR 分支验证，合入主线后仍需复验，不能作为旧发布版本已实现的证据。
