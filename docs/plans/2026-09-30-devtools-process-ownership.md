# DevTools E2E 进程归属与版本选择

启动失败和缓存恢复曾按名称终止所有微信开发者工具进程，Windows 使用镜像名、Unix 使用命令行子串。这会同时关闭手动打开的 IDE、其他项目和不同安装版本。自动恢复不能把进程名称当成资源所有权。

修复后的恢复只清理本次 bridge 启动明确登记的 CLI 子树。正常 close 与启动失败共享一次性 disposer；已退出的 bootstrap CLI 不向父进程报告可清理 PID。未知归属的残留 IDE 保持运行，不能自动误杀；需要重启时先确认实例归属并显式处理。

全局 session 与 port-lease 目录不再整体删除。会话自身的 close/disconnect、生命周期取消和桥接项目清理由原有资源管理器负责。

通过 `WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH` 选择安装版本；显式传入 `cliPath` 优先，其次环境变量，最后使用原有平台默认值。登录预检、direct/bridge 启动、engine build 与缓存恢复使用同一解析入口。此环境变量只影响测试基础设施，不改变公开 CLI API。

`cleanDevtoolsCacheAndStop` 保留调用兼容性，其 stop 仅作用于登记的资源。它不会停止复用的手动 IDE，也不会猜测由 CLI 间接启动且无法确认归属的宿主进程。

验证包括跨平台清理回归、重复释放及失败后重试、CLI 选择和启动恢复测试；真实 IDE 验证需另外记录宿主版本、页面运行结果以及清理后进程是否仍存活。原生 WXSS 更新失败应保留为宿主/监听诊断，不能以进程存活替代样式验收。

## 本轮实测（2026-09-30）

开发基线为主线 `3ba29d4b3939a3d3f43c5750927020f6bb62421c`。稳定版 DevTools `2.02.2608080`、基础库 `3.17.3`，使用真实 AppID 的独立原生页面，通过共享 bridge 会话运行。

- 修复前保护回归 5 项失败：macOS/Windows 全局进程清理、缓存重试、缓存清理后停止和 suite 清理均会触达无归属资源。
- 修复后真实 IDE：先执行恢复清理，再启动原生页面，读取红色计算样式，点击后计数为 1。失败后执行会话 close 和恢复清理，原宿主 PID 仍存活，原有项目仍打开。运行时订阅统计为 warning/error/exception 各 0；IDE 内部另有 frontend 初始化诊断，二者没有混为同一统计。
- 原生 WXSS 红→蓝更新失败：IDE 日志确认收到 `src/pages/home/index.wxss` 文件变更，计算样式在 30 秒内仍为红色。未进入后续绿色步骤，不能据此宣称连续 HMR 通过。该探针不经过 weapp-vite 编译链，样式验收与误杀修复分开记录。
- 另一次窗口关闭日志只有正常 `close-requested`，没有新的系统崩溃报告，无法仅凭此确定发起者。此前 RC Helper 的 SIGABRT 记录不作为稳定版崩溃证据。

定向命令：

```sh
pnpm vitest run --project e2e-hmr-infra e2e/utils/ide-devtools-cleanup.test.ts e2e/utils/devtoolsCli.test.ts e2e/utils/devtoolsProcessOwnership.test.ts e2e/utils/automator.cli-bridge.test.ts e2e/utils/automator.test.ts
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/automator-launch-resilience.test.ts
```

类型检查：新增 CLI 选择与资源归属模块通过定向 TypeScript 检查。包含旧 automator 依赖图的检查仍有 27 条既有诊断；在同 SHA 未修改 worktree 复跑后，按文件和错误内容比较无新增诊断，未将此描述为全量 typecheck 通过。

所有命令串行运行；真实 IDE 探针使用选定 CLI 环境变量，不覆盖默认安装，也不复制登录凭据。
