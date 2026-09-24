# 发布重试补丁

`@icebreakers__monorepo@5.5.5.patch` 修复 Release 中部分上传成功后的重试状态丢失。
复现来源：[Release 35973791530](https://github.com/weapp-vite/weapp-vite/actions/runs/35973791530)。

pnpm 12.5.1 在递归发布中途失败时不会写入部分成功的 summary。GitHub OIDC 短暂返回 503 后，
repoctl 5.5.5 只根据即时 `npm view` 结果决定待重试包，且在退避等待之前完成查询。
npm 仍在暂存或传播元数据时，已经上传的版本会被重复提交，导致 409 并阻塞剩余发布。

补丁在发布器边界维护跨尝试的成功集合：合并 summary、候选包精确版本的 pnpm 成功行和 registry 查询结果；
每次尝试都保存清单，重试等待结束后重新查询；已确认上传的包不会再次提交。
从失败批次恢复的上传还需要通过只读查询确认可见，最多等待 100 秒，超时仍然失败并保留清单。
永久权限错误及不伴随瞬时故障的 404 仍直接失败。provenance 和质量检查保持开启。

`repoctl` 固定在 5.5.5，避免自动升级绕过精确版本补丁。升级时先核对上游
`packages/monorepo/src/commands/release/publish.ts` 是否覆盖这些语义，再移除或迁移补丁，运行：

```sh
pnpm install --frozen-lockfile
pnpm test:release
```

回归通过 `repoctl` 的公开 `publishStable` 入口执行，注入进程和等待器，不访问真实发布端点。
`test:release` 已加入 Release 的质量检查；测试不会依赖打包后的内部函数名。

恢复实际发布时，在修复提交进入目标分支后手动运行 Release 的 `publish` 模式，
继续发布当前版本并核对 npm 包、GitHub tags/releases 和 VS Code Marketplace 后置步骤。
不要为绕过暂存冲突修改包版本，也不要在旧提交上直接重跑而误认为已经应用补丁。
工作流无论成功或失败都会尝试保存 `npm-publish-summary-<run_attempt>` artifact。
其中的 `pnpm-publish-summary.json` 记录的是已上传包，最终是否可用仍需以 registry 查询为准。

此变更仅影响仓库发布维护，不修改对外包行为，因此不添加 changeset，也不联动 `create-weapp-vite` 版本。
