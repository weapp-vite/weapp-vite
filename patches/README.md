# 发布重试与恢复

仓库固定使用 `repoctl@5.10.0`，发布重试、工作区根包识别和发布说明过滤均由上游正式实现负责。
`@icebreakers/monorepo@5.10.0` 的受管补丁修正发布说明分类：明确的 Conventional 摘要类型
优先于整理提交类型及正文关键词，并保留正文中的依赖版本描述；原生 Dependencies 条目仍归维护。
同一分类规则用于 Release PR、正式发布和发布说明修复，避免合并 intent 后功能、修复和性能被改归维护。
补丁同时修正 Release PR 更新：查询已限定 head/base，现有 PR 只更新变化的标题和正文，
不重复提交相同 base；内容未变时不发送 PATCH，避免无意义的 PR 更新。
升级 repoctl 时须核对上游是否已覆盖这两类规则，并运行
`scripts/repoctl-release-classification.test.ts` 和 `scripts/repoctl-github-pull-request.test.ts`。
其他依赖补丁保持独立维护。

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

## Chokidar 5 监听生命周期

`chokidar@5.0.0.patch` 修正目录删除重建期间的注册、扫描和文件订阅归属：

- 目录先取得原生 watcher 并登记 closer，再提交 tracking 和扫描；Windows 的同步
  `watch EPERM` 仅在报错路径严格匹配且 `lstat` 确认路径已消失时，进入既有缺失路径处理。
- 异步目录扫描与文件 stat 绑定各自的订阅身份；旧订阅的迟到结果不能移除或重绑同路径的新文件。
- 关闭时只取消本 owner 持有的扫描、节流与文件订阅，回收已销毁的 readdirp stream；
  新条目成功登记后只解除捕获的旧删除节流，避免第二次删除永久漏报。
- 文件 ADD 回调同步关闭或取消监听时，回收尚未登记的本订阅；inode 重绑复用同一个
  文件 owner closer，在同一共享容器内更换原生句柄，保留其他 owner 的订阅与 closer。
- 公开监听路径在初始化期间消失时，先登记父目录 fallback 的就绪槽，再结算原路径；
  `ready` 只有在父目录原生监听器生效后发布，递归扫描子项仍由其扫描完成就绪结算。
- polling 间隔或持久性升级保留同一共享容器，只精确替换本库的原生 listener；旧代通知、
  重复关闭和任一 owner 退出不能取消幸存 owner、独立原生 listener 或另一项目的监听。升级取得失败时，
  先恢复既有 owner 的原订阅并抛出原错误；恢复也失败时同时保留两项错误。

`weapp-vite` 将修补后的 Chokidar 与 `readdirp@5.1.1` 打包到 JavaScript 产物，
使消费发布包时也使用该实现；类型声明继续引用依赖的公开类型。完整 MIT 许可证随包保存在
`packages/weapp-vite/THIRD_PARTY_NOTICES.md`。

更新或移除补丁前运行依赖合同，并在目标 Windows、macOS、Linux 环境分别保留报告：

```sh
node --import tsx scripts/dependencyContracts/chokidar/run.mjs --report .tmp/dependency-contracts/chokidar.json
```

合同覆盖真实文件事件、注册失败、删除重建、迟到 stat、共享 watcher、polling、POSIX inode 重绑
和同步 teardown；Windows 的 inode 项明确记为不适用。macOS 上模拟 Windows 错误分类的结果
只证明分类分支，不代表真实 Windows 已通过；跨平台通过情况以对应环境的报告为准。
发布前还须验证打包产物实际包含补丁实现，并通过下游 dev/HMR 回归。

发布消费合同通过普通 npm 安装实际 tarball，从 `weapp-vite/test` 与 `weapp-vite/vite`
两个公开入口验证同路径的原生 acquisition、幸存 owner 的输出和末个 owner 的真实 close。
执行方式及独立原始 tarball 反例见[发布消费合同说明](../packages/weapp-vite/scripts/chokidarDelivery/README.md)：

```sh
node --import tsx e2e/scripts/run-e2e-commands.ts node --import tsx packages/weapp-vite/scripts/chokidarDelivery/index.mjs --report .tmp/chokidar-delivery.json
```

Windows 正恢复及原始 tarball 变红必须由真实 Windows 验证；其他宿主不伪装平台，
不适用项及未传原始归档而未执行的反例分别保留状态，不能计为通过。

只有上游发布版本覆盖上述生命周期合同，且移除补丁后的跨平台合同和发布产物回归均通过时，
才可移除补丁与配套打包策略，并同步检查第三方软件声明。补丁涉及的上游发行文件原本超过
300 行；保留发行结构能让差分直接对应上游，便于审查和升级，因此不为本地补丁拆分模块。


## Vite 内置 polling 副本

`vite@8.3.4.patch` 同步修正其发行文件内置 Chokidar 的 polling listener 归属与升级失败恢复。
`scripts/dependencyContracts/vite/polling.mjs` 通过真实 Vite server 验证两个 owner、独立原生 listener、
两种关闭顺序及精确释放，不依赖内置 helper 的局部名称。

这份仓库补丁不会自动进入普通 npm 消费者的外部 Vite。产品宿主重启先等待旧编译会话和精确旧 watcher
完整关闭，再进入 Vite 的新配置准备；发布消费合同使用未打补丁的 npm Vite 独立验证这一交接约束。
不能把本机依赖合同通过视为用户已安装补丁。
