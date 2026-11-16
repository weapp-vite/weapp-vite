# 2026-11-16 依赖升级 follow-up 记录

本记录承接当前 `main` 工作区的依赖升级暂存变更，补充历史升级记录中尚未接受的版本决策与验证证据。历史计划保留原文；本记录只描述本轮实际采用的版本，不回写历史结论。

## 接受的版本与依据

| 依赖 | 采用版本 | 接受依据 |
| --- | --- | --- |
| `debounce` | `^4.0.0` | 4.x 要求 Node `>=22.2`，仓库 engines 已覆盖该范围；GitHub issues fixture 构建通过，默认导入的运行时 smoke 通过。 |
| `type-fest` | `^6.0.0` | 6.x 要求 Node `>=22`；根 typecheck 通过，未发现当前类型使用面的回归。 |
| `@oxc-project/types` | `^0.159.0` | 与 `@weapp-vite/ast` 的 parser 类型使用同步；包级 typecheck、`test:types`、单测（114 项）和 lint 均通过。 |
| `rollup` | `^4.68.4` | 冻结安装、根 typecheck 及相关构建契约通过；保留现有声明范围，不引入额外 peer 变化。 |
| Remotion | `4.0.544` | `@weapp-vite/promo-video` 的 typecheck 与 lint 通过，四个 Remotion 包保持同版本。 |
| `wrangler` | `^4.163.0` | 官网构建通过，现有 Wrangler 使用面未出现类型或构建回归。 |
| `weapp-tailwindcss` | `5.7.5` | catalog 校验通过，Tailwind fixture 构建通过；catalog 与生成文件保持同步。 |
| pnpm | `12.21.0` | `pnpm install --frozen-lockfile --ignore-scripts` 通过；Repoctl snapshot 工作流由原生生成器成对导出，3 项契约测试全部通过。 |

这些版本的接受范围只针对本轮验证过的仓库消费面。历史 fixture、计划文档和 issue 记录中的旧 pnpm 版本继续保留为历史证据。

## 同步内容

- `.github/workflows/repoctl-snapshot-build.yml` 与 `.github/workflows/repoctl-snapshot-publish.yml` 使用 Repoctl 原生生成器按 pnpm `12.21.0` 重导出。
- publisher 的 `SNAPSHOT_BUILDER_SHA256` 随完整 builder 字节更新为生成器计算值。
- Repoctl 发布文档与 Skills 文档中的当前 pnpm 引用同步到 `12.21.0`。
- 现有两份自动生成 changeset、锁文件、catalog、官网和视频工具改动保持不变。

## 本轮验证

- frozen install、根 typecheck、`@weapp-vite/ast` typecheck / `test:types` / 单测 / lint 通过。
- 视频工具 typecheck / lint、官网构建、GitHub issues fixture 和 Tailwind fixture 构建通过。
- catalog、changeset frontmatter、发布依赖协议、Rolldown 单版本和 npm 包元数据检查通过。
- Repoctl snapshot workflow 契约测试 3/3 通过，生成文件与 native generator 输出字节一致。
