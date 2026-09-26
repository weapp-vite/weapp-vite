# #963 插件 ES6 对照验收

## 范围与结论

基线为 main `e45e4e22630cea6ce7786ec0109d27bcade02fad`，使用当前工作区构建的包。微信开发者工具 `2.02.2608070`、实际基础库 `3.17.3`；不把本次结果等同于 npm 发布包验证。

本次相同插件模板仅切换公开、私有配置中的 `setting.es6`，两组均能渲染插件 API、公开组件及插件 Vue 页面。Vite 生成的插件 JS 中没有向上越出插件根的 `@babel/runtime` helper 引用。当前版本组合没有复现原报告的白屏，尚不能据此证明旧 IDE `2.02.2608060` 的二次转译缺陷已经根本修复。

本 PR 只增加测试，不改 ES6 默认值、框架构建行为或公共类型；不需要 changeset。#963 保持开放，等待宿主修复说明或旧故障与新行为之间的可验证原因。

## 实际结果

- 严格 headless：4/4 case、6/6 DOM checkpoint 通过。
- 严格 DevTools：4/4 case、6/6 DOM checkpoint 通过，运行时 error/exception 为零；有 `getSystemInfoSync` 弃用警告。
- simulator 插件协议单测与 browser companion 各 1/1 通过，package typecheck 通过。
- 严格 IDE 的前一轮曾在启动阶段出现 current-page 协议错误，自动重试后 DOM 通过但整轮仍失败。Computer Use 确认项目已关闭回到列表，退出并重新启动 IDE 后，完整严格复测通过。保留此前失败记录，不将其算作通过。

## 验证内容

- 每种 ES6 配置创建独立工程，共享一次 automator 会话；两个 case 之间通过 `reLaunch` 返回宿主。
- 启动后重新读取两个项目配置，确认 ES6 值没有被 launcher 覆盖，且工程仍为插件模式。
- 检查插件 manifest 的主入口、全部公开组件和页面产物完整，扫描全部插件 JS 的越界 helper 引用。
- 宿主显示 `plugin.answer = 42`、公开 Vue 组件标题和四项内容；点击后原生组件的进度从 `78%` 更新为 `84%`。
- 实际导航到声明的 provider/插件页面，读取插件 Vue 页的真实标题，检查运行时异常为空。
- 同一场景纳入 headless DOM 与 exhaustive IDE 清单。simulator unit/browser companion 覆盖插件导出、宿主交互、插件导航及返回后状态保留。

## 查询边界

首轮真实 IDE 查询原始 `hello-showcase` 标签和插件页普通 CSS 选择器返回空值，但 Computer Use 能看到实际页面及内容。改用现有 `Page.getElementsByXpath` 跨渲染根查询后，相同标题、内容数量、交互与路由断言通过。没有改用 AppService 数据替代 DOM，也没有降低断言。

headless 节点句柄持有查询时的逻辑树快照，更新后应重新查询当前节点。最终 DOM checkpoint 每次读取当前页面，避免旧句柄造成假失败。

## 复现命令

先执行 `pnpm --filter weapp-vite... --filter wevu... -r build` 及 `pnpm --filter @mpcore/simulator... -r build`。以下 E2E 命令全局串行执行，真实 IDE 需正常登录并开启服务端口：

```sh
pnpm vitest run mpcore/packages/simulator/test/pluginProtocol.test.ts
pnpm --filter @mpcore/simulator typecheck
pnpm --filter @mpcore/simulator test:e2e e2e/pluginProtocol.e2e.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-963-plugin-es6.runtime.test.ts
WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/issue-963-plugin-es6.runtime.test.ts
```

环境变量示例使用 POSIX shell；其他平台可用对应 shell 的环境变量语法或 `cross-env`。产物全部由原生 Vite/Rolldown emit/write 生成。
