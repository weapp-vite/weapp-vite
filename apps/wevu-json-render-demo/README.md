# Wevu × json-render 示例

本应用消费独立的 `@wevu/json-render` workspace 包，验证 JSON 描述经 Wevu 渲染、输入绑定、自定义组件事件和 SpecStream 更新的完整闭环。适配包直接依赖 `@json-render/core@0.21.0`；应用保留组件目录、订单数据和售后业务动作，不再维护独立的通用 renderer。

包的完整 API 与协议范围见 [@wevu/json-render README](../../packages-runtime/json-render/README.md)。当前包尚未发布到 npm。

## 运行

```sh
pnpm install
pnpm --filter @wevu/json-render-components build
pnpm --filter @wevu/json-render build
pnpm --filter wevu-json-render-demo build
pnpm --filter wevu-json-render-demo dev
pnpm --filter wevu-json-render-demo open
```

开发者工具需开启服务端口。应用沿用仓库演示 AppID；部署到自己的账号时替换项目配置。修改包源码后必须重建包，再验证应用。

## 代码分工

- `vite.config.ts`：使用包的 `JsonRendererResolver()` 注册包内预编译组件。
- `src/catalog.ts`：在 `standardComponents` 上扩展 `OrderSummary`，声明 `submit` / `inspect` 动作及 schema。
- `src/fixtures/afterSales.ts`：完整 spec 和录制的 JSONL Patch。
- `src/state.ts`：售后业务初始状态。
- `src/runtime/session.ts`：通过 `createJsonRenderer` 提交业务状态，管理模拟提交、录制流播放和重置。
- `src/components/business-node`：以静态分支把通用 `RenderNode` 映射为订单组件，发送 `RendererEvent`。
- `src/pages/index/index.vue`：把 `renderer.tree` 交给包的 `<json-renderer>`，注册业务泛型组件和页面卸载清理。

## 演示路径

1. 点击“查看订单信息”，业务节点事件经包内递归组件抵达 `inspect` 动作，更新状态文案。
2. 输入售后原因，条件提示消失；提交时去重，600 ms 后模拟成功。
3. 原因包含“失败”时模拟服务失败，修改后可重试。
4. 播放录制流：补充服务说明、替换标题、移除提示，保留输入；可以重新播放。
5. “验证异常恢复”注入未知组件类型，界面保留上一版；重置后清空业务状态和错误。
6. 页面卸载同时停止播放计时器和 renderer；异步提交通过动作清理回调取消，并阻止过期状态写回。

## 验证

```sh
pnpm --filter @wevu/json-render test
pnpm --filter @wevu/json-render typecheck
pnpm --filter @wevu/json-render test:types
pnpm --filter wevu-json-render-demo test
pnpm --filter wevu-json-render-demo typecheck
pnpm exec eslint packages-runtime/json-render apps/wevu-json-render-demo
pnpm exec stylelint 'packages-runtime/json-render/components/**/*.vue' 'apps/wevu-json-render-demo/src/**/*.vue'
```

以下命令全局串行执行，先确认没有残留 E2E、automator 或 dev-watch 进程：

```sh
pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/wevu-json-render.runtime.test.ts
pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/wevu-json-render.runtime.test.ts
```

同一 suite 共享一个 automator，按路由 `reLaunch` 验证。源码和构建后的包均有测试：应用的 noEval 检查从公共入口打包，显式拦截 `Function` / `eval` 并验证初始化、校验、投影、Patch 全程没有动态求值尝试。

2026-09-28 抽包后验证：包级单测 12 项、应用单测 5 项；headless 与真实微信 DevTools 各 4 项，覆盖基础目录、自定义组件和售后交互场景。自定义订单节点的渲染和事件转发有可见结果断言。simulator 同步补充 Node/browser 泛型递归透传及浏览器回归。

`src/runtime/metrics.ts` 仅统计当前应用页面和订单组件的 `setData`；包内组件不注入业务测量逻辑，因此不能与抽包前的全树计数直接比较。准确计数随批处理时序变化，runtime suite 输出本次产物总字节数、测量范围内的调用次数和 JSON UTF-8 字节数，并检查卸载后没有写入与遗留任务。

当前固定场景 dist 总量为 509055 字节（约 497 KiB，包含配套原生组件）。应用测量范围内，headless 为 9 次 setData / 10866 字节，DevTools 为 8 次 / 10865 字节；两端卸载后写入和遗留任务均为 0，最终 runtime 日志无 warning/error/exception。

真实 IDE 截图输出到 `docs/reports/json-render/after-sales.png`，生成证据不提交。尚未验证真机、其他小程序平台、真实网络分块或 AI 输出。

## 验证发现的宿主差异

- simulator 曾共享父子组件对象属性引用，导致深层修改不触发递归投影；已在属性传递边界隔离引用。
- simulator 曾只查 `usingComponents`，未继承父级已解析的泛型映射；现在递归节点继续传递泛型，保持真实微信行为。

这些修复分别有最小回归和 simulator changeset。既有 render/component 与 render/index 文件超过 300 行，本次沿用 Node/browser 分层，仅修正所有权和映射传递，不混入无关拆分。另修复 weapp-vite lib 模式对递归 SFC 生成重复注册入口的问题，组件仍由逻辑入口统一注册，包含编译选项单测和本应用 runtime 回归。
