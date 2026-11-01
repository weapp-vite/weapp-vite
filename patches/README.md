# 发布重试与恢复

仓库固定使用 `repoctl@6.3.1`，发布重试、工作区根包识别和发布说明过滤均由上游正式实现负责。
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

对应补丁保留 `REPOCTL_NIGHTLY_QUALITY_DEADLINE_EPOCH` 的共享剩余预算：每条命令启动前重新检查，
预算失效时禁止派发；未设置时保留上游 `qualityTimeoutMs` 配置和默认 45 分钟的质量检查超时。
非质量命令继续使用上游各自的超时。升级时同时运行 `scripts/repoctl-nightly-deadline.test.ts`
和 `scripts/repoctl-consumer-context.test.ts`，不能以每命令的新超时配置替代共享截止时间。

官方工作流生成器尚未开放 Actions 版本配置，补丁同步更新 snapshot build/publish 和自动 intent 模板的
`upload-artifact@v7.0.2`、`download-artifact@v8.0.2` 固定 SHA。生成器继续计算完整 builder 的 SHA256，
`scripts/repoctl-snapshot-workflow.test.ts` 保留生成模板与仓库工作流的全文精确比较。

Vite 与 Rolldown 的构建引用生命周期补丁见[编译依赖内存说明](./compiler-memory.md)。

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

Chokidar 6 的原生文件由父目录资源协调，删除使用 tree membership，polling 使用共享 scheduler 与异步 stat。这些流程由上游负责，不沿用 v5 的文件句柄重绑、remove throttle 或 StatWatcher 修补。新旧版的共同公开契约继续由仓库 29 场景验证，观测机制说明见[依赖契约](../scripts/dependencyContracts/chokidar/README.md)。

`weapp-vite` 将修补后的 Chokidar 与 `readdirp@5.1.1` 打包到 JavaScript 产物，消费发布包时使用相同实现；类型声明继续引用公开依赖类型。完整 MIT 许可证随包保存在 `packages/weapp-vite/THIRD_PARTY_NOTICES.md`。

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


## Vite 内置 polling 副本

`vite@8.3.5.patch` 同步修正其发行文件内置 Chokidar 的 polling listener 归属与升级失败恢复。
`scripts/dependencyContracts/vite/polling.mjs` 通过真实 Vite server 验证两个 owner、独立原生 listener、
两种关闭顺序及精确释放，不依赖内置 helper 的局部名称。

这份仓库补丁不会自动进入普通 npm 消费者的外部 Vite。产品宿主重启先等待旧编译会话和精确旧 watcher
完整关闭，再进入 Vite 的新配置准备；发布消费合同使用未打补丁的 npm Vite 独立验证这一交接约束。
不能把本机依赖合同通过视为用户已安装补丁。

## Vitest 模块缓存的文本读取

`vitest@5.0.5.patch` 让 ServerModuleRunner 以 UTF-8 读取磁盘缓存代码。上游默认读取返回 Buffer，
错误格式化路径随后把它当作字符串调用 `charCodeAt`，掩盖 global setup 的原始错误。
补丁只补充文本编码，保留缓存行为；`e2e/scripts/domAcceptanceReport/reporter.startup.test.ts`
继续通过缓存路径验证原始失败和验收报告，不以关闭缓存绕过问题。
