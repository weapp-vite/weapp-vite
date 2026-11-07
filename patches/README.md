# 依赖补丁与发布维护

当前 `patchedDependencies` 登记三份补丁：

| 依赖 | 用途 | 发布交付范围 |
| --- | --- | --- |
| `chokidar@6.0.0` | 修正文件监听的异步提交、目录恢复和资源关闭边界 | `weapp-vite` 通过 `alwaysBundle` 将修补代码打入 `dist`，普通 npm 消费者也使用该实现 |
| `@vitejs/plugin-vue@6.0.10` | 向 Oxc 转换补传当前 Vite 配置和 watcher | 仓库 Web UI、文档及相关测试的开发和构建，不修补消费者安装的 Vue 插件 |
| `@icebreakers/monorepo@6.4.0` | 修复六阶段 source recovery 的执行目录和包管理器目录复用 | 仓库发布工具，不进入小程序运行时产物 |

工作区的 pnpm 补丁登记不会随 npm 依赖安装自动传播；已打入发布产物的修改代码会交付给消费者。
当前使用官方 Vite `8.3.5` 和 Rolldown `1.2.16`，不再维护它们的补丁。Vite+ `1.5.0` launcher/core
使用其配对发行的内置 Vite `8.3.5` / Rolldown `1.2.16`，Vitest 为 `5.1.0`；
内置引擎与工作区独立依赖仍须分别核对实际解析入口和版本。

## 发布重试与恢复

仓库固定使用 `repoctl@6.4.0`，发布重试、工作区根包识别和发布说明过滤均由上游正式实现负责。
`@icebreakers/monorepo@6.1.0` 的上游实现包含发布说明分类修正：明确的 Conventional 摘要类型
优先于整理提交类型及正文关键词，并保留正文中的依赖版本描述；原生 Dependencies 条目仍归维护。
同一分类规则用于 Release PR、正式发布和发布说明修复，避免合并 intent 后功能、修复和性能被改归维护。
上游同时修正 Release PR 更新：查询已限定 head/base，现有 PR 只更新变化的标题和正文，
不重复提交相同 base；内容未变时不发送 PATCH，避免无意义的 PR 更新。
升级 repoctl 时须核对上游是否已覆盖这两类规则，并运行
`scripts/repoctl-release-classification.test.ts` 和 `scripts/repoctl-github-pull-request.test.ts`。
其他依赖补丁保持独立维护。

`@icebreakers/monorepo@6.3.1` 已正式支持消费者 `runtimeContexts`、真实 Vitest setup、精确的平台保护错误
和本批次必需 peer 的候选 locator；本仓库不再维护这些功能的重复补丁。上游还验证运行合同指向实际打包的
ESM 文件，并在执行框架或导入 guard 前确认消费者解析结果。

上游 [#1127](https://github.com/icelib/repoctl/issues/1127) 与
[#1128](https://github.com/icelib/repoctl/pull/1128) 已将本仓库剩余的 nightly 共享预算和 artifact pins
吸收到正式实现。质量脚本与 verify hooks 使用质量专用命令入口，读取
`REPOCTL_NIGHTLY_QUALITY_DEADLINE_EPOCH`，每条命令派发前重新计算剩余预算；存在该标记时，
共享剩余预算替换单命令的默认或显式超时。标记必须是非空纯十进制数字，表示正的 epoch 秒，
换算后的毫秒须为安全整数；无效或过期时立即失败，不再派发命令。未设置时保留显式
`qualityTimeoutMs`，没有显式配置则使用默认 45 分钟。后续构建、上传和 consumer 继续使用各自的独立超时。

官方 snapshot build、snapshot publish 和自动 intent 模板的 9 处 artifact action pins
（分别为 3、4、2 处）已同步为 `upload-artifact@v7.0.2`、`download-artifact@v8.0.2` 的固定 SHA。
生成器继续计算完整 builder 的 SHA256，`scripts/repoctl-snapshot-workflow.test.ts`
保留生成模板与仓库工作流的全文精确比较；snapshot 工作流必须成对生成并保留原始字节。

正式发布包消费验证及发布回归通过后，本仓库已删除整份
`@icebreakers__monorepo@6.3.1.patch`、对应 `patchedDependencies` 和锁文件补丁登记，
不再维护这两类重复实现。当前保留的补丁见上表。升级时继续运行
`scripts/repoctl-nightly-deadline.test.ts`、`scripts/repoctl-consumer-context.test.ts`
和 `scripts/repoctl-snapshot-workflow.test.ts`，并完成 `pnpm test:release`；
不能以每命令的新超时配置替代共享截止时间，也不能因移除补丁而删除公共行为回归。

`@icebreakers/monorepo@6.4.0` 的 source recovery 会在六个阶段中重复准备同一包管理器目录。
补丁让该目录的 `mkdir` 使用 `recursive: true`，避免 plan 成功后 verify 遇到 `EEXIST`。
TypeScript 不记录 `.git` 下的目录符号链接，恢复 checkout 原先放在 Git 元数据内，导致 pnpm
依赖的声明生成报 `TS2883`。补丁保留 `.git` 中的阶段记录，将执行目录迁至系统临时目录，
按仓库 Git 路径、原 source、运行及 attempt 派生固定路径供六个阶段复用；拒绝文件或符号链接
替换恢复目录。只有 finalize 的输出和阶段记录全部成功后才清理本轮目录，失败保留以便诊断。
源码身份、原始版本提交、质量检查、确认、hook 和发布完成记录仍由上游原生六阶段流程负责，
并由 `scripts/repoctl-release-source-recovery.test.ts` 的真实文件系统回归覆盖。升级时须先确认
上游能完整执行同一 source 的六阶段恢复，再移除补丁。发行文件超过 300 行，保留原结构
使补丁能直接对应上游函数，不拆分上游 bundle。

Release job 使用固定 Git bot 环境身份创建 annotated tag，不修改 runner 的全局 Git 配置。
历史 Marketplace hook 结果不明时仍拒绝继续；只有核验线上精确版本并补齐指向原发布提交的
扩展 tag 后，才能在 source recovery 中显式选择 `acknowledge-marketplace-hook`。
该输入只确认已完成的 Marketplace hook，不确认其他 hook，也不跳过质量、registry 确认或完成记录。

历史源码的质量检查可能只识别 `timeout` / `gtimeout`，而新 Ubuntu runner 将 GNU 实现命名为
`gnutimeout`。Release job 通过现有解析器核验 GNU 实现，在任务临时目录提供同名 `timeout`
入口并追加到本轮 `GITHUB_PATH`，同时记录实际路径和版本。此适配保留历史源码与全部断言，
不修改系统命令；找不到 GNU 实现时仍在发布前失败。

官方 Vite/Rolldown 的产品适配、内部诊断和资源验收边界见[编译依赖内存说明](./compiler-memory.md)。

此前 [Release 35973791530](https://github.com/weapp-vite/weapp-vite/actions/runs/35973791530)
在部分上传成功后遇到 OIDC 503。pnpm 12.5.1 没有保存失败批次的部分 summary，
旧重试逻辑又将暂不可查询的版本加入上传队列，触发 npm staged 409。
上游 [#913](https://github.com/icelib/repoctl/pull/913) 已修复该问题，对应需求为
[#912](https://github.com/icelib/repoctl/issues/912)。

## 当前发布契约

- 合并 summary、候选包精确版本的成功行及 registry 查询结果，累计保存成功状态。
- 退避等待后重新查询 registry；已接受上传的版本不再进入上传队列。
- 正常上传及故障恢复均确认版本可见性，确认预算为 15 分钟，单次查询最多 10 秒。
- 可见性确认超时、永久权限错误及不伴随瞬时故障的 404 仍明确失败。
- GitHub tags/releases 与发布后置 hooks 仅在确认成功后执行；provenance 与质量检查保持开启。

回归通过公开 `publishStable` 和 `releaseCi` 入口执行，注入进程和等待器，
不访问真实发布端点。`test:release` 继续作为发布质量门禁；后续升级前运行：

```sh
pnpm install --frozen-lockfile
pnpm test:release
```

## 诊断与恢复

Release 无论成功或失败均尝试保存 `npm-publish-summary-<run_attempt>` artifact，包含：

- `pnpm-publish-summary.json`：累计已接受上传的包，不代表都已可查询。
- `repoctl-publish-progress.json`：候选包、已接受上传、已确认可见及当前执行状态。

诊断文件用于核对与恢复依据；新一轮发布不会盲信旧文件，最终可用性以 registry 查询为准。
本地运行生成的这两个文件已加入 Git 忽略列表。

需要恢复实际发布时，在修复进入目标分支后手动运行 Release 的 `publish` 模式，
继续发布当前版本并核对 npm 包、GitHub tags/releases 和 VS Code Marketplace 后置步骤。
此前失败批次已上传的包可能不在新一轮 summary 中，应另行核对并通过 repoctl 的
`reconcile` 接口补齐缺失的 GitHub 发布记录。
不要为绕过暂存冲突修改包版本，也不要在旧提交上重跑而误认为已使用新版实现。

上述发布工具升级仅影响仓库发布维护，不改变对外包行为，不添加 changeset，也不联动
`create-weapp-vite` 版本。

## Chokidar 6 监听生命周期

`chokidar@6.0.0.patch` 对发行版的异步提交边界作局部修正：

- 同步目录注册的 Windows `EPERM/watch` 仅在路径严格等价、大小写一致，且 `lstat` 确认已消失时进入缺失路径恢复。Windows extended namespace 与普通路径可等价匹配；其他错误保留原 Error。
- native reconciliation、目录扫描和异步子项添加捕获原 `TreeState.DirEntry` 身份，原目录已删除或重建后不再提交旧结果。unwatch/add 的 root 代同样约束成功及失败读取。
- 延迟返回的缺失结果在提交删除前再次确认目标仍然缺失；目标已重建时复用成功 stat 继续正常协调，避免旧 ENOENT 移除另一个 owner 已观察的新 inode。
- `readdirp` 的扫描根 `warn(ENOENT)` 复用本轮目录缺失确认，并在异步确认后复核原目录身份；子项 warning、权限错误、缺少路径以及仍存在的根目录不能触发根清理，原 warning 仍供监听者读取。
- 目录自身注册失败时，释放先前为它取得的 root-parent closer；不泄漏半完成的订阅。
- macOS 目录监听拓扑变化后，在同一恢复批次协调仍存活的 owner；初扫、恢复和关闭各自保留归属，旧拓扑代不能提交结果，迟到的重复观察不重复发布文件变化。

Chokidar 6 的原生文件由父目录资源协调，删除使用 tree membership，polling 使用共享 scheduler 与异步 stat。这些流程由上游负责，不沿用 v5 的文件句柄重绑、remove throttle 或 StatWatcher 修补。新旧版的共同公开契约继续由仓库 29 场景验证，观测机制说明见[依赖契约](../scripts/dependencyContracts/chokidar/README.md)。

`packages/weapp-vite/tsdown.config.ts` 通过 `alwaysBundle: ['chokidar', 'readdirp']` 将修补后的 Chokidar 与 `readdirp@5.1.1` 打包到 JavaScript 产物，消费发布包时使用相同实现；类型声明继续引用公开依赖类型。完整 MIT 许可证随包保存在 `packages/weapp-vite/THIRD_PARTY_NOTICES.md`。

更新或移除补丁前，在目标 Windows、macOS、Linux 环境保留依赖契约报告：

```sh
node --import tsx scripts/dependencyContracts/chokidar/run.mjs --report .tmp/dependency-contracts/chokidar.json
```

macOS 上模拟 Windows 分类只证明该分支，不能代替真实 Windows。发布前还须确认打包产物包含修补实现，并通过下游 dev/HMR 回归。发布消费合同通过普通 npm 安装实际 tarball，从 `weapp-vite/test` 与 `weapp-vite/vite` 两个公开入口验证监听、幸存 owner 和精确关闭：

```sh
node --import tsx e2e/scripts/run-e2e-commands.ts node --import tsx packages/weapp-vite/scripts/chokidarDelivery/index.mjs --report .tmp/chokidar-delivery.json
```

执行细节见[发布消费合同说明](../packages/weapp-vite/scripts/chokidarDelivery/README.md)。Windows 正恢复及原始 tarball 反例必须由真实 Windows 执行；不适用或未运行的反例保留各自状态。

只有上游发布版本覆盖上述生命周期合同，且移除补丁后的跨平台合同和发布产物回归均通过时，
才可移除补丁与配套打包策略，并同步检查第三方软件声明。补丁涉及的上游发行文件原本超过
300 行；保留发行结构能让差分直接对应上游，便于审查和升级，因此不为本地补丁拆分模块。

## 官方 Vite/Rolldown 与产品监听

当前没有 Vite 或 Rolldown 补丁文件、`patchedDependencies` 登记或锁文件补丁绑定。
自有插件钩子容器、package imports 兼容及会话释放由 `weapp-vite` 自身代码负责；这不表示上游
全部引用生命周期问题已修复。

产品自有开发宿主通过公开 Chokidar API 持有监听资源，按本代 owner 处理初扫、动态注册、事件交付和关闭，
并保留显式使用 Vite 原生后端的配置路径。启动与重启等待相应后端或现存源码的登记屏障；
关闭先解除登记等待，再等待编译任务与本代资源收尾，防止退出反向等待自身的初扫。
登记完成只证明该观察面，首个保存是否交付仍须实际文件编辑和产物验证。

PR #1294 按用户授权接受 Web optimizer 关闭残留与连续构建资源增长两项验收例外；两项均未修复。
例外对固定官方 Vite `8.3.5` / Rolldown `1.2.16` 持续适用至显式移除，不在合并后自动结束，
版本不符时必需入口失败并要求重新评审或移除；Vite+ 使用独立打包的引擎，仍须单独验证，
不能因其报告相同版本就自动继承工作区的验收记录。
Web 扫描期间关闭或重启可能留下临时缓存；同一 Node 进程连续构建可能持续保留旧代编译引用、增加内存。
现有实测不证明增长线性、所有增长同因或 Vite+ 有相同资源表现；风险与证据边界见
[编译依赖内存说明](./compiler-memory.md)。

`pnpm test:dependency-contracts` 的 Vite 必需清单固定为 `hooks`、`resolver`、`mini-optimizer`、
`polling`、`ready` 五项，Rolldown 七项及 Chokidar 完整契约保留，不接受任意筛选或跳过参数。
Vite 报告保留六项 `fullInventory`、`waived` 和未执行的 `web-optimizer`，适用项通过时明确标记
`assessment: accepted-with-waivers`，不称为完整六项产品通过。
`pnpm diagnose:vite-product-lifecycle` 继续运行原六项公开产品契约；原始内部断言保留在
`pnpm diagnose:dependency-internals`。两种诊断失败仍非零退出并保留证据，没有吞错或降低断言。
正式资源验收不再作为当前候选的发布必需项，但手动 workflow、原 `32/16 MiB` 门限及失败断言不变。
其他 CI、coverage、审查和真实 IDE 门禁不因这两项例外被豁免，各项仍分别记录实际结果。

## Vitest 模块缓存的文本读取

Vitest `5.1.0` 的官方 ServerModuleRunner 已以 UTF-8 读取磁盘缓存代码，覆盖此前
`vitest@5.0.5.patch` 的修正，因此本仓库已删除该补丁及其登记。旧版默认读取返回 Buffer，
错误格式化路径随后把它当作字符串调用 `charCodeAt`，掩盖 global setup 的原始错误。
`e2e/scripts/domAcceptanceReport/reporter.startup.test.ts` 继续显式开启磁盘模块缓存，
通过冷、暖两轮验证原始失败和验收报告，不以关闭缓存绕过问题。

## Vue 插件的 Oxc 上下文

`@vitejs/plugin-vue@6.0.10.patch` 为 `transformWithOxc` 补传 `devServer.config` 和 `devServer.watcher`，
让 Vue 中的 TypeScript 转换使用当前 Vite 配置及其监听上下文，避免遗漏显式 tsconfig 后转而扫描无关项目引用。
仓库 Web 构建的既有 tsconfig guard 继续保留；补丁不作为 `weapp-vite` 对外 Vue 编译器的运行时依赖交付。
