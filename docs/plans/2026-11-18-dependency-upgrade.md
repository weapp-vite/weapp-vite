# 全仓依赖刷新评估（2026-11-18）

本轮按用户确认覆盖自有 pnpm workspace、独立 npm 工具、Cargo 与 GitHub Actions；排除 vendored upstream、历史复现 fixture 和 vendor 子模块。交付拆为兼容依赖刷新 PR 与 Solid.js / entities 大版本迁移 PR。

## 第一批：兼容依赖刷新

接受当前 registry 稳定版本并同步 catalog、脚手架生成 catalog 与锁文件：AI SDK、devframes、TanStack Vue Query、typescript-eslint parser、Oxc parser、Vitest、esrap、Rollup、Turbo、type-fest、CSS tokenizer、npmcli config、ignore、Gridstack、Wrangler。Cargo Oxc crates 与 JS Oxc parser 同步到 0.159.0，Cargo lock 同时刷新允许范围内的传递依赖。独立 `miniprogram-ci` runner 当前 2.1.31 已是 latest；视频工具依赖由 workspace catalog 管理，当前无落后项。

GitHub Actions 的 10 组外部 action 已逐一读取 GitHub latest release 与 tag ref，现有固定 SHA 均对应 latest：checkout v7.0.1、cache v6.1.0、download-artifact v8.0.2、github-script v9.0.0、setup-node v7.1.0、upload-artifact v7.0.2、codecov v7.1.1、setup-bun v2.2.0、create-pull-request v8.1.3、pnpm/action-setup v6.1.1，因此不做无变化 pin churn。

## 暂缓工具链候选

| 依赖 | 当前 / latest | 决策依据 |
| --- | --- | --- |
| TypeScript | 6.0.3 / 7.0.2 | 现有 Volar、类型生成和 Compiler API 调用尚不兼容 7.x；近期依赖评估已有具体 API 缺失证据，先完成独立迁移评估。 |
| local-pkg | 1.2.1 / 2.0.0 | 2.0.0 官方声明引用未定义的 `Args`，strict 且 `skipLibCheck: false` 会失败；不通过放宽类型检查接受。 |
| Vite | 8.3.5 / 8.3.8 | 8.3.8 未通过 Web optimizer 关闭与临时缓存清理产品生命周期契约；现有 Vite 8.3.5 patch 与固定版本豁免不外推。 |
| Rolldown | 1.2.16 / 1.3.2 | 1.3.2 超出 Vite 8.3.8 声明的 `~1.2.18` 配套范围；不创建未经验证的 Vite/Rolldown 混合组合。 |
| Vite+ | 1.5.0 / 1.7.0 | 1.7.0 将 launcher 与 core 分为 1.7.0 / 8.3.8000；现有脚手架和 npm consumer 依赖同版本配对，strict peer consumer 在安装期拒绝候选。需单独迁移并验证双版本模型后再采用。 |

上述既有失败及版本边界来自 `docs/plans/2026-11-05-dependency-upgrade.md`、`docs/plans/2026-11-13-dependency-upgrade.md` 和 `docs/plans/2026-11-16-dependency-upgrade-follow-up-2.md`；本轮重新核实当前 registry latest。Solid.js 2 与 entities 9 留给第二 PR 做代码迁移和消费者验证。

## 验证

完成兼容刷新后记录冻结 lockfile 安装、49 个 package build tasks、Cargo test/native correctness、changeset/catalog 生成检查、类型与 lint，以及 PR 原生 CI 结果。首次 `pnpm --filter` 缺少 `run` 的误调用触发根目录 `tsc` 并报告生成 app 配置缺失，不作为产品结果；后续使用正确的 package-scoped 入口重新验证。
