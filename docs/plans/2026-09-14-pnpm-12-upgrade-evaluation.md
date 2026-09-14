# pnpm 12.4.1 升级评估

## 结论

当前仓库使用 `pnpm@11.25.0`，npm registry 最新稳定版为 `12.4.1`（2026-09-10）。建议升级，但应作为一次主版本迁移单独验证后落地。Node 约束（22.18+、24.11+ 或 26+）满足 pnpm 12 的 `node >=18` 要求。

## 已验证事实

- `pnpm-lock.yaml` 当前为 lockfile v9。
- 直接运行 `corepack pnpm@12.4.1 install --frozen-lockfile --offline` 会在安装前失败：Corepack 传入 pnpm 12 后，pnpm 读取根目录 `packageManager: pnpm@11.25.0` 并报 `ERR_PNPM_BAD_PM_VERSION`。因此升级必须先同步 `packageManager`，不能只替换 CI action 或命令行版本。
- 仓库没有 `pnpmfile.cjs`，workspace catalog 位于 `pnpm-workspace.yaml`，未发现其他版本声明文件。
- `pnpm/action-setup` 使用 v6，默认会读取根 `packageManager`；同步根字段后，现有复合 action 可继续工作。
- 显式固定 pnpm 11 的入口包括：`website/guide/debug.md`、`e2e/tutorials/contracts.test.ts`、`packages/create-weapp-vite/test/createWeappViteSmoke.test.ts`、`scripts/create-weapp-vite-smoke.mjs`，以及 `ci-create-weapp-vite.yml` 中的 smoke 命令。

## 影响与风险

1. **版本契约**：将根 `packageManager` 改为 `pnpm@12.4.1`，否则 Corepack/ pnpm 12 会拒绝执行。
2. **锁文件**：pnpm 12 可能重写 v9 锁文件；升级实施时应在干净工作树运行 lockfile-only，审查 diff 规模后再提交。
3. **Smoke 测试语义**：当前 pnpm smoke 使用大版本别名 `pnpm@11`。若目标是验证仓库默认版本，应改为 `pnpm@12`；若仍需兼容 pnpm 11，应保留独立的兼容性场景，避免与默认路径混淆。
4. **文档**：开发指南和综合 demo README 中的 pnpm 11 要求应同步为 pnpm 12（或改为读取项目 `packageManager` 的通用表述）。
5. **CI 缓存与跨平台**：锁文件变化会影响 actions/setup-node 的 pnpm 缓存键；升级后需跑 Linux、Windows、macOS 的安装和包级构建矩阵。

## 建议的实施顺序

1. 修改根 `packageManager` 与显式默认 smoke/documentation 入口。
2. 使用 pnpm 12.4.1 生成并审查锁文件，再运行冻结安装。
3. 执行 `weapp-vite`、`create-weapp-vite` 的包级 typecheck、单测和构建，随后运行 create smoke。
4. 验证 CI workflow 及 Windows pnpm 启动包装逻辑；必要时保留 pnpm 11 兼容性 smoke。
5. 通过验证后提交 changeset（该升级会改变开发/构建工具链行为，属于用户可感知的工程基线变化）。

## 当前阻塞项

本次评估未在临时副本完成 `lockfile-only`：仓库依赖规模较大，pnpm 12 解析在本机超过数分钟无输出后终止。实施升级时应在 CI 或具备完整 registry/cache 的环境重跑该步骤。
