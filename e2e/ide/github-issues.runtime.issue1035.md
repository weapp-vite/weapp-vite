# #1035：App router 冷启动验收

## 复现与根因

以主线 `8289df36` 构建 `github-issues` 的两页最小场景：App setup 调用 `createRouter()`，冷启动首页 setup 立即调用 `useRouter()`，然后执行命名路由跳转和返回。

抖音真实 IDE 首先报 `Cannot read properties of undefined (reading '__wevuCurrentSetupState__')`：模块内 `globalThis` 不可用，但顶层宿主绑定存在。修复 setup 上下文和宿主解析后，还复现了微任务兼容层直接访问 `globalThis.queueMicrotask` 的异常。现在这两处均支持缺少 `globalThis` 的模块环境，编译目标优先选择相应宿主，`tt` 缺失时才使用 `wx` 兼容层。

支付宝验收进一步发现原生 Page 不提供微信式 `options` 字段，导致 `useRoute().query` 在 setup 为空，且 onShow/onReady 会清掉 onLoad 已传入的 query。支付宝 Page 适配层现在在挂载前保存 onLoad 参数，统一页面参数契约。

三端实际冷启动顺序均为：

```text
app:setup → app:router-created → app:onLaunch
→ home:setup → home:onLoad → home:mounted
```

没有观察到页面早于 App setup，也没有观察到同一主包加载不同 router 实例。因此未新增 App 初始化门控或抖音 Page 桥，router 仍按运行时执行域隔离。原有独立分包隔离测试继续通过；只有同步 setup 上下文沿用跨 runtime 副本共享语义。

setup 上下文在 `globalThis` 可用时保持原有执行域归属，仅在缺失时回退宿主对象。Web 会在入口模块之间安装 `wx`，如果始终优先宿主，不同导入时机会拆出两份状态；新增 VM 回归覆盖该顺序，现有 `auto-import-wevu-presets` Web E2E 验证自动导入的生命周期钩子与挂载入口共享上下文。

## 验收证据

2026-09-21，macOS，以下均使用重建后的包和 Vite 输出：

| Provider | 版本 | 可观察结果 |
| --- | --- | --- |
| 微信 DevTools | IDE 2.02.2608070 / 基础库 3.17.2 | 冷启动、跳转、返回、reLaunch 共 4 个严格 DOM 检查点通过；warn/error/exception 均为 0 |
| mpcore headless | 仓库当前源码 | 与微信共用 suite，4 个检查点通过；App setup 一次，reLaunch 后 home setup 两次 |
| mpcore browser | 仓库当前源码 / Chromium | 实际 Wevu App/router 模块的冷启动顺序、实例一致、页面渲染、命名跳转与返回通过 |
| 支付宝 IDE | IDE 3.10.10 / Simulator 35.26.16 / 基础库 2.10.15 | 重新加载应用后首屏实例一致；真实控制台调用页面公开导航方法，目标页显示 `same router: true`、`from: home`，返回首页且两个导航 Promise 完成；最终复验无运行错误 |
| 抖音 IDE | IDE 4.5.6 / 基础库 4.27.0.1 | 真实冷启动首页实例一致，下一页 query 正确渲染，返回首页，两个导航 Promise 完成，控制台无运行错误 |

支付宝通过 Computer Use 操作 IDE，导航调用的是页面暴露的 `openNext()` / `goBack()`，它们使用真实 `router.push()` / `router.back()`；页面截图和控制台同时核对。未使用编译成功替代 runtime 结果，也未使用真机测试。

微信首次验证曾在页面出现后立即返回，触发原生 navigateTo 超时。测试现已等待 `home:navigate:done` 和 `next:back:done`，确保原生完成回调结束后再继续下一步；保留严格 runtime 错误检查。

## 重跑入口

先构建 `@weapp-core/constants`、`@wevu/web-apis`、`wevu`、`weapp-vite` 及 automator/mpcore 依赖。不要让 `test:types` 的 dist 重建与下游 E2E 重叠。所有 E2E 全局串行；macOS 长时间验证使用 `caffeinate -dimsu --`。

```sh
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/github-issues.issue1035.build.test.ts
pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless WEAPP_VITE_E2E_TARGET_FILE=ide/github-issues.runtime.issue1035.test.ts WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/github-issues.runtime.issue1035.test.ts
pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools WEAPP_VITE_E2E_TARGET_FILE=ide/github-issues.runtime.issue1035.test.ts WEAPP_VITE_E2E_DOM_ACCEPTANCE=1 pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/github-issues.runtime.issue1035.test.ts
pnpm --filter @mpcore/simulator exec vitest run -c vitest.e2e.config.ts e2e/routerBootstrap.e2e.test.ts
```

支付宝、抖音：设置同一 `WEAPP_VITE_E2E_TARGET_FILE`，以 `-p alipay` / `-p tt` 构建 fixture。将输出目录作为对应 IDE 的小程序根目录，先重新加载整个应用观察首屏，再导航和返回；不得先 reLaunch 再声称冷启动通过。构建测试检查三个平台的两页脚本、JSON、模板及每个静态相对 require 引用均存在。
