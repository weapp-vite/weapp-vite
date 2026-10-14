# 手动运行 PR Actions

创建 PR、推送提交和转为可评审状态不会自动启动 GitHub Actions。维护者按需选择现有 workflow 运行；不同 PR 可以同时验证。

在 GitHub 的 **Actions** 页面选择对应 workflow，点击 **Run workflow**，选择 `main`，在 `pr-number` 中填写 PR 编号。原有诊断参数仍然可用。AI 或命令行使用相同入口：

```bash
gh workflow run ci.yml --ref main -f pr-number=123
gh workflow run ci-policy.yml --ref main -f pr-number=123
gh workflow run ci-e2e.yml --ref main -f pr-number=123
```

根据修改范围补充原有专项检查，如 `ci-vite-host-consumer.yml`、`native-addon-correctness.yml`、`ci-tutorial-e2e.yml`、`ci-create-weapp-vite.yml`、`ci-acceptance.yml`、`ci-acceptance-http.yml`、`ci-vscode-extension.yml`、`ci-dimina.yml`、`deploy-website.yml`、`ci-performance.yml` 和 `wevu-runtime-size.yml`。原有 PR 路径条件仍生效，无关修改会在目标解析摘要中说明并跳过对应检查。

每轮运行先解析并固定 PR 的 head/base SHA。普通检查沿用原有 PR 检查的合并候选语义：核对 GitHub 合并候选的两个父提交与固定 base/head 一致，再 checkout 该候选 SHA，构建产物也记录该提交。这样，切换前创建的 PR 也能使用主线新增的 CI 脚本；有合并冲突时先处理冲突，再手动验证。性能和运行时体积比较仍分别 checkout 固定的 PR head 与基线。

主线上的 workflow 调度 SHA 与实际被测 SHA 分别记录。通过运行摘要和 `pr-context` artifact 的 `context.json` 确认 head、base 与 checkout SHA，再核对 PR 当前提交和基线。运行期间更新 PR 或基线后，应重新触发受影响的检查，不能把旧提交的结果计为新提交通过。

手动验证会把 `Manual PR / <workflow 名称>` 状态写到被测 PR 的 head 提交，GitHub 的 pulls 列表和 PR 检查区域因此能显示运行中、成功或失败，并链接到实际运行。状态在目标解析任务获得 runner 并解析 PR 后出现；解析任务尚在排队或 PR 尚未手动验证时，不显示检查状态。路径或分支条件不适用时会显示跳过说明，合并冲突等目标解析失败也会显示错误。

完成状态由可信主线报告任务依据 GitHub 的真实运行结果回写。候选代码任务没有状态写入权限；报告核对首次状态记录与冻结上下文，拒绝把旧运行覆盖到更新的一轮验证。运行中基线变化会标记为需要重新验证；PR head 更新后，旧结果仍归属旧提交。

若完成状态回写任务失败，修复后可以单独重新运行报告，无需重跑构建矩阵：

```bash
gh workflow run ci-pr-status.yml --ref main -f run-id=<运行ID>
```

此入口要求原运行已有可信的首次状态记录；切换前的历史运行不会自动补记为通过。

`pr-number` 留空时，保留各 workflow 原有的独立或全量检查模式；性能冒烟和运行时体积是 PR 专属检查，需要填写编号。PR 网站验证只构建、测试和检查部署产物，生产发布仍由主线触发。

主线定时检查、合并后的发布与网站部署继续运行。夜间性能定时任务只检查主线；需要对指定 PR 做完整性能验收时，显式运行：

```bash
gh workflow run nightly-performance.yml --ref main -f pr-number=123
```

完整性能验收保留既有固定基线、采样范围和重复采样约束。普通 PR 冒烟通过不等于完整性能验收通过。

配置切换后，已经排队或运行中的旧任务不会自动取消。需要清理时先确认具体运行 ID 和归属，单独取消相应任务，保留定时检查、生产发布与手动诊断运行。

修改触发配置、PR 上下文或报告流程后，运行 `pnpm test:pr-actions` 校验入口和提交归属合约。CI Policy 同样执行这组回归。

Native Addon Correctness 从调度 `main` 使用可信 driver，读取被测候选的 `packages/ast-native/correctness.manifest.json`。新增 native 能力时，在这份清单中一起增加实际 addon 导出、suite 及最低断言数、需要的 workspace 构建闭包；不再修改 YAML 中的测试列表。候选必须包含 driver 的基础覆盖，构建目标仅允许 `@wevu/compiler...` 和 `weapp-vite...`，用 `--force --concurrency=1` 按单个依赖图重新构建后运行全部声明的 suite。最低断言数用于拒绝部分报告，所有实际断言仍须通过且不能 skip/todo。

缺少清单的旧分支应先合并最新 `main` 并补齐自身能力的清单增量；workflow 会拒绝缺失或缩减覆盖，不自动退回旧测试集合。证据记录实际 tested commit、driver commit、原始 manifest SHA256、构建闭包和执行 suite，同时固定实际加载的候选 addon 二进制及入口的相对路径和 SHA256，前后核对不能替换文件。`binding.json` 与 `summary.json` 继续只输出可移植数据。新增专项测试使用 `pnpm exec vitest run --config scripts/vitest.config.mjs scripts/verify-native-addon-correctness.test.mjs scripts/nativeAddonCorrectness`。
