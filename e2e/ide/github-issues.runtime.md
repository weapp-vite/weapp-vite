# GitHub Issue runtime 验收

Issue 修复以真实微信 DevTools E2E 为最终验收标准。headless、单测、类型检查和构建用于定位问题与辅助验证，不能替代真实 runtime 结果。

## 首屏守卫回归

`github-issues.runtime.issue911.test.ts` 在同一个 suite 内复用 automator，通过 `reLaunch` 切换场景，覆盖异步 blocking、首屏 redirect、abort、普通后续导航、超时、reject 和 late guard。redirect 必须到达结果页，且原页面未挂载；当前路由和真实渲染节点必须同时符合预期。

重建受影响 package 后，全局串行执行：

```sh
node --import tsx scripts/check-e2e-ide-shared-launch.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/github-issues.runtime.issue911.test.ts
```

macOS 长时间运行时使用 `caffeinate -dimsu --` 包装命令。启动前清理残留 DevTools、automator 和 E2E watcher。验收报告必须是严格模式通过，7 个场景、19 个检查点全部完成，无跳过或未恢复的运行错误。记录提交、IDE 与基础库版本；单次通过不能证明启动稳定，发现后续失败时必须同步更新验收结论。

## DevTools 冷启动排查

在 macOS、DevTools `2.02.2608060`、基础库 `3.17.3` 上，曾观察到 Builder 在启动中因 `setting.es6/enhance` 变化反复销毁和重建，随后模拟器显示 `simulator launch failed`，当前页协议报 `getPageMetaByWebviewId(...)=null`。`Uncaught [object Object]` 只是协议包装，不能据此判断 router 出错或认定重试必然恢复。

最小隔离实验不依赖 wevu：使用真实 AppID 创建一个原生项目，`App({})`、`Page({ data: { message: 'native ready' } })` 和 `<view id="ready">{{message}}</view>`，将该页面加入 `app.json`，通过同一 automator 启动。上述环境中，开启 `es6/enhance` 时复现了相同启动失败；两项均关闭时，真实当前页与 `#ready` 文本验证通过。应结合当次 IDE 原始日志确认，不能把所有同名错误都归因于这一原因。

`github-issues` 的 JS 由 Vite 编译，fixture 的 `project.config.json` 在打开 IDE 前固定 `es6: false`、`enhance: false`，避免再由宿主执行这两项转换。此设置仅用于该 Vite 产物 fixture，不应套用到仍依赖 IDE 编译的原生源码项目。

warmup 使用完整冷启动等待预算，随后才尝试同会话导航恢复；每次探测重新获取当前页。仅有路由、页面 data 或旧 page handle 均不足以通过，必须拿到真实根节点。恢复预算耗尽时保留原始错误、IDE 日志和失败报告，不能通过过滤错误、降低断言或重复运行后只保留成功记录来完成验收。
