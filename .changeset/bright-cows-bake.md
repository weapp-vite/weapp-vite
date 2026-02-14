---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `auto-routes` 生成类型与 `defineAppJson` 的兼容性问题：`AutoRoutesPages`、`AutoRoutesEntries`、`AutoRoutesSubPackages` 改为非 `readonly` tuple，同时保持路由字面量推断精度，确保 `defineAppJson({ pages: routes.pages })` 在 TypeScript 下无需 `as string[]` 即可通过类型检查。

补充对应回归测试：
- 新增 `auto-routes` d.ts 生成器单元测试，覆盖 tuple 输出与 `readonly` 回归。
- 新增 `tsd` 用例，覆盖默认导入与具名导入，并校验非法 `pages` 类型报错。
- 新增 e2e fixture 与构建/类型检查用例，验证 `weapp-vite build`、`vue-tsc --noEmit` 及产物 `app.json` 路由内容。
