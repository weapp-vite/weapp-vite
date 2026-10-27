# Contributing

## 开发环境

仓库源码构建使用 `tsdown@0.23.2`，需要 Node.js `^22.23.4 || ^24.22.1 || >=26.12.1`。
本地开发使用 `.node-version` 固定的 Node.js 24.22.1 LTS 和 `packageManager` 固定的 pnpm 12.15.0。

## PR 合并

所有 PR（包括发布和依赖升级 PR）统一使用 Squash merge，在目标分支形成一个提交。仓库仅允许 Squash merge；PR 内可保留开发过程中的多个提交，合并提交信息沿用仓库当前默认设置。

通过 GitHub CLI 合并时显式指定 `--squash`：

```bash
gh pr merge <编号> --squash
```

## PR 验证

本地 `pnpm verify --mode quick` 检查当前工作区，包含暂存、未暂存及未跟踪文件。Git `pre-push` 使用原生引用输入执行 `verify:push`，按实际待推 SHA 和远端旧 SHA 选择 quick 检查；新分支使用主线共同祖先，基线对象缺失时保守扩大范围。存在未提交改动或推送其他提交时，在独立工作树中按候选锁文件安装依赖后验证，不借用当前工作区的依赖链接或改动。

quick 运行本地静态检查、适用配置与生成契约、直接变更和相邻单测、包级源码类型检查；缺少可证明直接相关的存续单测时，将完整包测试明确留给 review / CI。`test:pure` 也遵守相同筛选，不因工具或 E2E 文件变更启动整包测试或 runtime suite。review 保留完整包测试、消费者、公开类型及受管 E2E 入口，CI 继续承担全部适用矩阵与汇总。

根贡献指南、README、许可证和代理约定运行适用的静态检查；生成的 `AGENTS.md` 及其规则输入继续运行 `agents:check`，public skill 合约文件与规则输入继续运行 `skills:check`。包文档、显式构建输入、锁文件、全局配置及未知输入保留各自验证归属。删除和重命名仍检查受影响路径，不按新文件名忽略原有影响。

同一候选提交、比较基线、工具链、环境和验证策略的推送重试，可以复用本地全部适用 quick 任务成功的精确回执。回执不替代 CI、公开类型、消费者或 runtime 验收。每轮 PR 提交仍须通过原生 CI 审批，完成本轮全部适用检查及其后置汇总；本地 quick 的 `partial` 表示仍有后续验收，不能宣称 PR 已完成验证。不要使用 `--no-verify` 或通用跳过开关作为提速方式。

## 依赖升级

工作区依赖升级统一使用：

```bash
pnpm deps:up
```

该命令会完成依赖更新、锁文件整理、catalog/模板同步和 changeset 生成。普通安装只恢复依赖，不会改写受 Git 跟踪的 manifest 或生成 catalog：

```bash
pnpm i
```

如果直接执行 `pnpm up` 后看到 catalog 同步提示，请改用 `pnpm deps:up` 或显式运行 `pnpm run catalog:sync:workspace`。

## 发布变更说明

每份 `.changeset/*.md` 只记录一个变更类别，frontmatter 保留受影响包的真实名称及所需 bump。正文首个非空行必须使用 Conventional 类型并包含中文摘要，例如 `feat(vite): 增加标准插件入口`、`fix(runtime): 修复首次挂载`、`perf(compiler): 减少重复分析` 或 `chore(deps): 更新构建依赖`；允许 scope 和破坏性标记 `!`，也支持 `docs`、`refactor`、`test`、`build`、`ci`、`style`、`revert`。后续段落保留具体行为、边界及迁移说明。

整理待发布 intent 时按主题与类别合并，功能、修复、性能和维护分别记录；保留每项原有的包归属，同一包合并后使用最高 bump。明确的正文类型是 Release 分类依据，优先于整理提交的类型与正文关键字，避免一次 `chore` 整理提交把功能、修复或性能说明改归维护。自动 catalog 和依赖升级记录使用 `chore(deps)`。提交前运行 `pnpm check:changeset:frontmatter` 检查首行格式与包名。

## Release CI

GitHub Release workflow 使用 `repoctl@5.10.2` 的原生六阶段：`plan → verify → prepare → upload → confirm → finalize`。`plan` 判定需要执行时才进入验证和准备，`prepare` 判定需要发布时才进入上传、确认和收尾。任一阶段失败都会阻断后续发布阶段；质量脚本及版本、发布 hooks 仍由 `repoctl.config.ts` 管理。同一轮 `verify` 的有效回执可供 `prepare` 使用，不能复用上一轮运行的验证结果。

job 上限为 60 分钟；六阶段从 `plan` 前开始共享 50 分钟截止时间，每阶段只使用剩余预算。Ubuntu 的 GNU timeout 在截止前发送 TERM，并将 5 秒强制回收宽限计入共享预算；监督进程保持存活到 KILL，避免主命令先退出时遗留忽略 TERM 的后代。`GITHUB_TOKEN` 和 `VSCE_PAT` 只设在六阶段各自的 `step.env`，checkout 的 Git 推送凭据沿用相同发布令牌来源。

Actions 恢复和保存 `.turbo/cache`，身份包含实际操作系统、架构、Node、pnpm 与锁文件。保存沿用恢复时冻结的 key，避免版本准备修改锁文件后漂移；只有受信任发布分支的成功运行可写入，缓存失败不会阻断发布。Turbo 只复用 build/lint 结果，单测、typecheck 和类型契约检查不缓存，仍按本轮质量流程执行；独立包的 `test:types` 保留先构建再检查的入口。

根类型入口同时覆盖 library 包和 `e2e-apps/lib-mode` 的产物类型契约。lib-mode 每轮重新生成八组类型 fixture 后运行 TSD；它显式等待 `weapp-vite` 与 `wevu` 的构建及类型检查，不复用旧 fixture，也不额外触发 Dashboard 构建。

工作流始终尝试归档 `pnpm-publish-summary.json`、`repoctl-publish-progress.json`、`repoctl-release-progress.json` 和 `repoctl-ci-progress.json`，保留 14 天，缺失文件忽略。排查失败时先查看对应阶段和这些进度报告；恢复单包发布继续使用 `repo release ci --mode publish-unpublished --package <name> --version <version>`，不跳过质量门禁。

## 增量与完整处理等价校验

使用上述 Node.js 版本；源码包变更后先构建受影响包及其依赖：

```bash
pnpm exec turbo run build --filter=weapp-vite... --filter=@wevu/compiler...
pnpm verify:edit-sequence --engine compiler
pnpm verify:edit-sequence --engine editor
pnpm verify:edit-sequence --engine classic
pnpm verify:edit-sequence --engine stateful-experimental
```

同一序列的每一步分别经过持续增量会话和完整处理。compiler 与构建引擎的完整基线使用新进程；editor 使用新的真实 SFC 解析会话。classic 与 native 分别比较自己的完整基线，不互相比对。

校验保留诊断、源码位置、依赖关系、发布文件集合和运行语义；非 JS 产物逐字节比较。native 的 JS 比较初始产物应用真实 HMR 更新后的模块与运行状态，不把更新片段当成完整 bundle，也不删掉差异字段来获得通过。构建序列还检查 `emptyOutDir: false` 不破坏已有用户文件。

出现差异时命令退出码为 1，输出首个失败步骤、文件、字段及最短失败前缀 `replay`。将该 `replay` 对象保存为 JSON 后可重复执行：

```bash
pnpm verify:edit-sequence --engine compiler --replay sequence.json
```

回放须使用原来的引擎。JSON 包含 `name`、初始 `files` 和 `steps`；动作支持 `write`、`edit`、`delete`、`rename`、`config`、`rapid`。路径限于临时工程内的相对 POSIX 路径。序列有步骤、文件、字节数及超时上限；只运行可信回放，因为构建模式会执行生成的 JS。工具报告真实差异，不自动修复被检查的实现。

CI 回归使用真实编译器和引擎，包含错误恢复、外部文件、无内容变化的保存及跨构建边界的快速保存：

```bash
pnpm vitest run -c e2e/vitest.e2e.ci.config.ts e2e/ci/edit-sequence.test.ts
```

## 原生 watch 测试的首轮边界

验证首轮完成后的普通依赖更新时，生产 watch 测试应先等待原生 watcher 的首轮 `END` 事件。产物已经可读不代表监听已就绪：声明等输出阶段发现的依赖，要在写出之后才完成原生监听注册。

只对首轮初始化建立完成屏障，不用固定延时或重试保存代替事件同步。后续连续保存、错误恢复和构建中保存的测试仍须保留原有触发时机与产物断言，不能为消除超时而逐轮等待或放宽结果。

验证首轮发布期间的保存时，应通过受控 `writeBundle` 屏障确认已经进入发布窗口，再修改依赖并放行；不能在放行前等待该轮 `END`，否则构成循环等待。进入屏障的等待应有超时和失败诊断，清理时必须先在 `finally` 中释放屏障，再关闭 watcher，避免关闭操作掩盖原始失败。

## CI 报告上传范围

报告上传测试应在隔离目录中验证工作流 glob 实际选中的报告与排除的无关文件，包括隐藏报告和临时敏感文件；不要复制工作流的完整路径清单作为断言，使新增合法报告也触发失败。

## Git 索引锁

提交时报 `.git/index.lock` 时，先检查是否仍有 Git 进程：

```bash
pnpm git:index-lock:doctor
```

只有确认没有活动 Git 进程且锁文件已超过安全时间阈值后，才使用：

```bash
pnpm git:index-lock:clean
```

工具不会自动删除活动中的索引锁。
