# Linux native HMR 事件诊断

原 Linux 正式性能首轮和唯一 confirmation 的脚本回退分别为 27.5204% 和 28.1585%，结论保持不变。已有静态审计没有建立唯一因果关系；旧 Linux 安装树和实际 native binary 未保留，不能声称复原原运行环境。本轮仅收集一次新安装上的 native 事件观察面，帮助决定下一步是否有依据修改生产代码。

## 固定输入与边界

- `hmr-native-event-diagnostic.yml` 提供 `workflow_dispatch` 和 `workflow_call`，仅通过手动入口启动。调度者必须提供完整 controller SHA，且与所选 workflow ref 和 tools checkout 完全相同。独立 concurrency 不取消 PR CI，也不自动触发新的性能验收。
- 新 workflow 尚未在默认分支注册、直接 dispatch 返回 404 时，使用已注册的 `auto-import-hmr-diagnostic.yml`：选择诊断分支 ref，显式传 `diagnostic=native-event` 和完整 `controller-sha`。该 wrapper 的原必填 `candidate-sha` 继续保留，调度时同样传 controller SHA；native job 只向 reusable workflow 传 `controller-sha`，实际 candidate 仍固定为下述历史提交。省略 `diagnostic` 或选择默认 `auto-import-restore` 时，完整保留原 restore 诊断；两种 job 互斥，controller SHA 缺失或不符在采集前失败。正式 `hmr-attribution-acceptance.yml` 不参与本入口。
- 单个 `ubuntu-24.04` job、Node `24.18.0`，无 matrix。baseline 固定为 `73b76f4acde84a4ac8c25f4b816119b19704ac28`，candidate/collector 固定为 `4dede68ef91956a0af36223856f7cbed1f7f8d25`。两侧分别使用自己的原 lockfile 安装；tools 只提供 controller 源码，不参与依赖构建。
- driver 从 candidate 动态加载原 `acceptanceContract.ts`、`acceptanceRunner.ts` 和机器 lease。先调用原 `rebuildAcceptanceCheckouts`，随后按 baseline → candidate 串行调用原 `collectAcceptanceRun`，仅使用 `HMR_INPUTS[0]`、round `0`、batch `primary`，每侧一次。
- 保留原四种场景及实际 JSON → template → script → style 顺序，每场景两次 edit/restore，共每侧 16 次 mutation。保持 marker seed、完整输入 manifest、mutation/restore hash、输出 scope、baseline profile off/candidate on、poll 120ms、settle 300ms、预算 500ms、场景 30s、首次构建 120s、每侧 15min、每份依赖构建 20min、总 deadline 165min 和 job 180min。
- 不调用正式 acceptance driver、20-pair 门禁或 confirmation；不重新编译 native，不改 collector、生产代码、正式报告、批准 baseline、预算或原断言。报告固定为 `kind: diagnostic`、`performanceVerdict: false`；`diagnostic-complete` 只表示本次诊断证据完整。

## Trace 与时钟

仅启用 release binary 支持的 `RD_LOG_OUTPUT=readable` 和 `RD_LOG=notify_debouncer_full=trace,rolldown_dev::bundle_coordinator=trace,rolldown_dev::bundling_task=trace`。不使用 `notify::poll=trace` 的周期扫描日志，不切换 json/chrome-json，不新增 JS wrapper、Inspector profiler/sampler 或实际 dev 进程 sampler；原 collector 的 GC/内存 Inspector 观察保持不变。

原 CLI 所有 stdout/stderr 通过原 collector 保存到完整 `.dev.log`，不是错误信息中的 recent-output 尾部。原脱敏器保留时间数值和相对路径结构；原日志保留 ANSI，仅对副本移除 ANSI 后检查观察面存在。两版 readable subscriber 均使用 `.with_target(false)`，因此检查原稳定消息：`raw event:`、coordinator 的 `received message` 且 payload 为 `WatchEvent`、`scheduling new build task`，以及 task 的 `starts to run.`、`starts to generate HMR updates`、`completed generating HMR updates`。这些消息存在不证明每次 mutation 的关联或次数；日志未提供稳定唯一 task ID 时，任务关联为 unknown。本轮不实现事件分配或延迟计算，后续只能比较同一 Rust wall-clock 区间，不能与 JS `performance.now`、wallMs 或 producer profile 相减。Trace 开销没有量化，保存的 wall/profile 数值只作诊断，不作为通过门禁。

记录实际 Node、OS、CPU、Git、原 lockfile hash，以及两侧独立短 Node probe 实际加载的 native package、binary bytes 和 SHA256。运行限定 Linux x64，probe 必须唯一加载 `@rolldown/binding-linux-x64-gnu`，baseline 为 `1.2.12`、candidate 为 `1.2.13`。该字段只叫 `same-install-loader-probe`，不是被测 dev 进程的 `.node` 映射，不能证明历史安装树或原 binary 被复原。

## 资源与证据

从准备阶段到两侧采集持有同一个根机器 lease。原 `acceptanceCollectorEnv` 会剥离 `WEAPP_VITE_*`，本轮不修改原 env 传播规则；根 lease 保持同机互斥，collector 继续使用自己的原进程所有权清理。

一侧必须成功返回、无 `error`/`stop`/`retainedInput`，并有原 post-stop 完整 report/devLog、无 cleanup failure artifact、完整恢复 hash、16 个唯一预期 sample ID，才记录原 collector 的资源终结。不能仅凭 samples 数量推定结束，两侧还须完整逐 ID 核对 mutation/restore hash。任何错误或 cleanup 未确认都立即停止下一侧，保存首错、原 stop 与 partial 证据。资源终结证据缺失时保留 lease，不进行全局清理；完整终结后显式 release，并用本次私有 owner 身份读回其缺席。合法的新 owner 保留，报告只记录 `anotherOwnerPresent`，不上传 owner 凭证或删除新 owner。Hosted runner 销毁不补写为原 collector 清理通过。

Artifact 只上传诊断报告目录，保留 90 天，并在任何采集结果后保存完整或 partial 的 manifest、report、profile JSONL、collector/dev log 和失败诊断。外层 driver 输出先重定向到文件，不把尚未完整脱敏的 stdout 同步到 CI console。上传前始终用固定 candidate 的完整 sanitizer 再处理外层 `driver.log`；处理失败时删除该未脱敏日志并记录缺失原因，只有脱敏步骤确认安全后才上传，禁止上传原始失败输出。不上传 checkout、全环境、原始 argv、lease 凭证或本机绝对路径。报告以 artifact 内相对路径定位原始采集结果。正式性能回退和 Stable DevTools 未完成的最终验收继续独立保留。
