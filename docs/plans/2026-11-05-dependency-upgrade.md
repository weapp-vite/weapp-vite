# 全仓依赖升级与迁移记录（2026-11-05）

本轮仍在实施，尚未完成最终验收，不标记依赖升级完成。本文记录本轮冻结目标、兼容边界、已完成的本地验证和待验收项；上一轮的构建、测试、性能或 CI 结果不能作为本轮通过证据。

基线为 main 的 `ca23b3824537df8842f26406527106afcf0ce648`。npm 查询覆盖 270 份已跟踪清单、286 个外部包名，候选版本冻结于 2026-11-05 18:11:48–18:11:56（Asia/Shanghai），来源为官方 npm registry 的 latest 元数据。冻结清单包含逐文件声明、当前锁定版本、目标版本、查询时间和保留原因。最初 59 个 npm 升级候选中，独立 Vite 8.3.6 因生命周期诊断失败暂缓，接受 58 个升级目标；安装和后续验证使用经该决策收敛后的输入。

## 范围与保留项

本轮覆盖自有 workspace 包、应用、模板、网站、mpcore、扩展、脚手架夹具、独立小程序 CI runner、Rust 依赖及 GitHub Actions。保留精确版本、`^`、`~`、catalog 的声明形式，公开 peer 范围不因测试工具升级而抬高下限。传递依赖在父依赖允许的范围内刷新，不为清零审计告警强推不兼容版本。

| 保留项 | 当前版本 | 已查询的稳定版 | 原因 |
| --- | --- | --- | --- |
| TypeScript | 6.0.3 | 7.0.2 | 用户明确要求保留；现有历史 TypeScript 夹具与声明一起保持 |
| Stylelint | 17.16.0 | 18.0.0 | 当前配置链中的 stylelint-plugin-tailwindcss 3.1.5 只接受 17.16 兼容线，standard-scss 17 与 recommended-scss 17 只接受 Stylelint 17；recess-order 的最新版本仍不接受 18，暂缓整条配置链迁移 |
| 自有直接 local-pkg | 1.2.1 | 2.0.0 | 官方 2.0.0 tarball 的声明文件引用未声明的 Args；使用 TypeScript 6.0.3、strict 与 skipLibCheck:false 检查原文出现两项 TS2304，等待上游修复 |
| Vite | 8.3.5 | 8.3.6 | 六项产品生命周期诊断在 web-optimizer 失败：立即关闭、等待请求空闲后关闭均留下 deps_temp 临时缓存；保留 8.3.5，现有固定版本豁免不延伸到新版本 |
| VitePress | 2.0.0-alpha.20 | 1.6.4 | 保留已采用的预发布兼容基线；本轮不切回旧稳定主线或追新 alpha |
| vite-tsconfig-paths | 7.0.0-alpha.3 | 6.1.1 | 保留移除 tsconfck 的现有兼容基线，避免重新引入 TypeScript 5 专属 peer |

Stylelint 18 的 Node engines 已被本仓支持范围覆盖，暂缓原因是配置插件的兼容声明。local-pkg 2 的现用运行时 API 仍在，暂缓原因是公开类型缺陷；不通过开启 skipLibCheck 掩盖。

local-pkg 的保留决策针对自有直接依赖，最终锁中仍有 @vitejs/devtools、@vitejs/devtools-kit 0.8.2 传递引入的 2.0.0。该传递声明未暴露到当前产品消费契约，本轮公开类型检查与包级 typecheck 已通过；这项结果只覆盖当前消费边界，不表示 local-pkg 2.0.0 自身的声明缺陷已修复，也不能将最终锁描述为只含 1.2.1。

历史与外部输入继续保持：`fixtures/ts-base` 的旧版小程序类型声明、VS Code 宿主 smoke fixture 的 vite-plus 1.2.0、第三方 Dimina upstream、历史性能环境和已有报告。现行脚手架原生 fixture 的 Tailwind 声明随本轮更新。glass-easel 及 adapter 的公开 peer 下限继续保留，ignore 已锁定 latest 7.0.14，均不计入升级目标。

## 冻结的 npm 直接版本

“当前”取升级范围内的锁定版本；排除项中的历史版本不并入该列。目标列是本轮冻结的稳定版本，实际声明继续沿用原有前缀或 catalog 引用。

| 依赖 | 当前版本 | 目标稳定版 |
| --- | --- | --- |
| @ai-sdk/anthropic | 4.0.94 | 4.0.97 |
| @ai-sdk/openai | 4.0.106 | 4.0.109 |
| @ai-sdk/openai-compatible | 3.0.82 | 3.0.85 |
| @babel/core | 8.0.10 | 8.1.0 |
| @babel/generator | 8.0.10 | 8.1.0 |
| @babel/parser | 8.0.10 | 8.1.0 |
| @babel/traverse | 8.0.10 | 8.1.0 |
| @babel/types | 8.0.10 | 8.1.0 |
| @devframes/agentic | 1.3.0 | 1.3.2 |
| @devframes/hub | 1.3.0 | 1.3.2 |
| @devframes/hub-ui | 1.3.0 | 1.3.2 |
| @iconify-json/logos | 1.2.18 | 1.2.19 |
| @iconify-json/vscode-icons | 1.2.94 | 1.2.96 |
| @iconify/vue | 5.0.4 | 5.0.5 |
| @json-render/core | 0.21.3 | 0.22.0 |
| @napi-rs/cli | 3.10.9 | 3.10.12 |
| @oxc-project/types | 0.156.0 | 0.157.0 |
| @remotion/bundler | 4.0.539 | 4.0.541 |
| @remotion/cli | 4.0.539 | 4.0.541 |
| @remotion/renderer | 4.0.539 | 4.0.541 |
| @shikijs/engine-javascript | 4.5.0 | 4.6.0 |
| @shikijs/langs | 4.5.0 | 4.6.0 |
| @shikijs/themes | 4.5.0 | 4.6.0 |
| @shikijs/vitepress-twoslash | 4.5.0 | 4.6.0 |
| @tailwindcss/vite | 4.3.3 | 4.3.4 |
| @tanstack/vue-query | 5.105.0 | 5.106.1 |
| @types/vscode | 1.144.0 | 1.145.0 |
| @vitejs/devtools | 0.8.0 | 0.8.2 |
| @vitejs/devtools-kit | 0.8.0 | 0.8.2 |
| @vitest/browser-playwright | 5.0.5 | 5.1.0 |
| @vitest/coverage-v8 | 5.0.5 | 5.1.0 |
| @vue/compiler-core | 3.5.44 | 3.5.45 |
| @vue/compiler-dom | 3.5.44 | 3.5.45 |
| @vue/compiler-sfc | 3.5.44 | 3.5.45 |
| @vue/reactivity | 3.5.44 | 3.5.45 |
| @vue/runtime-core | 3.5.44 | 3.5.45 |
| @vue/shared | 3.5.44 | 3.5.45 |
| ai | 7.0.159 | 7.0.163 |
| d3 | 7.9.0 | 7.9.2 |
| devframe | 1.3.0 | 1.3.2 |
| graphql | 17.0.2 | 17.1.0 |
| gridstack | 14.0.0 | 14.1.0 |
| hono | 4.13.14 | 4.13.16 |
| mermaid | 12.2.0 | 12.3.0 |
| oxc-parser | 0.156.0 | 0.157.0 |
| oxfmt | 0.73.0 | 0.76.0 |
| remotion | 4.0.539 | 4.0.541 |
| rollup | 4.67.2 | 4.67.5 |
| rollup-plugin-visualizer | 7.1.1 | 7.1.2 |
| semver | 7.8.5 | 7.8.6 |
| shiki | 4.5.0 | 4.6.0 |
| tailwindcss | 4.3.3 | 4.3.4 |
| tsdown | 0.23.4 | 0.23.5 |
| vite-plus | 1.4.0 / 1.2.0 | 1.5.0 |
| vitest | 5.0.5 | 5.1.0 |
| vue | 3.5.44 | 3.5.45 |
| web-streams-polyfill | 4.3.0 | 4.5.0 |
| wrangler | 4.156.0 | 4.157.0 |

Vite+ 更新到 1.5.0，内置 Vite 8.3.5 与 Vitest 5.1.0；独立 Vite 保留 8.3.5。Vite 8.3.6 候选的 hooks、resolver、mini-optimizer 三项已通过，web-optimizer 失败后 polling、ready 未执行，不能视为六项通过；该诊断资源已确认清理。记录位于 `.tmp/current-run/dependency-upgrade-2026-11-05/vite-six-contracts.log` 与 `.tmp/dependency-diagnostics/vite-product.json`。

最终锁中仍存在网站开发链引入的 Vite 8.3.6：唯一可达 workspace importer 为 website，经 VitePress 2.0.0-alpha.20 及其 plugin-vue 绑定。公开包的运行时 dependencies、optionalDependencies（含 workspace link）未发现可达该版本；weapp-vite、@weapp-vite/web 与根清单的直接 Vite 均为 8.3.5。保留这条网站传递依赖不表示产品生命周期豁免扩大；该网站链已单独通过本地构建与八项浏览器检查，详见验收状态。

Vitest 升级及 Vite+ 配对仍需复核现有补丁的必要性和行为契约。Chokidar 6.0.0、plugin-vue 6.0.10 与 Rolldown 1.2.16 已是本轮查询时的稳定目标，既有补丁与单版本约束继续受检查。Oxc、oxfmt 和 json-render 的 0.x minor 变化仍需按兼容迁移验证。

## Rust 与工具链

| 对象 | 当前 | 本轮目标或处理 |
| --- | --- | --- |
| 开发及 CI 固定 Node 24 | 24.22.1 | 24.22.2 |
| repoctl snapshot build/publish 模板 | 24.22.1 | 保留上游固定字节与 builder SHA 对应版本 |
| repoctl 自动 changeset plan/apply 模板 | 24.22.1 | 保留官方可信执行模板的固定版本 |
| CI 浮动 Node 26 支持线 | 26.12.1 | 26.13.0 |
| Node 22 支持线 | 22.23.4 | 保留 |
| 产品 Node engines 与最低版本兼容矩阵 | ^22.23.4 \|\| ^24.22.1 \|\| >=26.12.1 | 保留最低兼容版本 |
| pnpm | 12.16.1 | 已是稳定 latest，保留 |
| Rust | 1.99.1 | 已是稳定 latest，保留 |
| tutorial Bun | 1.4.3 | 1.4.4；既有 1.4.2 与 latest 兼容矩阵保留 |
| pnpm/action-setup | v6.1.0 | v6.1.1，固定官方 tag 解引用后的 commit 73e46992e05b19abd31f2f3c20e0e7370d762115 |
| Rust Oxc 七项直接依赖 | 0.156.0 | 0.157.0，与 JavaScript parser/types 同步 |
| Cargo 内部 Oxc 依赖 | 0.156.0 | 14 项 Oxc 锁定包同步到 0.157.0；dragonbox_ecma 由 zmij_ecma 1.0.23 替代 |
| 独立小程序 CI runner | miniprogram-ci 2.1.31 | 已是稳定 latest，单独维护 npm 锁与审计 |

Node 目标来自 nodejs.org 官方发布索引；Rust 来自官方 stable manifest 和发布信息；Cargo 107 个锁定 crate 已逐项查询 crates.io 的 max_stable_version，查询无失败。napi、serde 等直接依赖无需提高版本。GitHub Actions 按官方最新 release 与 tag 对应 commit 回读，除 pnpm/action-setup 外，其余九个外部 Actions 仓库的当前 SHA 已匹配查询时的稳定目标。上述内容是目标核对结果，不能替代构建和运行验收。

`.node-version` 与现行开发、CI 固定版本更新到 Node 24.22.2，Node 26 浮动支持线更新到 26.13.0；产品 engines 与最低兼容矩阵继续使用 `^22.23.4 || ^24.22.1 || >=26.12.1`，Bun 的 1.4.2 与 latest 兼容矩阵也保留。`.github/workflows/repoctl-snapshot-build.yml` 与 `.github/workflows/repoctl-snapshot-publish.yml` 保留 Node 24.22.1：repoctl 6.4 官方模板冻结完整文件字节及 builder SHA，未提供 Node 覆盖入口，本轮不改模板指纹或弱化对应断言。

`.github/workflows/release-intent-auto.yml` 的 plan、apply 也保留 Node 24.22.1。repoctl 6.4.0 的 `getAutoChangesetWorkflow` 类型、实现与 CLI 只支持 Environment、工作流及 job 名称、路径和 policy 配置，没有 Node 版本覆盖；官方 resource 固定该版本，仓库 admission 按完整 job 对照可信模板。本轮曾将两处 pin 一并升级到 24.22.2，首次 pre-push 因该漂移阻断，现已恢复模板 pin，保留审批、权限、命令和完整对照检查。

Rust 检查显式使用已核验的 rustc 1.99.1 与 Cargo 1.99.1，`cargo check --locked --manifest-path packages/ast-native/Cargo.toml`、`cargo test --locked --manifest-path packages/ast-native/Cargo.toml` 均退出 0，测试 20 项通过、0 失败、0 忽略。最初名为 1.99.1 的工具链缺少 rustc，其检查结果未计为正式通过；发现现有完整 stable 工具链后，已用实际 1.99.1 重跑。任务临时下载已定向停止，无残留任务进程。身份、命令和日志保存在 `.tmp/current-run/dependency-upgrade-2026-11-05/toolchain/`。

native 路径继续保持可选依赖、显式启用和 JavaScript fallback。上述 Cargo 检查之外，本轮真实 addon 构建、correctness 对齐和暖路径 profile 的本地结果也已单独登记；它们不替代最终跨平台 CI 或整体性能门禁。

## 验收状态

pnpm 最终锁输入的审计由 54 个 advisory/module 条目降到 50 个：low 6、moderate 22→19、high 18→17、critical 8。消除四个条目，未发现新增条目或严重程度上升：`GHSA-p458-7748-mcp3` 对应的 vite-plus、@vitest/browser、@vitest/ui 三个 moderate 条目，以及 zod 的 `GHSA-mrhx-c7xc-m3w5` high 条目。minimatch 的 `GHSA-g3hv-75wg-m249` 仍在，依赖链路径有变化。该数字按 advisory/module 计数，不是唯一 GHSA 数量，也不代表实际可利用性。审计退出 1，八个 critical 条目仍未消除；最终比较记录为 `.tmp/current-run/dependency-upgrade-2026-11-05/audit-final-comparison.json`，其中保存锁文件和前后审计指纹，不能记为安全审计全绿。

八个 critical 条目的直接父依赖范围均无法容纳已发布修复，或尚无修复版：request 的 form-data `~2.3.2`、cos-wx-sdk-v5 精确依赖的 fast-xml-parser 4.5.0、download 的 decompress `^4.2.1`（两条）、minidev 的 tar `^6.1.11`、旧 oxfmt 精确依赖的 tinypool 2.1.0（两条），以及 monaco-editor 0.57 精确依赖的 dompurify 3.4.15。dompurify 位于 dashboard 的非开发依赖链，不能将全部剩余 critical 归为开发工具告警；本轮未通过越过父范围的 override 强行消除这些条目。

独立 npm runner 的锁刷新、`npm ci --prefix tools/miniprogram-ci-runner --ignore-scripts`、CLI `--help` 及 API 导出 smoke 均在实际 Node 24.22.2 下退出 0；确认 miniprogram-ci 2.1.31 的 Project、preview、upload 导出存在，未调用预览或上传。升级前后 npm audit 均报告 75 项（low 1、moderate 15、high 19、critical 40），审计退出 1，属于仍存在的告警，不能记为安全审计通过。miniprogram-ci 已是稳定 latest，本轮未强加不兼容 override；该口径单独记录，不与 pnpm 数字相加。证据为任务目录中的 `runner-frozen-install.log`、`runner-cli-smoke.log`、`runner-api-smoke.log`、`runner-audit-before.log` 与 `runner-audit-after.log`。

全仓单测首轮退出 1：测试文件 3 失败、2610 通过、13 跳过；测试用例 9 失败、25306 通过、20 跳过。Node 策略测试占七项失败，其断言将普通 CI 首选版本下限与产品 engines 最低兼容版本混为同一值。性能夹具 `scripts/templateCorpus/benchmark/prepare.test.ts` 当时观察到 esbuild 无法从 entities 的 decode 入口找到 EntityDecoder、htmlDecodeTree、xmlDecodeTree 三个导出；后续已修复 entities 边界，确认为主线既有缺陷，并非本轮新依赖引入。完整首轮证据保存在 `.tmp/current-run/dependency-upgrade-2026-11-05/all-unit-tests.log`；修复后的定向通过单独登记，不将首轮失败改写为通过。

Node 策略测试已按上述边界修复，`scripts/ci-node-minimum.test.ts` 定向重跑 21 项全部通过，文件及本报告的 ESLint 检查通过。普通 CI 首选下限取当前 selector，分别验证 engines 支持、major、三个入口一致性、Node 24 与 `.node-version` 一致性，以及 v2 resolver 与共享入口一致；九项精确最低兼容版本通道和历史 24.18.0 性能环境断言继续保留。结果登记在任务 `checks.jsonl` 中的 `ci-node-floor-unit`、`ci-node-floor-lint`，不能替代其余失败修复或最终跨平台 CI。

以下结果均来自本轮输入下已完成的本地验证，命令、退出状态和日志登记在 `.tmp/current-run/dependency-upgrade-2026-11-05/checks.jsonl` 及对应任务证据中。

| 验收范围 | 已观察结果与边界 |
| --- | --- |
| 冻结安装、同步与发布说明 | 最终冻结安装通过；workspace、API 与脚手架同步通过；合并 changeset 保留全部 46 个可发布包的 patch 及 create-weapp-vite 联动，工作树补充覆盖检查通过 |
| 构建与类型 | 包构建通过；公开类型 88/88、19 个包的 typecheck、tooling-typecheck 与 ESLint 通过；后续 Streams 修正完成包构建，weapp-vite 也已重新构建 |
| 首轮失败文件的最终定向回归 | `final-failed-files` 三个文件、32 项测试全部通过；完整全仓最终结果仍由候选 main CI 补足 |
| Streams 升级兼容修正 | 四个文件、53 项测试通过，包级类型检查通过并已构建；该组结果与首轮失败文件回归分别保留 |
| 性能夹具 entities 边界 | 三项定向测试及 lint 通过；记录为主线既有缺陷修复，不归因于本轮新依赖 |
| 网站 | 本地网站构建和八项浏览器检查通过；覆盖网站自身的传递 Vite 链 |
| 依赖生命周期合约 | 按既有 Vite 8.3.5 固定版本豁免通过，未将豁免扩展到 Vite 8.3.6 |
| native | Rust 20 项、真实 addon 183 项、暖路径 480 次 parity 检查通过；addon 已使用本轮输入构建 |
| 宣传视频消费者 | 四个 composition、12 张 still 使用独立的已安装 Chrome 在 headless 模式下渲染成功；finally 已关闭所建浏览器。先前自动下载尝试已精确发送 SIGINT 清理，确认无该任务残留 |

native 暖路径 profile 只证明本轮对应输入的对齐与采样完成，不构成整体性能门禁通过。p95 存在波动，本轮不据此宣称稳定提速。

首个 main 候选 `3dad879264` 的 pre-push 使用隔离冻结快照及新安装依赖，853 项 repo-scripts 中 849 通过、四项 PR admission 检查因上述模板 pin 漂移失败；lint、48 个包构建及该轮全部包类型检查通过。此前根 `pnpm test` 的 `ROOT_REPOSITORY_TEST_GLOBS` 只发现 `.test.ts`，没有执行 `scripts/prAdmission/local.test.mjs`、`cli.test.mjs`；两份文件也未出现在全仓首轮日志中。pre-push 的独立工具入口同时发现 `.test.ts` 与 `.test.mjs` 并包含 PR admission，因此补出了验证范围差异。该遗漏来自入口覆盖范围，未发现 fixture 读取根目录生成或缓存导致假绿的证据。

恢复自动 changeset 官方 pin 后，仅定向重跑 `scripts/prAdmission/local.test.mjs` 与 `cli.test.mjs`：两个文件、56 项全部通过；该工作流和本报告的 ESLint 检查通过。证据记录为 `auto-changeset-admission-regression`、`auto-changeset-template-lint`，最终候选的完整 pre-push 仍需重新完成。

修正后的 `b31e9f433` 已通过原生 pre-push 并推送 main。补查独立脚本入口后，四份遗漏的 MJS 合约中 107 项通过，唯一失败来自当前候选 workflow 配置快照。已按仓库文档同步当前候选记录中的三处 Node 配置和升级前主线已有的 template-corpus job；实际 workflow、测试断言、watcher 专用同步守卫、历史 baseline 与测量数据均未修改。快照及同步守卫 20 项回归通过，Vitest 离线 fixture、真实四分片覆盖合并和 telemetry smoke 共八项通过；原有覆盖阈值拒绝、原生 emit 和工件身份检查继续保留。

候选提交的完整 CI、headless/HMR 与真实 DevTools 验收仍待完成，应用、模板和实际消费者的最终矩阵由主验证流程继续登记。本文的局部通过只覆盖对应输入和观察面；真实 IDE 或 CI 未完成、存在失败或环境阻塞时，保留具体状态与证据，不计为最终验收通过。
