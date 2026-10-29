# 自有文件监听后端抽象与 Parcel 评估

评估日期：2026-10-29。

当前自有监听已经可以通过内部 `FileWatcher` 接口切换 Chokidar 与 `@parcel/watcher`，无需让业务层依赖两者的原始事件和资源句柄。默认继续使用 Chokidar，Parcel 保留为显式选择的候选后端。本机三轮对照中，Chokidar 通过 36/36 个场景，Parcel 通过 33/36 个场景；Parcel 三轮均报告 FSEvents 丢事件，现有证据不足以支持修改默认值。

Watchpack 尚未实现或验证。本次结果只能说明双后端的内部抽象已经落地，不能解释为 Chokidar、Parcel、Watchpack 三选一已经完成。

## 抽象边界与已迁移范围

实现位于 [`packages/weapp-vite/src/runtime/watch/fileWatcher`](../../packages/weapp-vite/src/runtime/watch/fileWatcher/index.ts)。该模块负责路径观察、动态订阅、事件归一化与资源关闭；依赖归属、重建调度、模块失效和构建产物发布仍由各消费层负责。

| 已迁移的自有入口 | 归属文件 | 保留在消费层的职责 |
| --- | --- | --- |
| 开发构建快照 sidecar | `src/runtime/buildPlugin/service.ts` | 模板、worker 与独立构建输入的归属，失效及构建发布 |
| 复制资产与 public 资产 | `src/runtime/watch/assets.ts` | 资产扫描、过滤和增删后的最终归属 |
| classic 配置及其依赖 | `src/runtime/buildPlugin/classicConfigWatcher.ts` | 依赖重读、revision 与配置重载；复用一个逻辑观察会话 |
| 自动路由发现 | `src/plugins/autoRoutes.ts` | 路由结构刷新及入口更新 |
| 自动导入组件发现 | `src/plugins/autoImport.ts` | 候选组件识别、注册与刷新 |
| 入口失效监听 | `src/plugins/utils/invalidateEntry/watcher.ts` | 入口归属与 invalidation |
| 根外 WXML 依赖 | `src/wxml/processing/watch.ts` | 引用账本及精确路径过滤；根内输入继续由 Vite 观察 |
| 测试产物外部输入 | `src/testArtifact.ts` | 构建输入指纹、重建串行与产物会话关闭 |

表中路径均相对于 `packages/weapp-vite`。Vite 开发服务器、Vite/Rolldown 构建器自己的依赖监听，以及第三方插件内部监听保持原生命周期；`weapp.watch.engine` 不会把整个构建链的所有文件监听统一换成 Parcel。

统一接口包含以下契约：

- `ready`、`add()` 和 `updateTargets()` 明确区分 `ready`、`closed` 与错误拒绝。动态注册失败恢复原目标，并等待本轮新增资源清理；重试相同目标不会被误判为已经注册。
- 通知使用逻辑绝对路径、`create` / `update` / `delete`、文件或目录类型，以及可选的初始扫描标记。批量通知用于驱动消费层重读最终状态，不承诺还原操作系统原始事件序列。
- `onError()` 保留原始错误；注册或回滚同时发生清理失败时保留组合错误。`close()` 幂等，并等待登记中的订阅及释放任务。
- `depth`、`ignored`、`ignoreInitial` 和稳定写入门禁由明确的共享选项表达。自有 sidecar 只统一继承既有 polling 配置，不全量继承 `server.watch`，避免宿主 `depth` 或过滤器意外改变其他消费层。

选择优先级为显式 `weapp.watch.engine`、`WEAPP_VITE_WATCH_ENGINE`、默认 `chokidar`。非法值直接报错。后端能力有明确差异：

| 能力或配置 | Chokidar | Parcel |
| --- | --- | --- |
| polling | 保留既有 canonical polling 配置 | 不支持，显式报错 |
| `persistent: false` | 保留支持 | 不支持，显式报错 |
| `atomic` | 保留旧宿主的显式配置 | 按最终状态归一化，不承诺相同的 unlink/add 拆分 |
| 根外或链式符号链接 | 使用既有 Chokidar 行为 | 适配层维护逻辑/物理映射、重定向及缺失根恢复 |
| 普通保存后的状态核对 | 有 Stats 的 update 重读当前磁盘 Stats 后去重 | 将 native batch 视为失效提示，核对实际状态差异 |
| 运行中 native stream 错误 | 交付原始错误 | 交付原始错误，再串行重建订阅并完整重扫 |

WXML 原先显式使用的宿主选项在该消费层转换：`awaitWriteFinish` 转为共享稳定门禁，`atomic` 单独保留。后续增加 Watchpack 需要实现同一套就绪、动态目标、逻辑路径和关闭契约，并运行同一套验证；仅包装其回调不足以证明可替换。

## 本机三轮对照证据

原始证据为本次任务的 `.tmp/current-run/parcel-watcher/comparison.json` 与 `comparison.log`。记录时间为 `2026-10-29T11:07:02.172Z`，环境为 Node `v24.22.1`、macOS（`darwin`）`arm64`。每个后端每轮使用独立子进程，轮次间交换执行顺序；12 个场景在各进程内串行执行，没有首次保存前预热。

| 轮次 | Chokidar | Parcel | Parcel 的失败 |
| --- | --- | --- | --- |
| 1 | 12/12 | 11/12 | 大树连续保存期间 FSEvents 丢事件 |
| 2 | 12/12 | 11/12 | 同上 |
| 3 | 12/12 | 11/12 | 同上 |
| 合计 | **36/36** | **33/36** | 三次均保留为失败 |

72/72 个计划场景均已执行，未运行项为 0；全部场景登记的公有 `close()` 完成且 fixture 删除，`cleanupConfirmed: true`。报告记录的通知遗漏和窗口内重复计数均为 0，这不抵消 Parcel 的原生错误。

比较对象为仓库已打补丁的 Chokidar `6.0.0` 与 `@parcel/watcher` `2.6.0`。报告在父进程及各子进程记录实际解析包文件、源码和锁文件摘要，并校验身份一致。Git 基线为 `1d7346e41593949bc5b01291528cda7fbc66b091`，运行时工作树为 dirty，因此不能仅用该 Git revision 指代被测代码。该轮关键摘要如下：

| 输入 | SHA-256 |
| --- | --- |
| 适配器目录 | `d98b234c32f076aa29fac2341af79b2c765de87e5a39154c89b496fa2f600e6b` |
| 对照工具目录 | `809a5a82a0e47482b99e30b089a2acff4ff279ea7188492f4f93d8ae9f3aaf8f` |
| 锁文件 | `0ff1a1fbd7d08660eb4bba1728d760170d715d178a7ec622805749e0f86d67da` |
| Chokidar patch 基线 | `8ce217805cf1cbd7c36a76f0092e63d69becce0bce61582919331c0a39d7028f` |

Parcel 的公开 API 不提供所选 native binding 的身份查询，本轮明确记录为 `not-observed`；JavaScript 包版本和摘要不能代替原生二进制身份。

上述工具摘要对应实际对照时的版本。随后为三系统执行补充了 Windows 原生路径与适配器路径的分隔符归一化，保留大小写、事件与文件类型的区别，并增加纯函数回归；该修正不改变本次 macOS 输入的匹配结果。后续远端对照需绑定提交后的最终 revision。

### 重复出现的 FSEvents 溢出与恢复

Parcel 三轮均在 `large-tree-repeated-single-save` 报告：

```text
Events were dropped by the FSEvents client. File system must be re-scanned.
```

该场景先创建 32 × 32 个文件，再完成初始注册，随后对同一文件连续保存 8 个明确版本。三轮共 24 次保存均收到匹配通知且最终内容摘要正确，后续场景也继续完成。但 native 明确告知事件流曾不完整，因此该场景仍判失败，不能记为 Parcel 36/36。

适配层收到 native 错误后先报告原错，再通过串行队列释放并重建订阅、完整重扫当前目标。当前观察支持“这三次出现错误后，场景仍收敛到要求的磁盘状态”；没有逐次原生订阅重建回执，也没有故障注入到每个消费方读取阶段，尚不能推广为溢出后始终无损恢复。不得吞掉错误或以更长等待把它改写成无故障通过。

本轮也定位了 Chokidar 的旧 Stats 重复通知：回调携带截断时的零长度 Stats，而当前磁盘已经写完。适配层改为用当前磁盘 Stats 去重；读取发现文件缺失时等待既有删除契约，其他读取错误继续报告。本次最终三轮未观察到相关重复。

### 性能观测与限制

下表汇总三轮原始数据，分位数采用排序后的 nearest-rank。通知延迟包含 93 个有期望通知的步骤；启动、关闭分别包含 42 个观察会话。失败大树场景中已经取得的测量值也保留在统计内。

| 指标 | Chokidar | Parcel |
| --- | --- | --- |
| 通知延迟 p50 / p95 / 最大值 | 11.98 / 128.14 / 223.11 ms | 74.90 / 137.12 / 338.74 ms |
| 注册就绪 p50 / p95 | 22.71 / 95.32 ms | 5.71 / 56.61 ms |
| 公有关闭 p50 / p95 | 0.364 / 2.776 ms | 0.362 / 0.710 ms |
| 每轮场景 CPU 总和范围（user + system） | 1485–1659 ms | 722–765 ms |
| 每轮采样峰值 RSS 范围 | 233.22–245.52 MiB | 107.25–114.86 MiB |
| Node 活动句柄采样峰值 | 每轮 6 | 每轮 3 |

这些数值只支持当前机器、当前输入和适配器组合的对照，不构成操作系统后端的通用性能排名：

- `latencyMs` 从文件操作开始到匹配的归一化通知；公有通知没有字节版本，最终内容 SHA-256 核验也不能证明通知与某次保存的因果关系。迟到的旧通知仍可能匹配下一步同路径事件。
- CPU 包含建树、文件写入、内容核验与场景驱动，没有独立空闲 CPU 阶段，不能称为 watcher 空闲占用。RSS 和活动资源每 20 ms 及通知边界采样，可能漏掉短峰值。
- Node `_getActiveHandles()` 和活动资源类型不完整表达 native 线程、FSEvents stream 或底层资源数量；公有 `close()` 完成也不是精确原生关闭回执。
- 重复计数只覆盖每步 160 ms 观察窗口，且计数本身不自动判失败。0 重复不代表操作系统只产生一次事件，也不证明所有延迟通知都已排空。
- Parcel 同轮包含溢出后的恢复，Chokidar 包含既有 patch 与适配器的磁盘核对；不能从较低 CPU、RSS 或句柄计数推导更高可靠性。

## 既有 29 项契约仍需保留

共享的 12 个真实文件场景验证正常保存、首次扫描、动态目标、原子替换、目录和缺失路径恢复、符号链接、深度、独立 owner、关闭以及过滤/稳定写入。另有 mock 测试覆盖异步注册、释放、失败回滚和原始错误身份；mock 不打开 native 订阅，不能证明原生资源行为。

既有权威清单 [`scripts/dependencyContracts/chokidar/scenarios.mjs`](../../scripts/dependencyContracts/chokidar/scenarios.mjs) 的 29 项要求没有被这 12 项取代。逐项映射见 [`coverage.md`](../../packages/weapp-vite/scripts/watcherComparison/coverage.md)，主要缺口包括：

| 需要继续验证的边界 | 当前对照不能证明的内容 |
| --- | --- |
| Windows 精确错误分类 | `EPERM/watch` 与路径消失的组合、`EACCES`、错误 syscall/path、仅大小写不同的路径及 presence probe 失败负控 |
| 异步读取与代际交错 | 暂停 root readdir 或 child stat 后关闭；旧 listing、旧 ENOENT 在新目录或 inode 建立后返回时不能提交旧结果 |
| 共享原生资源所有权 | 物理资源只获取一次、兄弟 owner 注册失败仍不影响幸存者、精确的最后原生关闭回执 |
| 原子替换与冷却期 | 持有 unlink flush、旧代读取与再次删除交错、共享 inode 替换和迟到错误的组合 |
| polling 与同步取消 | interval/persistence 升级后分别关闭新旧 owner；同步 add/ready 内取消且兄弟 owner 存活 |
| 跨平台实现 | 真实 Windows、macOS、Linux 的行为一致性；平台模拟不能替代真实系统运行 |

## 下游验证状态与后续门槛

以下是本次报告编写时已经取得的定向结果，不代表完整仓库 E2E 已完成：

| 验证层 | 当前状态 | 证据与范围 |
| --- | --- | --- |
| 本机共享文件契约对照 | 已执行；Chokidar 36/36，Parcel 33/36 | `comparison.json` / `comparison.log`；保留三次 Parcel FSEvents 失败 |
| 两后端下游产物 HMR | **2/2 通过** | `hmr-backends.log`；`e2e/ci/watcher-backends.hmr.test.ts` 核验 sidecar 保存发布及引用模板消失后的产物保留、恢复 |
| Chokidar 定向 headless runtime | **2/2 通过** | `headless-chokidar.log`；项目内外 WXML transform 依赖的原子替换、删除保留、重建；native / Vue 页渲染及点击 |
| Parcel 定向 headless runtime | **2/2 通过** | `headless-parcel.log`；与 Chokidar 相同的 WXML 场景 |
| 消费层独立清理回归 | **41/41 通过** | devProvider 三文件 17 项、WXML watch / dependencies 24 项；关闭独立排空并保留组合错误，同步初始化失败撤销观察者及 owner |
| 真实微信 DevTools runtime | **环境阻断，未完成验收** | 机器租约内正常退出已核验空闲宿主、确认安装进程归零；随后出现本任务未认领的新宿主，启动门禁按 `WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH` 拒绝认领。UI 复核仍为项目列表；保留该宿主，两个后端均未进入 runtime 场景 |
| Linux / Windows / macOS 三系统矩阵 | **待验证** | 已提供 `CI E2E` 的 `watcher-comparison` 定向入口，尚无本轮远端运行证据 |
| 既有 29 项依赖契约的完整三系统执行 | **待验证** | 当前适配层对照及 mock 均不替代该门槛 |

表中日志位于本次任务的 `.tmp/current-run/parcel-watcher/`。后续验证应绑定最终源码、构建产物和具体运行身份；生产源码变化后，验证负责人需确认哪些旧证据仍适用、哪些需要重跑。

在修改默认后端前，至少需要解释并修复或明确界定重复 FSEvents 溢出，补齐确定性的恢复与所有权证据，完成三系统对照，以及两后端在真实构建和真实 IDE 中使用最新输入的验收。当前适合继续维护这个内部抽象并显式试用 Parcel；默认 Chokidar 的选择保持不变。

复跑入口和参数见 [`watcherComparison/README.md`](../../packages/weapp-vite/scripts/watcherComparison/README.md)。对照、下游 HMR、headless 和 IDE 验证均应复用仓库机器级串行租约，不能与其他 E2E/dev-watch 并行。

## 文件组织审查

新增后端实现按订阅、扫描、归一化与路径映射拆分，每个模块均小于 300 行。既有 `service.ts`、`autoImport.ts` 与 `devProvider.ts` 已超过 300 行，本次保留其消费层边界，避免将无关构建阶段一起拆分；新增清理契约用独立测试文件覆盖。`testArtifact/watch.test.ts` 增长至 360 行，暂保留共用编译器 mock 和 fixture，避免拆分后出现两套生命周期测试设施。
