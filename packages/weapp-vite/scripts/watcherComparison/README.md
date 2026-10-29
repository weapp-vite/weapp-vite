# 自有文件观察后端对照

契约测试与此工具复用 `scenarios.ts` 中的 12 个真实文件保存场景。每轮每个后端在独立 Node 子进程执行，相邻轮次交换后端顺序；所有场景、创建的观察会话和目录均顺序收尾。

从仓库根目录通过既有机器串行租约运行对照：

```sh
pnpm test:watcher-comparison --runs 3 --report .tmp/watcher-comparison/report.json
```

只验证共享契约时使用独立的原生入口：

```sh
pnpm test:watcher-contracts
```

该入口覆盖 Chokidar/Parcel 的全部共享场景和引擎选择断言；`fileWatcher.contract.test.ts` 已从包的 fast/serial 普通单测分区排除。专用 `vitest.watch-native.config.ts` 固定单 worker、文件与用例串行，并复用机器租约 global setup；直接运行 `pnpm exec vitest run --config packages/weapp-vite/vitest.watch-native.config.ts` 也取得同一机器租约。使用 Parcel 的真实原生订阅，加载、注册、交付或关闭失败保留为失败，不以 mock、跳过或另一后端结果替代。`fileWatcher.lifecycle.test.ts` 只有 mock 订阅，继续进入普通 fast 单测。

普通 `pnpm test`、包单测与 `pnpm test:hmr` 不执行这份原生契约。完整原生契约验收使用上述显式命令且不添加用例过滤；筛选运行只用于诊断。专用入口与 comparison、下游 HMR、headless 和真实 IDE 共享同机串行门禁，启动前仍须核对现有 E2E/dev-watch 的资源归属。

`--engines chokidar,parcel` 为默认选择，`--runs` 默认为 3。内部 `--child` 仅由父进程调度，外层机器租约覆盖全部子进程；不要用内部入口绕过串行门禁。

三系统对照复用 `CI E2E` 的 `watcher-comparison` 定向入口，在 Linux、Windows、macOS 的 Node 24 上分别执行三轮并上传 JSON。通过原有冻结上下文与 PR 准入；主线运行可在选定提交推送后执行：

```sh
gh workflow run ci-e2e.yml --ref main -f hmr-diagnostic=watcher-comparison
```

已配置入口不代表三系统已执行；报告必须记录具体运行和提交。

覆盖 1024 文件目录树中的连续单文件保存、首次扫描期间保存、初始事件抑制、动态依赖首保存、目标移除、原子替换后再次保存、目录删除重建、缺失根目录及文件恢复、根外及链式符号链接的逻辑路径和目标切换、深度限制与新增根目录、共享物理目标的独立 owner 退出、注册期间关闭，以及过滤和稳定写入。

JSON 包含每步遗漏、重复、通知延迟、磁盘状态核验时间，每个观察会话的启动与关闭时间，以及场景 CPU、RSS、活动句柄及资源类型。创建和更新文件必须匹配明确指定内容的 SHA-256；目录创建和删除必须匹配最终文件类型或缺失状态。`latencyMs` 测量操作开始到匹配通知，`verificationMs` 测量同时观察到匹配通知和所需磁盘状态的耗时。临时目录只在运行时创建，报告中的文件均为 fixture 相对路径。失败保留为失败，不以另一个后端成功覆盖。

`identity` 从实际解析的安装文件记录包版本、包内入口及 SHA-256；Chokidar 额外记录发行文件集合、仓库 `6.0.0` patch 的摘要，锁文件也独立取摘要。源码基线包含 Git revision、dirty 状态，以及工具和适配器目录中排序后的文件摘要集合。父进程与每轮子进程均记录身份，依赖、锁文件或相关源码不一致时该轮失败；patch 文件摘要用于标识仓库基线，单独存在不等于补丁已应用。Parcel 没有公开查询所选 native binding 身份的接口，报告明确记为 `not-observed`，不把 JavaScript wrapper 身份解释为原生二进制身份。

公有通知只包含路径、类型和事件，没有原生通知对应的字节版本。最终状态核验只能证明场景驱动已写入所需版本，不能证明当前通知由该次保存引起；迟到的旧通知仍可能匹配后续步骤。工具不拦截原生通知、stat 代或消费方读取，真实 HMR 产物验收才用于证明消费方使用了最新输入。

重复通知是同一步观察窗口中的计数，不代表操作系统原始事件数量，也不自动判为失败。160 ms 的静默观察窗口用于检查停止交付及重复通知，不作为注册前或首次保存前的预热。CPU 包含场景建树、保存、磁盘核验及驱动开销，没有单独的空闲 CPU 阶段。句柄数量来自 Node 诊断接口，RSS 峰值按 20 ms 采样；它们用于同环境对照，不作为跨平台固定预算，也不证明底层原生资源的所有权。

`cleanupConfirmed` 表示本场景登记的公有 `close()` 均已完成且 fixture 已删除，不是原生句柄终结回执。关闭或删除失败时保留 fixture，并停止后续场景、后端和轮次；子进程超时或没有完整报告时同样停止，未运行项记为 `notRun`。`retainedFixture` 仅记录解析后系统临时目录下的目录名，恢复时必须核对该次任务归属，不做全局清理。

该工具衡量 weapp-vite 自有观察层，不改变 Vite/Rolldown 的原生监听，也不替代构建发布、headless 或真实 IDE 的 HMR 验收。它没有完整覆盖既有 Chokidar 依赖契约的 29 项场景；逐项映射和剩余缺口见 [coverage.md](./coverage.md)。本机结果不能作为真实 Windows/macOS/Linux 一致性的证明，也不能单独作为修改默认后端的依据。
