# repoctl 发布流程

正式版、预发布版、npm nightly 和 OIDC 审计共用 `Release`（`release.yml`）。这样可以继续使用各 npm 包已有的 Trusted Publisher 工作流绑定，无须新增 GitHub App 或发布 PAT。

## 正式版与预发布版

`main`、`alpha`、`beta`、`rc`、`next` 的推送继续进入六个原生阶段：plan、verify、prepare、upload、confirm、finalize。阶段共享 50 分钟预算，安装、缓存与诊断归档另计；保留现有质量脚本、版本联动、VS Code Marketplace 和 npmmirror hooks。

版本准备使用 `GITHUB_TOKEN` 创建或更新 Release PR。当前 GitHub 对该令牌产生的 `pull_request` opened、synchronize、reopened 事件会创建需要批准的运行；维护者先在 GitHub 批准自动化运行，再按仓库原有规则批准当前提交的 `pr-ci-approval` Environment。每次提交都重新核对与审批，不通过手动诊断入口绕过门禁。

手动恢复入口仍是 `Release` 的 `workflow_dispatch`：

| mode                  | 用途                                               |
| --------------------- | -------------------------------------------------- |
| `auto`                | 按当前发布状态自动选择准备或发布                    |
| `prepare`             | 准备版本与 Release PR                              |
| `publish`             | 发布已经准备的批次                                 |
| `publish-unpublished` | 恢复指定 `package`、`version`                       |
| `reconcile`           | 对账发布状态；先用 `dry-run=true` 查看计划           |
| `oidc-audit`          | 在默认分支审计所有公开包的 npm Trusted Publisher   |
| `nightly`             | 从默认分支生成并发布独立的 npm nightly              |

`source-sha` 只用于原生发布恢复支持的模式，必须指向原始发布来源；不要用它伪造版本首次准备来源或改写已准备的 changelog、ledger。`oidc-audit` 不接受 `package`、`version`、`source-sha`、`dry-run` 的组合。

finalize 成功产生真实 release completion record 后，`main` 才能触发 stable 文档部署。尚无 completion record 时保留现有线上站点，不从当前工作树补造发布记录。文档渠道与修订操作见 [文档部署说明](./website-deployment.md)。

## 自动 changeset

同仓库 PR 的 `Automatic Release Intent` 先等待 `pr-ci-approval`，随后只运行默认分支的工具，将冻结 PR 的 workspace 清单作为数据读取。默认兼容修复与依赖更新使用 patch，`feat` 使用 minor；可选择单个 `release:patch`、`release:minor` 或 `release:major` 标签覆盖。带 `!` 的标题必须明确选择级别或手写记录，上游依赖的 major 不会自动升级本包为 major。

标题须为 Conventional 格式的中文摘要，否则只提示补充。手写 changeset 优先；人工编辑自动文件后也停止接管。自动文件随 PR 的实际公开包范围更新，原代码改动全部撤回时仅删除未经人工修改的自动记录。fork PR 只提供手动指引，不写入提交、不发布包。

自动提交会形成新 revision，仍需新的 GitHub 原生运行批准和 `pr-ci-approval`。CI Policy 在既有审批后检查公开包与 changeset 的完整对应，测试或文档改动不要求空发布记录。

版本准备 PR 不能仅凭分支名跳过检查。门禁在独立的基线元数据副本中调用 repoctl 原生计划与 pnpm 版本计算，禁用所有 scripts/hooks，核对直接、fixed 和依赖传播后的清单、已消费 intent、账本与追加的 changelog。新增源码或未知 hook 输出仍需 changeset；例如脚手架 catalog 生成物应先随主线 catalog 更新同步，不能借版本准备豁免掩盖漂移。

## npm nightly

每天北京时间 06:17（UTC 22:17）运行，也可以在默认分支手动选择 `mode=nightly`。它发布全部公开 workspace 包，不能用恢复参数筛选包或换成历史来源；`dry-run=true` 只检查来源、候选版本与 registry 状态，不构建、上传或验证 consumer。

正式执行由 repoctl 原生 nightly 管线完成：

1. 冻结默认分支提交与运行身份，检查完整包计划的 OIDC 权限。
2. 执行现有质量脚本，禁用质量缓存，隔离 archive、安装、构建和打包。
3. 发布到 `snapshot-nightly`，确认 registry 可见性与完整性。
4. 使用独立 consumer 安装完整批次，验证内部依赖与消费结果。

nightly 不消费 changeset，不改正式版本、changelog、发布账本或 `latest`。定时运行发现同一源码批次已经发布时会跳过。所有公开包都需要允许当前仓库 `release.yml` 的 npm Trusted Publisher；审计失败时不会开始上传，不改为长期 npm token。

安装示例：

```sh
pnpm add -D weapp-vite@snapshot-nightly
pnpm add wevu@snapshot-nightly
```

带内部 peer 依赖的组合以成功运行 Summary 中的完整批次安装命令为准。需要固定复现时使用报告中的精确 snapshot 版本，避免浮动 tag 后续更新。

运行保留 `nightly-report.json`、`snapshot-report.json`、`consumer-report.json` 与 tarball 14 天。上传确认成功但 consumer 失败时，整次运行仍失败；先检查报告，修正问题后手动运行新的 nightly。不能把定时去重后的跳过当成 consumer 已通过。

## PR snapshot 边界

PR 候选构建必须继续保持只读权限，经原有审批后产出冻结身份的 snapshot artifact；默认分支的可信 publisher 才能取得 npm OIDC 并发布已核验 tarball，fork PR 不发布。

repoctl 6.1.0 尚未提供公开的 publish-prepared snapshot 接口，已通过 [上游 issue #1113](https://github.com/icelib/repoctl/issues/1113) 跟进。当前不能将直接 `snapshot --publish` 放入候选代码 job，也不能把重新构建的内容声称为先前审批的 artifact。PR 安装包发布须在上游提供该可信边界后接通；不要把仅构建 artifact 记录为 npm 发布成功。
