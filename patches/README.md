# 发布重试与恢复

仓库固定使用 `repoctl@5.5.7`，发布重试由上游正式实现负责，不再保留
`@icebreakers/monorepo@5.5.5` 的临时补丁。其他依赖补丁保持独立维护。

此前 [Release 35973791530](https://github.com/weapp-vite/weapp-vite/actions/runs/35973791530)
在部分上传成功后遇到 OIDC 503。pnpm 12.5.1 没有保存失败批次的部分 summary，
旧重试逻辑又将暂不可查询的版本加入上传队列，触发 npm staged 409。
上游 [#913](https://github.com/icelib/repoctl/pull/913) 已修复该问题，对应需求为
[#912](https://github.com/icelib/repoctl/issues/912)。

## 当前发布契约

- 合并 summary、候选包精确版本的成功行及 registry 查询结果，累计保存成功状态。
- 退避等待后重新查询 registry；已接受上传的版本不再进入上传队列。
- 正常上传及故障恢复均确认版本可见性，确认预算为 5 分钟，单次查询最多 10 秒。
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

本次升级仅影响仓库发布维护，不改变对外包行为，不添加 changeset，也不联动
`create-weapp-vite` 版本。
