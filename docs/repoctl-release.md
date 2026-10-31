# repoctl 发布流程

仓库使用 repoctl 6.2.1。正式版、预发布版、npm nightly 和 OIDC 审计共用 `Release`（`release.yml`），继续使用现有 npm Trusted Publisher 绑定。PR snapshot 使用官方独立构建与发布工作流，只需要内置 GitHub token 和 npm OIDC，无须 GitHub App 或发布 PAT。

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

从默认分支手动运行 `Automatic Release Intent`，选择 PR 编号。它调用 repoctl 的公共自动 changeset 入口，策略来自默认分支的 `.github/repoctl-auto-changeset.json`，支持 `packages-runtime/*`、`mpcore/packages/*` 等实际 pnpm workspace 路径。plan 和 apply 分别等待 `pr-ci-approval`；规划使用只读权限，应用只接受同一次尝试中冻结且仍为当前的 PR、策略和审批身份，再通过原子 head 校验写入。

默认兼容修复与依赖更新使用 patch，`feat` 使用 minor；可选择单个 `release:patch`、`release:minor` 或 `release:major` 标签覆盖，`release:none` 停止自动生成记录，仍须满足仓库的发布完整性检查，不能豁免用户可见源码改动。带 `!` 的标题必须明确选择级别或手写记录，上游依赖的 major 不会自动升级本包为 major。JSON 策略使用中文 Conventional 模板生成摘要，也可接受英文 PR 标题；通用的 GitHub 读取、记录所有权、撤回删除和并发检查交由 repoctl。

合法手写 changeset 优先；人工编辑自动文件后停止接管。原代码改动撤回、补充手写记录或选择 `release:none` 后，只删除未经人工修改的受管文件。fork PR 只读，不写入提交、不发布包。此前草案中的 PR 事件自动写入已迁为上游按需入口；自动提交形成新 revision 后，仍须通过仓库原生 PR CI 重新批准和验证。

CI Policy 在既有审批后检查公开包与 changeset 的完整对应，测试或文档改动不要求空发布记录。版本准备 PR 使用公开 `validateReleasePreparation()` 结果，不能仅凭分支名跳过检查。repoctl 在隔离元数据中重放 pnpm 原生版本操作，禁用候选 scripts/pnpmfile/hooks，核对 fixed、依赖传播、预发布 lane、清单、已消费 intent、账本和 changelog。新增源码或未知 hook 输出不得通过版本准备豁免；例如脚手架 catalog 应先随主线 catalog 更新同步，不能借版本准备掩盖漂移。

## 本地 Git hooks

`prepare` 使用 `repo tooling hooks install`，`allowBuilds.lefthook: false` 避免 Lefthook 自身安装脚本抢先处理 hooksPath。安装器由 repoctl 维护，支持 linked worktree，并保护用户自定义及继承的 `core.hooksPath`。

仓库领域检查直接声明在 `lefthook.yml`；Lefthook 负责部分暂存隐藏、恢复及修复入索引。原生 `repo verify staged-typecheck` 分别执行根 tooling 与包的检查，`repo verify commit-msg` 接收 Git 实际传入的消息文件。changeset 索引语义、DOM inventory、公开 skills、小程序样式和微信项目 JSON 检查仍由仓库维护。`stage_fixed` 完成后再在 `commit-msg` 核对最终索引，检查失败时先审阅暂存区再重试。

## npm nightly

每天北京时间 06:17（UTC 22:17）运行，也可以在默认分支手动选择 `mode=nightly`。它发布全部公开 workspace 包，不能用恢复参数筛选包或换成历史来源；`dry-run=true` 只检查来源、候选版本与 registry 状态，不构建、上传或验证 consumer。

正式执行由 repoctl 原生 nightly 管线完成：

1. 冻结默认分支提交与运行身份，检查完整包计划的 OIDC 权限。
2. 执行现有质量脚本，禁用质量缓存，隔离 archive、安装、构建和打包。
3. 发布到 `snapshot-nightly`，确认 registry 可见性与完整性。
4. 使用独立 consumer 安装完整批次，验证内部依赖与消费结果。

仓库通过 pnpm 补丁修正 repoctl 6.2.1 对每条 nightly 质量命令固定 10 分钟的限制。工作流设置 `REPOCTL_NIGHTLY_QUALITY_DEADLINE_EPOCH`，全部质量脚本共享 45 分钟，每次启动只使用剩余预算；预算耗尽或时间戳无效时停止。未设置时保留上游默认值。此预算仅用于质量阶段，后续构建、上传和 consumer 保持原生独立超时，整个 job 上限仍为 90 分钟。

`ast-native` 的 `prepack` 按锁定的 Rust 工具链和 `Cargo.lock` 构建发布宿主的二进制，确保隔离源码打包不依赖本地未跟踪产物。这仅提供当前宿主的 native 模块；其他平台继续使用既有 JS fallback。

nightly 不消费 changeset，不改正式版本、changelog、发布账本或 `latest`。定时运行发现同一源码批次已经发布时会跳过。所有公开包都需要允许当前仓库 `release.yml` 的 npm Trusted Publisher；审计失败时不会开始上传，不改为长期 npm token。

安装示例：

```sh
pnpm add -D weapp-vite@snapshot-nightly
pnpm add wevu@snapshot-nightly
```

带内部 peer 依赖的组合以成功运行 Summary 中的完整批次安装命令为准。需要固定复现时使用报告中的精确 snapshot 版本，避免浮动 tag 后续更新。

运行保留 `nightly-report.json`、`snapshot-report.json`、`consumer-report.json` 与 tarball 14 天。上传确认成功但 consumer 失败时，整次运行仍失败；先检查报告，修正问题后手动运行新的 nightly。不能把定时去重后的跳过当成 consumer 已通过。

## PR snapshot

repoctl 6.2.0 已通过 [#1114](https://github.com/icelib/repoctl/pull/1114) 和 [#1116](https://github.com/icelib/repoctl/pull/1116) 提供 prepared snapshot、自动 changeset、正式 Release PR 校验和 hooks 公共入口。本仓库使用官方成对工作流 `.github/workflows/repoctl-snapshot-build.yml` 与 `.github/workflows/repoctl-snapshot-publish.yml`，固定 repoctl 6.2.1、pnpm 12.15.0，并复用 `pr-ci-approval`。

启用前，将工作流合入默认分支，并为所有公开包新增允许仓库 `weapp-vite/weapp-vite`、工作流 `repoctl-snapshot-publish.yml` 的 npm Trusted Publisher，保留 `release.yml` 的现有连接。publisher job 没有 Environment，npm 对应字段应留空；`pr-ci-approval` 保护的是 builder freeze。npm 当前允许每包最多 10 个 trusted publisher；新增配置的首次成功发布时限以 npm 页面为准。当前迁移只准备仓库配置，没有修改远端 npm 设置或执行真实发布。

从默认分支手动运行 **repoctl PR snapshot build**，填写同仓库、已打开、非草稿且可合并的 PR 编号。freeze 在审批后读取并冻结 head/base/merge、包计划和依赖闭包；候选构建在独立只读 job 中运行，没有 npm OIDC。成功后触发默认分支可信 publisher，核验审批、run/attempt、官方 builder 摘要、可信 freeze 日志、不可变 artifact 和当前 PR revision，再直接发布原 tarball。

仅 publisher 获得 OIDC，不 checkout、安装或执行候选源码；fork、过期提交和不完整产物会被拒绝。上传前完成所有包的 registry/tag/OIDC 预检，发布仅使用 `snapshot-pr-<编号>`，保持 `latest`，不消费正式 changeset、不修改版本、changelog 或发布账本。独立 consumer 从 registry 安装精确版本，核验完整性、入口和类型，报告给出准确安装命令；consumer 失败仍会使工作流失败，不能将已上传等同于完整验收。

后续升级工作流时，使用公开 `getSnapshotWorkflows()` 或 `repo release snapshot workflow` 成对生成，并核对审批环境、路径、pnpm 版本与 builder 摘要。两份官方模板保留原始字节，由限定的 ESLint YAML 规则排除保护配对摘要。不要单独格式化 builder 后沿用旧的 publisher 摘要。
