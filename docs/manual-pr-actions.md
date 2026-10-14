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

主线上的 workflow 调度 SHA 与实际被测 SHA 分别记录。通过运行摘要和 `pr-context` artifact 的 `context.json` 确认 head、base 与 checkout SHA，再核对 PR 当前提交和基线。运行期间更新 PR 或基线后，应重新触发受影响的检查，不能把旧提交的结果计为新提交通过。手动运行的检查出现在 Actions 页面，不依赖 PR 页面自动收集的检查列表。

`pr-number` 留空时，保留各 workflow 原有的独立或全量检查模式；性能冒烟和运行时体积是 PR 专属检查，需要填写编号。PR 网站验证只构建、测试和检查部署产物，生产发布仍由主线触发。

主线定时检查、合并后的发布与网站部署继续运行。夜间性能定时任务只检查主线；需要对指定 PR 做完整性能验收时，显式运行：

```bash
gh workflow run nightly-performance.yml --ref main -f pr-number=123
```

完整性能验收保留既有固定基线、采样范围和重复采样约束。普通 PR 冒烟通过不等于完整性能验收通过。

配置切换后，已经排队或运行中的旧任务不会自动取消。需要清理时先确认具体运行 ID 和归属，单独取消相应任务，保留定时检查、生产发布与手动诊断运行。

修改触发配置、PR 上下文或报告流程后，运行 `pnpm test:pr-actions` 校验入口和提交归属合约。CI Policy 同样执行这组回归。
