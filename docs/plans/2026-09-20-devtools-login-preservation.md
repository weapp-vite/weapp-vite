# IDE E2E 登录中断与缓存恢复边界

## 登录退出证据

官方 Stable `2.02.2608070` 的日志记录了以下顺序，时间为本地时间：

| 时间 | 事件 |
| --- | --- |
| 2026-09-20 23:39:32 | `requestRefreshTicket error 40030` |
| 同秒 | `[LoginState] conditional-logout-executing` |
| 同秒 | `[LoginState] logout-complete` |
| 2026-09-20 23:39:56 | 用户重新扫码后 `login-complete` |

宿主错误常量将 `40030` 定义为 `DEV_INVALID_SIGNATURE`。`TicketService` 刷新凭据收到拒绝后，`LoginService` 执行退出并清除账号信息。这确认了退出的直接路径，但不能仅凭错误码确定签名为何失效。该次退出发生时，本地 E2E 已停止，正在等待远端 CI。

此前样式 HMR 对照使用过独立 IDE 副本。宿主根据安装路径派生配置目录，副本与系统安装因此持有不同的凭据。分别扫码后旧凭据被服务端拒绝是待核实的解释，不作为已证明结论。后续验证仅使用系统安装，不再次登录诊断副本，不复制或改写账号凭据。

## 已修复的自动恢复越界

E2E 的多个 suite 初始化使用 `cache --clean all`；automator 连续恢复依次清理 `compile` 和 `all`。只读检查官方实现确认，`all` 同时触发存储、文件、网络、授权和 `clearSession` 清理，超过构建缓存恢复的职责范围。

这些小程序授权和会话与 IDE 开发者账号不是同一状态。当前 Electron 实现的 `all` 没有直接调用 IDE 账号退出，也不能据此断言它造成上述 `40030`。但基础设施重试无权清除用户授权或业务数据，该问题需要独立修复：

- 所有 suite 初始化与自动恢复均限制为 `compile`。
- 共享清理入口同时通过类型与运行时校验拒绝其他类型，在调用 CLI、停止进程或清理文件前失败。
- 同一 automator 启动序列只成功清理一次编译缓存；后续可恢复失败仍保留既有重开项目重试，不升级到清除授权和会话。
- 不修改 IDE 安装、账号配置或系统服务，不增加 skip 或放宽 runtime 断言。

修改前，六个清理边界用例及两个连续恢复用例失败，证明旧实现接受越界清理并在重试中执行第二次全量清理。验证入口：

```sh
pnpm vitest run -c e2e/vitest.e2e.internal.config.ts e2e/utils/ide-devtools-cleanup.test.ts
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/automator-launch-resilience.test.ts
```

本次属于 E2E 基础设施修复，不改变发布包、fixture 页面或 mpcore runtime 行为，不需要 changeset、AppID 或页面条件变更。已有超过 300 行的 suite 和 automator 文件仅修改所属缓存策略，不混入拆分重构。

## 验收边界

真实验证应记录官方 CLI 的 `islogin` 前后结果，并覆盖编译缓存清理、进程停止及重新打开后的 runtime 断言。通过只能证明该恢复路径保留本次登录，不能保证服务端凭据永不过期。

本次修改后验证结果：

- 清理入口 13/13、automator 启动恢复 67/67；完整基础设施 71 文件、678/678。
- 官方 Stable 的 `app-lifecycle.test.ts` 通过：依次对原生、Wevu TS、Wevu Vue fixture 清理编译缓存、停止进程、重新打开并冷启动；三个 fixture 使用各自的一次 automator 会话，6/6 DOM 检查点通过。
- 真实用例执行前 `islogin` 为 `true`；用例最终清理后再次启动官方 IDE，`islogin` 仍为 `true`。期间没有重新扫码。
- 范围 ESLint、共享启动检查通过，DOM 清单重新生成并检查。没有运行 Wot UI/uView Plus E2E。

真实验证命令：

```sh
pnpm vitest run -c e2e/vitest.e2e.devtools.config.ts e2e/ide/app-lifecycle.test.ts
```

全面回归仍受官方 IDE 样式 HMR 缺陷限制，见 [样式 HMR 诊断](./2026-09-20-devtools-style-hmr-diagnostic.md)。本修复不替代该问题的严格最终验收。
