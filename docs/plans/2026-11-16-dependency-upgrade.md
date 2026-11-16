# 2026-11-16 全仓依赖升级记录

## 范围与基线

- 分支：`codex/dependency-upgrade-20261116`
- 基线：`origin/main` 的 `e2ea165035885d38ec0f5cd7bbf13828e5f49ac6`
- registry 版本冻结于本轮开始时；工作在独立 worktree 完成。
- 已刷新 `pnpm-lock.yaml`，独立 `tools/miniprogram-ci-runner/package-lock.json` 已通过 `npm ci --ignore-scripts --no-audit` 验证且无需内容变更。

## 接受的升级

- catalog：AI SDK、Devframe、Vite DevTools、ESLint/Stylelint 配置、`eslint`、`postcss`、`vue-router`、`weapp-tailwindcss`。
- 工具链：`@oxc-node/cli`/`core`、Playwright、Rollup、Repoctl、网站的 Iconify 与 Wrangler。
- 工作区包：`@json-render/core`、Glass-Easel Web Adapter 的 Playwright，以及 vite-native fixture 的 PostCSS/Tailwind CSS。
- `packages/create-weapp-vite/src/generated/catalog.ts` 与 changeset 已由仓库脚本重新生成。

## 保留与拒绝

- TypeScript 7、Vite 8.3.8、Rolldown 1.3.x、Vite+ 1.6.x、`local-pkg` 2、`debounce` 4 和历史 fixture 固定版本未升级，原因是当前 peer、构建或运行时契约尚未形成可接受的完整验证证据。
- Devframe 与 DevTools 采用成套的 `1.3.5` / `0.8.3` 版本。单独升级其中一组会留下混合 peer 图；成套解析后新增的 Devframe peer 告警消失。
- `minidev`、`cos-wx-sdk-v5`、`miniprogram-simulate` 以及独立 `miniprogram-ci` 链路的上游安全问题没有通过 override 或关闭审计掩盖，保留原依赖并记录审计结果。

## 依赖验证

- `pnpm install --frozen-lockfile --ignore-scripts`：通过。
- `npm ci --ignore-scripts --no-audit`（`tools/miniprogram-ci-runner`）：通过。
- `pnpm peers check`：仍返回仓库基线告警，包括 Vite+ 与 Vitest/Devframe 的 Vite peer、webpack/schema-utils、GraphQL、github-issues fixture 的 Vite DevTools、Mermaid/VitePress；本轮未新增 Devframe 混合版本告警。

## 安全审计（冻结 registry）

- pnpm workspace：`2905` 个依赖，`8` low、`23` moderate、`18` high、`8` critical。主要残留路径为 `minidev` 的 `got`/`request`/`tar` 链、vite-native 的 `miniprogram-simulate` PostCSS、以及 `cos-wx-sdk-v5` 的 `fast-xml-parser`；对应上游没有可用修复或属于历史 fixture 链路。
- npm runner：`1102` 个依赖，`1` low、`15` moderate、`19` high、`40` critical，共 `75` 项，主要由 `miniprogram-ci` 及其 Babel、ZIP、COS、request 链路引入；保留完整审计输出，不降低检查级别。

## 本地验证结果

- 受影响包的 `typecheck`、`test:types`、单测和 lint 均通过；根 `pnpm typecheck` 与 `pnpm lint` 通过。
- `pnpm build:pkgs`（50/50）、`pnpm build:apps`（80/80）、`pnpm build:docs`（35/35）通过。
- 依赖协议、catalog/changeset、constants range、发布 frontmatter 和依赖契约检查通过。
- Repoctl 6.6.2 升级同步了 release/bootstrap、自动 changeset、snapshot builder/publisher workflow；原生 snapshot 生成结果与固定 builder SHA 一致，Repoctl workflow 定点测试 10/10 通过。
- 完整 `pnpm test` 通过：2740 个测试文件通过、13 个跳过；26499 个测试通过、20 个跳过。
- 真实 DevTools IDE E2E 未在本轮本地重新启动；仓库 headless/runtime 覆盖已包含在完整测试中。PR CI 仍需按当前 head 完成 `pr-ci-approval` 审批并等待全部矩阵检查。

## PR 验收记录

- PR 创建后记录当前 head/base/merge SHA、审批运行编号和所有必需 checks；每次修复提交重新核对并审批 `pr-ci-approval`。
- 只有全部适用 CI/CD、审查和状态门禁通过后执行 squash merge，并在合并后确认 `origin/main` 与临时 worktree 清理结果。
