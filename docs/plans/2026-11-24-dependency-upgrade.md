# 全仓依赖升级评估（2026-11-24）

本轮覆盖 pnpm workspace、`@weapp-vite/ast-native` 的 Cargo 依赖、脚手架生成目录和 repoctl snapshot 工作流。依赖按当前 registry 稳定版本和现有兼容边界处理，未修改 `e2e/vendor/` 中的既有未跟踪内容。

## 已升级

- 根 `packageManager` 与生成的 template corpus 项目同步到 `pnpm@12.23.0`。
- workspace catalog 与 `packages/create-weapp-vite/src/generated/catalog.ts` 的 `oxc-parser` 从 `0.159.0` 升级到 `0.160.0`。
- Rust Oxc crates 从 `0.159.0` 升级到 `0.160.0`，并将 `napi`、`napi-derive`、`napi-build` 分别更新到 `3.16.3`、`3.7.2`、`2.7.0`。`Cargo.lock` 同步刷新传递依赖。
- repoctl snapshot 工作流继续固定 `repoctl@6.6.3`，安装工具使用 pnpm 12.23.0，并由原生生成器更新 builder 摘要 SHA256。

## Oxc 0.160 迁移

Oxc 0.160 移除了 `ObjectProperty.computed`，同时将静态字符串键枚举改为 `PropertyKey::StaticStringLiteral`。native compiler analysis 现在通过 `PropertyKey` 判断静态键，计算表达式键继续走现有回退路径，并保留 onPageScroll、reserved props 和 component analysis 的行为边界。

## 暂缓

- TypeScript 7、Vite 8.3.8、Rolldown 1.3.x、Vite+ 1.7.x 和 `local-pkg` 2 仍需要独立兼容性迁移或已有产品生命周期验证，继续保留当前版本。
- Devframe 大版本升级需要成套 peer 依赖和 `@devframes/json-render` 对齐，留作独立迁移。

## 安全审计

生产依赖仍有 2 个 moderate advisory，均来自 `create-weapp-vite` 的 `cacache -> glob/minimatch` 链。修复要求跨越父依赖声明的 major 范围，本轮不通过无依据 override 掩盖。独立 `tools/miniprogram-ci-runner` 的 `miniprogram-ci@2.1.31` 已是当前 latest，其上游审计结果保持原记录。

## 验证

- `pnpm outdated -r --format json --no-optional`：所有 workspace 包均为 up-to-date。
- `pnpm install --frozen-lockfile --ignore-scripts`：通过。
- `pnpm build:pkgs`：50/50 tasks 通过。
- `pnpm test:types`：88/88 tasks 通过。
- `cargo check --manifest-path packages/ast-native/Cargo.toml --locked`：通过。
- `cargo test --manifest-path packages/ast-native/Cargo.toml --locked`：20 项通过。
- `pnpm --filter @weapp-vite/ast-native native:lint`：通过。
- `pnpm --filter @weapp-vite/ast-native native:test`：9 个测试文件、183 项通过。
- repoctl snapshot workflow 与原生生成器逐字节一致，builder SHA256 与 workflow 环境一致。
