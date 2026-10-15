# PR CI 人工批准与手动诊断

新建 PR、推送新提交和重新打开 PR 时，`PR CI` 会在 PR 的 Checks 区域出现，并等待人工批准。批准前不分配 runner，不 checkout、不安装依赖、不启动构建或测试，也没有持续轮询的报告 runner。

维护者通过批准数量，把有限的并发资源集中到当前关注的少数 PR；已批准的检查保留原有矩阵并行，不增加全局串行锁或固定活跃 PR 上限。AI 只验证用户或维护者选中的 PR，禁止为了“全部跑绿”批量批准无人关注的 PR，也不能批量启动独立手动诊断来绕过准入。

从 PR 检查详情进入这次运行，点击 **Review deployments**，选择 `pr-ci-approval`，再点击 **Approve and deploy**。这个 GitHub 按钮只放行本轮 CI，不会部署生产环境。审批人任意一位批准即可，维护者可以批准自己的运行。

批准后，CI、Policy、E2E 及适用的专项检查会按原有路径条件和系统矩阵运行；各 job 的排队、运行、成功、失败、跳过和取消直接显示在 PR 的原生检查列表中。完整 Nightly Performance 仍须单独手动启动，不随普通 PR 批准运行。

同一 PR 的新提交会取消旧运行并重新等待批准，其他 PR 不受影响。审批绑定本轮触发事件的提交；如果等待期间 PR 或基线变化，旧运行必须停止，不能悄悄切到最新提交。统一入口只冻结并上传一份 `pr-context`，普通检查使用固定的合并候选，性能和体积比较使用固定的 PR head。候选验证任务只获取只读权限，性能评论由可信主线的独立完成报告发布。

关闭 PR 会通过默认分支的 `pull_request_target: closed` 入口取消同一并发组中的旧运行；该入口全部 job 跳过，不执行候选代码、不占 runner。重新打开后需要重新批准。GitHub 取消运行和必要进程清理可能需要短暂收尾；常规检查取消后不再启动后续验证、报告或 artifact 上传，普通失败仍保留日志和产物，完整 Nightly Performance 的证据策略保持原样。

## 审批 Environment

启用入口前，在仓库 **Settings → Environments** 配置 `pr-ci-approval`：required reviewers 为 `sonofmagic` 和 `daguanren21`，允许 self review，关闭管理员绕过，不配置 secrets、等待计时器或分支限制。仅创建同名空 Environment 不会强制人工审批，必须核验 required reviewers 保护规则。当前配置任意一位指定维护者批准即可。

仓库 **Settings → Actions → General** 的 fork PR 审核策略必须为 `all_external_contributors`（所有外部贡献者均需审核），配置后通过 API 回读核验。已有贡献记录的外部账号也不能通过修改 workflow 直接启动 runner。fork PR 需要先通过 GitHub 原生 workflow 审核，再通过本轮 CI 的 Environment 审批。

## 原生运行的完成报告

只有整体成功的原生 `PR CI` 运行会自动启动性能和体积评论报告。失败、取消、拒绝和审批过期不启动自动报告 runner，结果直接查看 PR Checks。

需要为已完成的失败运行补充评论时，从默认分支显式指定运行 ID：

```bash
gh workflow run ci-performance-comment.yml --ref main -f run-id=<运行ID>
```

该入口只生成报告，不重跑验证。下载 artifact 前先核对运行来自本仓库的原生 `PR CI`、已完成、审批与冻结 job 均成功；缺少批准上下文时不发布评论。发布前继续核验冻结提交、真实子 job、分页结果及当前 PR/head/base，拒绝过期提交和旧运行覆盖新结果。自动及手动报告代码来自默认分支，入口改动需合并后再完成线上联动验收。

## 独立手动诊断与历史状态

按需单独重跑某项诊断时继续使用原来的手动入口。它与常规 PR 原生审批流程独立：

在 GitHub 的 **Actions** 页面选择对应 workflow，点击 **Run workflow**，选择 `main`，在 `pr-number` 中填写 PR 编号。原有诊断参数仍然可用。AI 或命令行使用相同入口：

```bash
gh workflow run ci.yml --ref main -f pr-number=123
gh workflow run ci-policy.yml --ref main -f pr-number=123
gh workflow run ci-e2e.yml --ref main -f pr-number=123
```

根据修改范围补充原有专项检查，如 `ci-vite-host-consumer.yml`、`native-addon-correctness.yml`、`ci-tutorial-e2e.yml`、`ci-create-weapp-vite.yml`、`ci-acceptance.yml`、`ci-acceptance-http.yml`、`ci-vscode-extension.yml`、`ci-dimina.yml`、`deploy-website.yml`、`ci-performance.yml` 和 `wevu-runtime-size.yml`。原有 PR 路径条件仍生效，无关修改会在目标解析摘要中说明并跳过对应检查。

每轮运行先解析并固定 PR 的 head/base SHA。普通检查沿用原有 PR 检查的合并候选语义：核对 GitHub 合并候选的两个父提交与固定 base/head 一致，再 checkout 该候选 SHA，构建产物也记录该提交。这样，切换前创建的 PR 也能使用主线新增的 CI 脚本；有合并冲突时先处理冲突，再手动验证。性能和运行时体积比较仍分别 checkout 固定的 PR head 与基线。

主线上的 workflow 调度 SHA 与实际被测 SHA 分别记录。通过运行摘要和 `pr-context` artifact 的 `context.json` 确认 head、base 与 checkout SHA，再核对 PR 当前提交和基线。运行期间更新 PR 或基线后，应重新触发受影响的检查，不能把旧提交的结果计为新提交通过。

独立手动诊断会把 `Manual PR / <workflow 名称>` 状态写到被测 PR 的 head 提交，GitHub 的 pulls 列表和 PR 检查区域因此能显示运行中、成功或失败，并链接到实际运行。状态在目标解析任务获得 runner 并解析 PR 后出现；解析任务尚在排队或 PR 尚未手动验证时，不显示检查状态。路径或分支条件不适用时会显示跳过说明，合并冲突等目标解析失败也会显示错误。

完成状态由可信主线报告任务依据 GitHub 的真实运行结果回写。候选代码任务没有状态写入权限；报告核对首次状态记录与冻结上下文，拒绝把旧运行覆盖到更新的一轮验证。缺少首次状态的历史运行会核对可信解析 job 日志中的 artifact ID、摘要和 checkout 身份，再下载该不可变 artifact。运行中基线变化会标记为需要重新验证；PR head 更新后，旧结果仍归属旧提交。

GitHub 的 PR API 可能保留旧 base 快照；目标解析和状态回写同时检查实际 base 分支 tip。快照落后时先更新 PR 分支或等待 GitHub 重新计算合并引用，再手动验证，不重复启动基于旧基线的重型任务。

若完成状态回写任务失败，修复后可以单独重新运行报告，无需重跑构建矩阵：

```bash
gh workflow run ci-pr-status.yml --ref main -f run-id=<运行ID>
gh workflow run ci-pr-status.yml --ref main -f pr-number=123
```

`run-id` 和 `pr-number` 二选一。按 PR 同步会扫描 PR 创建后的手动运行（最多最近 1000 条），为当前 head 补齐每个 workflow 最近一次可信运行的状态，不重新运行构建或测试。历史检查失败会显示失败；旧基线上的成功会显示需要重验。尚未运行的 workflow 不会凭空显示通过。若扫描被截断，任务输出中的 `truncated` 为 `true`，可以用 `run-id` 补同步更早的具体运行。

`pr-number` 留空时，保留各 workflow 原有的独立或全量检查模式；性能冒烟和运行时体积是 PR 专属检查，需要填写编号。PR 网站验证只构建、测试和检查部署产物，生产发布仍由主线触发。

主线定时检查、合并后的发布与网站部署继续运行。夜间性能定时任务只检查主线；需要对指定 PR 做完整性能验收时，显式运行：

```bash
gh workflow run nightly-performance.yml --ref main -f pr-number=123
```

完整性能验收保留既有固定基线、采样范围和重复采样约束。普通 PR 冒烟通过不等于完整性能验收通过。

已有的独立手动运行不会被迁移或自动取消；它们仍使用原有汇总状态。配置生效后，PR 下一次创建、更新提交或重新打开会进入原生审批流程。需要取消旧任务时，先核对具体运行 ID 和归属，不影响其他 PR、定时检查、生产发布和手动诊断。

修改触发配置、PR 上下文或报告流程后，运行 `pnpm test:pr-actions` 校验入口和提交归属合约。CI Policy 同样执行这组回归。

Native Addon Correctness 从调度 `main` 使用可信 driver，读取被测候选的 `packages/ast-native/correctness.manifest.json`。新增 native 能力时，在这份清单中一起增加实际 addon 导出、suite 及最低断言数、需要的 workspace 构建闭包；不再修改 YAML 中的测试列表。候选必须包含 driver 的基础覆盖，构建目标仅允许 `@wevu/compiler...` 和 `weapp-vite...`，用 `--force --concurrency=1` 按单个依赖图重新构建后运行全部声明的 suite。最低断言数用于拒绝部分报告，所有实际断言仍须通过且不能 skip/todo。

缺少清单的旧分支应先合并最新 `main` 并补齐自身能力的清单增量；workflow 会拒绝缺失或缩减覆盖，不自动退回旧测试集合。证据记录实际 tested commit、driver commit、原始 manifest SHA256、构建闭包和执行 suite，同时固定实际加载的候选 addon 二进制及入口的相对路径和 SHA256，前后核对不能替换文件。`binding.json` 与 `summary.json` 继续只输出可移植数据。新增专项测试使用 `pnpm exec vitest run --config scripts/vitest.config.mjs scripts/verify-native-addon-correctness.test.mjs scripts/nativeAddonCorrectness`。
