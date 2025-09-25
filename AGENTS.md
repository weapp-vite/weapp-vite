# 仓库协作指南

## 项目结构与模块组织
- 采用 pnpm/turbo 管理的 Monorepo。关键目录：
  - `packages/` —— 核心模块：`weapp-vite`（构建工具）、`weapp-ide-cli`（微信开发者工具封装）、`plugin-vue`、`rolldown-require`、`vite-plugin-performance`、`@weapp-core/*`。
  - `apps/` —— 示例/演示应用（CI 可选）。
  - `website/` —— 文档站点。
  - `e2e/` —— 端到端测试与 Vitest 配置。
  - `scripts/` —— 仓库维护工具脚本。

## 构建、测试与开发命令
- `pnpm dev` —— 通过 turbo 运行各包的开发任务（支持处为 watch 模式）。
- `pnpm build` —— 构建所有包（不包含 `apps/*` 与 `website`）。
- `pnpm build:pkgs` / `pnpm build:apps` / `pnpm build:docs` —— 定向构建。
- `pnpm test` —— 运行单元测试并统计覆盖率（`vitest run`）。
- `pnpm e2e` —— 运行端到端测试（`e2e/vitest.e2e.config.ts`）。
- `pnpm lint` —— 在整个 monorepo 中执行 Lint 任务。
- `pnpm publish-packages` —— 构建、版本管理（changesets）并发布。

环境要求：Node >= 20，已安装 pnpm（通过 `preinstall` 强制）。

## 代码风格与命名约定
- 语言：优先 TypeScript；默认使用 ESM 模块。
- 格式化/Lint：`eslint`（配置：`@icebreakers/eslint-config`）、`stylelint`、`prettier`、`lint-staged` + `husky` 提交前检查。
- 缩进：2 空格；包名使用 kebab-case，变量/函数使用 camelCase，类名使用 PascalCase。
- 注释应少而精；倾向于小而聚焦的模块。

## 测试规范
- 框架：`vitest`（+ `@vitest/coverage-v8`）。
- 单元测试与源码同目录或置于 `tests/`；端到端测试放在 `e2e/`。
- 命名：`*.test.ts` 或 `*.spec.ts`（例如：`packages/weapp-vite/src/foo.test.ts`）。
- 本地运行：`pnpm test`（单元）、`pnpm e2e`（E2E）。目标是在 CI 中保持覆盖率为绿色。

## 提交与 Pull Request 规范
- 提交信息：遵循 Conventional Commits（由 `commitlint` 强制）。示例：
  - `feat(weapp-vite): add css preprocess support`
  - `fix(weapp-ide-cli): handle preview path on Windows`
- PR 要求：写明目的、范围（受影响的包）、关联 issue，以及 UI/开发者工具行为变更的前后对比说明或截图。确保 `pnpm build && pnpm test && pnpm lint` 全部通过。

## 安全与配置提示
- 对于 `weapp-ide-cli`，在使用 `weapp open/preview/upload` 前，请先在微信开发者工具中开启“服务端口”。
- 不要提交任何密钥或 AppID；优先使用被版本控制忽略的环境变量文件。
