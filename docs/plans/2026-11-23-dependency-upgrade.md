# 全仓依赖刷新评估（2026-11-23）

本轮覆盖自有 pnpm workspace、独立 npm runner、Cargo 依赖和 GitHub Actions，排除 vendored upstream、历史复现 fixture 与 vendor 子模块。依赖版本按兼容稳定版优先处理。

## 已升级

- catalog 与直接依赖同步了 Babel 8.1.3、Vue 3.5.46、AI SDK、JSON render、Remotion、Rollup、Turbo、TypeScript 工具链、Stylelint、Autoprefixer、Wrangler、Solid.js、Tailwind Merge、Hono、CAC、Inquirer 等 patch/minor 版本。
- `packages/create-weapp-vite`、网站、Dashboard、Volar、weapp-vite、Solid benchmark 与 promo-video 的直接声明和 `pnpm-lock.yaml` 已同步。
- `monaco-editor` 子树通过 pnpm override 固定 `dompurify@3.4.17`，覆盖生产审计报告中的已修复版本要求。
- 独立 `tools/miniprogram-ci-runner` 的 `miniprogram-ci@2.1.31` 已是 latest。Cargo 直接依赖仍为当前 registry latest。GitHub Actions 当前固定 SHA 与最新稳定标签一致，不做无变化 churn。

## 暂缓

- TypeScript 7、Vite 8.3.8、Rolldown 1.3.x、Vite+ 1.7.x 和 `local-pkg` 2 继续保留现有版本，已有 Volar、编译器 API、Vite/Rolldown 生命周期及严格 consumer 兼容证据尚未满足迁移条件。
- Devframe 1.4.x 需要成套 peer 升级并引入 `@devframes/json-render` 对齐，留作独立迁移。
- `@npmcli/config` 链中的 `glob@13` 与 `minimatch@10` 修复要求跨 major，当前父依赖范围无法安全覆盖，保留审计记录。

## 初始审计基线

- 生产依赖审计报告 5 low、2 moderate，主要为 Dashboard 的 DOMPurify 和 create-weapp-vite 的 glob/minimatch 链。
- 开发依赖审计仍包含历史 `minidev`、`cos-wx-sdk-v5`、`miniprogram-simulate` 与独立 runner 的上游链问题。本轮不通过关闭审计或无依据 override 掩盖这些上游限制。

## 验证结果

- `pnpm install --frozen-lockfile --ignore-scripts`、`pnpm build:pkgs`、workspace lint、tooling typecheck 与全仓测试通过。
- Dashboard 的 typecheck、ESLint、Stylelint 和 production build 通过，46 个 publishable package metadata 检查通过。
- catalog、changeset frontmatter、publishable workspace protocol、Tailwind catalog 与 Rolldown 单版本检查通过。
- `cargo check --locked` 通过。独立 runner 安装并确认 `miniprogram-ci@2.1.31`。
- 生产审计剩余 2 个 moderate advisory，均来自 `create-weapp-vite` 的 `cacache -> glob@13 -> minimatch@10` 链。独立 runner 的 75 条 advisory 来自 `miniprogram-ci` 上游旧依赖，自动修复只提出降级 `@jimp/custom`，因此未应用。
