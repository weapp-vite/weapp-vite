# #1058 模板组件标签分析验收

同一份 fixture 和断言分别由 headless 与官方 Stable 微信开发者工具运行，suite 内复用一个宿主，通过 `reLaunch` 切换两页。

- 首页覆盖内建标签、自动导入的 PascalCase / kebab-case、重复组件，以及点击后的三个独立实例更新。
- 边界页覆盖显式脚本导入的 lowercase / PascalCase，以及保留标签 `template` 内条件分支的删除和恢复。
- 启动前核对真实 AppID、页面条件、全部页面与组件产物，以及去重后的 `usingComponents`；内建和保留标签不能进入组件注册表。

非法模板、过滤规则和解析次数由 compiler 单测及完整编译性能入口覆盖，本 fixture 不把编译期机制断言混入小程序页面。

先重建 `weapp-vite` 和被修改的 compiler 包，再运行：

```sh
pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/issue-1058-template-tags.runtime.test.ts
```

真实 IDE 使用同一 suite、`e2e/vitest.e2e.devtools.config.ts` 和 `WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools`；运行前显式设置并核对官方 Stable 的 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH`。headless 通过不代表最终 runtime 验收完成。
