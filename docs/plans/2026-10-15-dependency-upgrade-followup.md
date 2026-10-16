# 2026-10-15 依赖兼容升级增量记录

本记录对应 `HEAD` 之后的依赖增量，目标是 registry 在 2026-10-15 的稳定 `latest`，并保留 TypeScript `6.0.3`。`packages-private/dimina-playground/upstream`、CI action 和已有历史升级记录保持不变。

## 已升级

- AI SDK：`@ai-sdk/anthropic` 4.0.79 → 4.0.80、`@ai-sdk/openai` 4.0.93 → 4.0.94、`@ai-sdk/openai-compatible` 3.0.68 → 3.0.69，`ai` 7.0.140 → 7.0.141。
- TanStack Vue Query：5.104.2 → 5.104.3，同步 `apps/wevu-runtime-demo` 和 `e2e-apps/request-clients-real`。
- Bundler：`rollup` 4.64.6 → 4.64.7；Rolldown 继续保持单版本 1.2.14。
- Tailwind：`weapp-tailwindcss` 5.6.2 → 5.6.3，`@weapp-tailwindcss/engine` 0.1.5 → 0.1.6；同步默认/fixed catalog、生成 catalog 和 vite-native fixture。
- VS Code 扩展：移除弃用的 `@types/adm-zip` stub，改为带自有类型的 `adm-zip` `^0.6.1`。
- Rust：刷新 `packages/ast-native/Cargo.lock` 的兼容传递依赖：`syn` 3.0.6 → 3.0.9、`smallvec` 1.16.2 → 1.16.3、`unicode-ident` 1.0.26 → 1.0.27；Oxc 直接依赖版本族未改变。

`pnpm-lock.yaml` 与上述清单同步，独立 `tools/miniprogram-ci-runner` 的 `npm outdated --json` 返回空对象，因此保持当前锁定版本。

## 兼容性保留

- `p-queue` 保持 `^9.3.5`。10.x 将队列事件接口从 EventEmitter `.on/.emit` 改为 EventTarget `addEventListener/dispatchEvent`，而现有 RuntimeState/BuildService 公共声明和调用契约暴露并使用 EventEmitter 语义；升级会造成类型和运行时 API 断裂。
- `pixelmatch` 保持 `^7.2.0`。8.x 改用 OKLab/HyAB 差异计算，现有截图比较的 threshold、差异像素和基线语义会改变，需要重新生成并审核全部图像基线后再迁移。
- `@vitejs/devtools` 与 `@vitejs/devtools-kit` 保持 0.7.6；Vite 8.3.4 的公开 peer 范围要求 0.7.x。
- TypeScript 及所有直接 TypeScript 声明保持原版本，尤其是 catalog 中的 6.0.3。

## 验证结果

- `pnpm install --frozen-lockfile`、catalog、workspace protocol、changeset、Tailwind catalog 和 Rolldown 单版本检查通过。
- `weapp-vite` build/typecheck/test:types/lint 通过；全量单测 756 个文件、6628 项通过，12 个文件跳过。
- Tailwind build/typecheck/test/test:types/lint 通过；VS Code 扩展 build/typecheck/test/lint 通过（24 文件、194 项测试）。
- IDE CLI build/typecheck/test 通过（82 文件、1102 项测试）；该包没有 lint script。Agent CLI 14 项测试、Agent providers typecheck/5 项测试及 lint 通过。
- Vite/Rolldown dependency contracts 全部通过：Vite 16 项、Rolldown hooks/escaped/closing/failures/failFast/retention/watching/scanning 8 组。
- `pnpm build:pkgs` 45/45、`pnpm build:apps` 76/76、`pnpm build:templates` 43/43 成功。
- `cargo +1.99.0 fmt --check`、`cargo +1.99.0 check --locked`、`cargo +1.99.0 test --locked` 通过，Rust 单测 17 项。
- `pnpm audit` 仍报告 5 low、18 moderate、17 high、7 critical；独立 runner `npm audit` 为 1 low、27 moderate、17 high、41 critical，均未新增升级范围内的审计豁免。

## 交付

新增中文 changeset：`.changeset/dependency-upgrade-20261015-225048.md`。本增量仅修改依赖声明、catalog、锁文件、生成 catalog、fixture、Cargo.lock 和发布记录，最终提交使用 Conventional Commit，默认不推送。
