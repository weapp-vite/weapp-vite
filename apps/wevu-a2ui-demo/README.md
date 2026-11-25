# Wevu × A2UI 示例

本应用消费独立的 `@wevu/a2ui` workspace 包，验证服务端 A2UI 1.0 消息经 Wevu 递归宿主组件渲染、输入写回数据模型、动作外发给假 agent 并回包刷新的完整闭环。运行时包直接依赖 `@a2ui/web_core@0.16.1`；应用保留演示目录、售后 surface 消息、宿主组件和业务回包逻辑。

包的完整 API 与协议范围见 [@wevu/a2ui README](../../packages-runtime/a2ui/README.md)。当前包尚未发布到 npm，也还没有预编译的通用宿主组件包，`a2ui-node` 由本应用自带。

## 运行

```sh
pnpm install
pnpm --filter @wevu/a2ui build
pnpm --filter wevu-a2ui-demo build
pnpm --filter wevu-a2ui-demo dev
pnpm --filter wevu-a2ui-demo open
```

开发者工具需开启服务端口。应用沿用仓库演示 AppID；部署到自己的账号时替换项目配置。修改包源码后必须重建包，再验证应用。

## 代码分工

- `src/catalog.ts`：改编自 A2UI 1.0 Basic Catalog 的窄目录，含 Column、List、Card、Tabs、Text、TextField、Button 和业务 `OrderSummary`。
- `src/fixtures/afterSales.ts`：首屏 `createSurface`、增量 `updateComponents` / `updateDataModel`、异常消息和假 agent 回包。
- `src/runtime/session.ts`：用 `createA2uiSession` 驱动视图，管理提交去重、增量播放、异常保留与重置。
- `src/components/a2ui-node`：递归宿主组件，按 `A2uiNode.type` 静态分支；TextField 显式选择 `bindingName: 'value'`，Tabs 为演示用途递归读取并同时展开 `props.tabs[].child`，不实现真实页签切换。
- `src/components/a2ui-order`：业务组件，接收 `OrderSummary` 的已求值属性。
- `src/pages/index/index.vue`：渲染 surface、暴露演示控制与页面卸载清理。
- `src/pages/basic/index.vue`：只用目录内基础组件，不注册业务节点。

`vite.config.ts` 不注册 resolver：当前没有预编译组件包，组件由页面 `usingComponents` 静态引入。

## 演示路径

1. 点击“查看订单信息”，事件经递归组件抵达 `interact`，动作外发后由假 agent 回写 `/status`。
2. 输入售后原因，写回 `/form/reason` 并同步更新绑定同一位置的输入框值；提交去重，600 ms 后模拟成功。
3. 原因包含“失败”时模拟服务失败，修改后可重试。
4. 播放增量更新：追加服务说明、按 id 覆写其文案、改写标题与步骤列表，并用数据模型清空提示；A2UI 不提供删除组件，隐藏通过绑定值表达，输入内容保留。
5. “验证异常恢复”注入目录未声明的组件类型，界面保留上一版并显示协议错误；重置后重新下发首屏。
6. 页面卸载停止播放计时器与会话，卸载后不再有宿主写入或遗留任务。
7. 基础目录页通过 `Tabs.tabs[].child` 渲染嵌套文本与输入，验证不依赖业务组件的槽位投影。

## 验证

```sh
pnpm --filter @wevu/a2ui test
pnpm --filter @wevu/a2ui typecheck
pnpm --filter @wevu/a2ui test:types
pnpm --filter wevu-a2ui-demo test
pnpm --filter wevu-a2ui-demo typecheck
pnpm exec eslint packages-runtime/a2ui apps/wevu-a2ui-demo
pnpm exec stylelint 'apps/wevu-a2ui-demo/src/**/*.vue'
```

以下命令全局串行执行，先确认没有残留 E2E、automator 或 dev-watch 进程：

```sh
pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/wevu-a2ui.runtime.test.ts

pnpm exec cross-env WEAPP_VITE_E2E_RUNTIME_PROVIDER=devtools \
  WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH="<已登记的微信开发者工具 cli 路径>" \
  WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION=<所选版本> \
  WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL=<stable|rc|nightly> \
  pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/wevu-a2ui.runtime.test.ts
```

同一 suite 共享一个 automator，按路由 `reLaunch` 验证。第二条命令默认需要本机已登记微信开发者工具**稳定版**安装；RC/nightly 只在显式指定渠道与版本时运行，不静默换版、不绕过登录。`test/noEval.test.ts` 从公共入口把会话、目录与消息处理打成一份 bundle，在禁用 `Function` / `eval` 的 `vm` 上下文里执行，确认初始化、校验、投影、增量更新全程没有动态求值尝试。

页面度量通过 `page.callMethodWithOptions('readMetrics', { routeOnly: true })` 读取：2026-11-25 的 Nightly 实测中，开发者工具原生 `Page.callMethod` 协议在本页返回 `this.readMetrics is not a function`，`routeOnly` 改走 AppService 的 `getCurrentPages()` 路径，headless 与真实 IDE 双端一致，也与本仓库其他 Wevu IDE 用例的读法相同。

包级单测 21 项，覆盖多绑定/多动作选择、`Tabs.tabs[].child` 嵌套投影、异步动作隔离、本地 `functionCall`、catalog 函数错误与继承成员边界、数据回滚与幂等销毁；应用单测 6 项，noEval 探针同时检查售后输入与嵌套基础页文本。headless runtime suite 4 项全部通过，覆盖基础目录页、递归宿主与真实输入/点击事件、增量更新后的输入保留、异常消息保留上一版界面、失败重试与卸载取消。2026-11-25 在 `@a2ui/web_core@0.16.1` 下固定场景实测：dist 总量 1077052 字节（主包约 1.03 MB，包含 `@a2ui/web_core` 依赖图与包内兼容层）。

同一天按维护者显式指定的 Nightly 2.02.2611232（基础库 3.18.1）在 Windows 上运行真实 IDE 分支：4 项断言全部通过，基础目录页包含 `Tabs.tabs[].child` 嵌套渲染，其中还包含开发者工具截图路径与增量场景度量 8 次 / 53624 字节，与 headless 数值一致。该轮 teardown 暴露出 `weapp-ide-cli` 的平台缺口：活动 MAIN 日志识别仅在 macOS 生效（`windowClose/activeLog.ts` 在非 darwin 直接回退），Windows 回退为按目录扫描且要求同版本 MAIN 日志唯一，而同一 profile 会随每次启动累积多份 MAIN 日志，故关闭证据被判为歧义、机器租约与 journal 按策略保留待恢复——断言结果不受影响。已在同一提交内修复：非 macOS 回退按本轮受管项目会话令牌收窄候选日志，复用仓库恢复 API 释放本轮 scope 后重新核验得到唯一游标与完整的原生窗口销毁证据。

升级到 `@a2ui/web_core@0.16.1` 后，Core 的动作解析路径会构造 `AbortController`，而真实 AppService 未提供该内建，页面 `model.error` 报 `AbortController is not a constructor`。修复放在包内：`createA2uiCatalog` 显式调用 `installA2uiRuntimeCompat()`，复用 `@wevu/web-apis/abort` 的 polyfill 补齐 `AbortController`、`AbortSignal` 与 `Object.hasOwn`，应用不需要额外的 `weapp.appPrelude.webRuntime` 配置。此前尝试的构建期注入虽然同样能让断言通过，但会为两个全局对象引入整份 request-globals 运行时，产物多出约 290 KB，故不采用。同一 Nightly 安装重跑真实 IDE 分支：4 项断言与度量（8 次 / 53624 字节）与 0.15.0 基线一致，teardown 直接命中本轮唯一的 MAIN 日志游标并拿到原生窗口销毁证据（`releasedReason=project-closed`），无需再走恢复流程。

`src/runtime/metrics.ts` 仅统计当前应用页面的 `setData`，用于观察递归宿主的重渲染规模；runtime suite 输出本次产物总字节数、测量范围内的调用次数与 JSON UTF-8 字节数（增量场景实测 8 次 / 53624 字节），并断言卸载后 `lateSetData` 为 0、`cancelledTasks` 大于 0，即在途任务确实被取消且没有迟到的宿主写入。

尚未验证真机、其他小程序平台、真实网络分块解码或模型直接输出。
