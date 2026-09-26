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
