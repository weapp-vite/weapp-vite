# #1133 / #1134 HMR 归因验收

入口复用 `scripts/benchmark-templates-hmr.ts`、`performanceGate/evaluate.ts` 和既有子进程 deadline/清理实现。它只验收这两个 issue 的同机 HMR 性能与阶段证据，不替代真实 Stable DevTools runtime，也不修改 #1082 的 `e7862e61dd83e3b9e356ac1e176267b31ab298af` 批准基线。

## 调用

准备两份独立、干净 checkout，各自在自身目录执行 `pnpm install --frozen-lockfile`。基线必须为 `73b76f4acde84a4ac8c25f4b816119b19704ac28`，候选必须是包含该驱动的完整提交 SHA。从候选根目录调用：

```sh
node --import tsx scripts/benchmarkTemplatesHmr/acceptance.ts --baseline <baseline-checkout> --candidate <candidate-checkout> --candidate-sha <40-character-sha> --runtime classic --output <new-report-directory>
```

`--runtime` 另一个值为 `stateful-experimental`。两种 runtime 分别在同一 runner 内完成各自的基线/候选配对；本机串行运行，不与其他 E2E、dev 或性能采集并发。CI 可以将 runtime 分到不同 runner，但不能把同一对拆到不同机器。

输出目录必须位于两个 checkout 之外，父目录已存在，目标目录尚不存在。驱动拒绝覆盖历史结果。每个 runtime job 建议保留 180 分钟硬上限并始终上传输出目录；驱动内部总 deadline 为 165 分钟、每侧 collector 最多 15 分钟、每个 checkout 的依赖构建最多 20 分钟。驱动先分别执行 `pnpm --filter weapp-vite... --filter wevu... -r run build`，不把准备阶段计入 HMR 样本。

## 固定采样契约

- SFC 输入取候选 `templates/weapp-vite-wevu-template`，覆盖 script、style、template、JSON macro 四类。
- 原生输入取候选 `e2e-apps/github-issues/fixtures/issue-1134-profile`，覆盖其显式清单中的九类，包括样式链、SCSS、Tailwind、局部 JSON、组件和路由拓扑。
- 两侧复制相同候选输入字节；依赖目录和 CLI 均来自各自 checkout，并校验 `weapp-vite`、SFC `wevu` 的实际解析位置。基线源码不作任何修改。
- collector 始终来自候选 SHA。固定 marker seed、完整输入文件 hash 清单、被编辑源码 hash、场景清单、两次 edit/restore 和输出范围，任一配对缺失或不一致均不可通过。
- 每个场景采集 20 对，每侧新建 dev 会话，同一会话保留首次 edit/restore 和连续 edit/restore。轮次交替 baseline→candidate、candidate→baseline。
- 使用既有 5% 中位数门禁。超阈值配置只执行一次等量 20 对确认，保留该输入的全部前置场景；两批都越线为 regression，确认回落为 unstable，均不通过。不提供减少样本的正式验收开关。

## Profile 能力与证据

固定历史 SHA 的 `statefulHmr` 没有 HMR profile producer。该侧通过既有 collector 的 profile 关闭选项跳过不存在事件的等待，并写入 `unavailable`、历史阶段 `unknown`；不补写历史 producer，不用 wall 时间填内部阶段。它仍保留真实 wall、输入 hash 和输出范围。经典基线与候选两条 runtime 均保留正常 15 秒 profile 等待。

候选每个 edit/restore 必须有完整归因和对应的原始 producer JSONL 记录。缺失或无效记录标为验收不完整；它不等于已证明产品行为回归。每侧归档：

- `profile.raw.jsonl`：原始数值不改动，仅脱敏路径；历史不可用时为空并附能力说明。
- `report.json`、`report.md`、collector/dev logs、失败诊断。
- `input-manifest.json` 和 collector report 内逐次 `outputChanges`。
- `profile-capability.json`：producer SHA、观测能力及依赖 manifest hash。

顶层 `report.json` 保存冻结身份、机器信息、输入清单、全部成对样本、唯一确认计划与重算门禁；`primary.json`、`confirmation.json` 每侧完成后 checkpoint。所有输出路径脱敏，临时工程由创建它的驱动清理。成功仅表示本入口性能/归因证据通过，`stableDevtoolsValidation` 始终明确记录真实 IDE 最终验收另行完成。

工具测试（不会启动 runtime）：

```sh
pnpm vitest run scripts/benchmarkTemplatesHmr/acceptance.test.ts
```
