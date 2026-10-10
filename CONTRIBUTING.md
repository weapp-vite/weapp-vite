# Contributing

## 开发环境

仓库源码构建使用 `tsdown@0.23.0`，需要 Node.js `^22.18.0 || ^24.11.0 || >=26.0.0`。

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

## Release CI

GitHub Release workflow 使用 `repoctl@5.10.0` 的原生六阶段：`plan → verify → prepare → upload → confirm → finalize`。`plan` 判定需要执行时才进入验证和准备，`prepare` 判定需要发布时才进入上传、确认和收尾。任一阶段失败都会阻断后续发布阶段；质量脚本及版本、发布 hooks 仍由 `repoctl.config.ts` 管理。同一轮 `verify` 的有效回执可供 `prepare` 使用，不能复用上一轮运行的验证结果。

job 上限为 60 分钟；六阶段从 `plan` 前开始共享 50 分钟截止时间，每阶段只使用剩余预算。Ubuntu 的 GNU timeout 在截止前发送 TERM，并将 5 秒强制回收宽限计入共享预算；监督进程保持存活到 KILL，避免主命令先退出时遗留忽略 TERM 的后代。`GITHUB_TOKEN` 和 `VSCE_PAT` 只设在六阶段各自的 `step.env`，checkout 的 Git 推送凭据沿用相同发布令牌来源。

Actions 恢复和保存 `.turbo/cache`，身份包含实际操作系统、架构、Node、pnpm 与锁文件。保存沿用恢复时冻结的 key，避免版本准备修改锁文件后漂移；只有受信任发布分支的成功运行可写入，缓存失败不会阻断发布。Turbo 只复用 build/lint 结果，单测、typecheck 和类型契约检查不缓存，仍按本轮质量流程执行；独立包的 `test:types` 保留先构建再检查的入口。

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
