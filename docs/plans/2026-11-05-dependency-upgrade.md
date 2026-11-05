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

Vitest 5.1.0 官方 ServerModuleRunner 已以 UTF-8 读取磁盘缓存代码，覆盖原 `vitest@5.0.5.patch` 的修正，本轮已删除该补丁及其清单、锁文件登记。Vite+ 的上述官方配对已同步；冷、暖磁盘缓存启动失败回归继续保留，没有以关闭缓存绕过错误。当前仅保留 Chokidar 6.0.0 与 plugin-vue 6.0.10 两份补丁，Rolldown 1.2.16 单版本检查通过。补丁用途和交付边界见 `patches/README.md`；Oxc、oxfmt 和 json-render 的 0.x minor 变化仍按各自消费者范围验收。

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
| 冻结安装、同步与发布说明 | 冻结安装及 workspace、API、脚手架同步通过；合并 changeset 原有 46 个包的 patch 与 create-weapp-vite 联动继续保留，后续补入私有 VS Code 扩展的 patch 记录，目前共 47 条，不能称为 47 个 npm 可发布包 |
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

恢复自动 changeset 官方 pin 后，定向重跑 `scripts/prAdmission/local.test.mjs` 与 `cli.test.mjs`：两个文件、56 项全部通过；该工作流和本报告的 ESLint 检查通过。证据记录为 `auto-changeset-admission-regression`、`auto-changeset-template-lint`。随后 `b31e9f433` 与 `394dad58a` 均已通过原生 pre-push 并推送 main，证据分别为 `push-main-corrected.log`、`push-final-contracts.log`；这些 quick 结果不替代完整 CI、消费者或 runtime 验收。

修正后的 `b31e9f433` 已通过原生 pre-push 并推送 main。补查独立脚本入口后，四份遗漏的 MJS 合约中 107 项通过，唯一失败来自当前候选 workflow 配置快照。已按仓库文档同步当前候选记录中的三处 Node 配置和升级前主线已有的 template-corpus job；实际 workflow、测试断言、watcher 专用同步守卫、历史 baseline 与测量数据均未修改。快照及同步守卫 20 项回归通过，Vitest 离线 fixture、真实四分片覆盖合并和 telemetry smoke 共八项通过；原有覆盖阈值拒绝、原生 emit 和工件身份检查继续保留。

### 候选 394dad58a 的完整 headless 与 CI

`394dad58a77693b2e3989da1f16a728b2e99bdf7` 从干净 main 执行 `pnpm e2e:ide:headless:full`，时间为 2026-11-05 11:50:09–12:02:30 UTC，退出 0。既定 classic suite 的 107 项清单中，93 项适用任务全部执行并通过，failed、blocked、skipped、notExecuted 均为 0；另外 14 项为原有 experimental 范围外任务，不计为执行通过。报告记录 `acceptance: passed`、`coverage: complete`，并生成 93 份验收工件。该入口按既定配置记录 `strict: false`，本轮未另加失败放行或缩小任务清单。命令、报告分别保存在任务目录的 `headless-full-final.log`、`headless-full-suite-report/index.json`；机器租约已释放，fixture 临时改动已恢复。

以下 CI 状态固定为 2026-11-05 12:16:03 UTC 的已保存快照，均针对上述 SHA。排队或运行中的 workflow 不能记为成功，后续结果继续由主验证流程更新。

| Workflow | Run | 快照结果 |
| --- | --- | --- |
| CI | [42022164416](https://github.com/weapp-vite/weapp-vite/actions/runs/42022164416) | 未结束；25 个 job 成功，冻结模板语料 job 失败，其他 job 仍排队或运行 |
| CI E2E | [42022173970](https://github.com/weapp-vite/weapp-vite/actions/runs/42022173970) | 未结束；24 个 job 成功，七个 job 失败，其他 job 仍排队或运行 |
| Native Addon Correctness | [42022182424](https://github.com/weapp-vite/weapp-vite/actions/runs/42022182424) | 成功，五个 job 完成，覆盖三种操作系统 |
| Vite Host Consumer | [42022189512](https://github.com/weapp-vite/weapp-vite/actions/runs/42022189512) | 未结束，已完成的 job 无失败 |
| Create Weapp Vite Smoke | [42022197271](https://github.com/weapp-vite/weapp-vite/actions/runs/42022197271) | 运行中，已完成的 job 无失败 |
| Website dry-run | [42022377203](https://github.com/weapp-vite/weapp-vite/actions/runs/42022377203) | 成功，三个 job 完成；未发布网站 |
| VSCode Extension CI | [42022383570](https://github.com/weapp-vite/weapp-vite/actions/runs/42022383570) | 排队，已完成的 job 无失败；仅打包，不发布扩展 |
| Tutorial E2E | [42022390519](https://github.com/weapp-vite/weapp-vite/actions/runs/42022390519) | 排队，已完成的 job 无失败 |
| Acceptance and Agent | [42022397236](https://github.com/weapp-vite/weapp-vite/actions/runs/42022397236) | 运行中，已完成的 job 无失败 |

CI E2E 的原始失败涉及 Firefox/WebKit smoke、三操作系统 Shared Compiler Hosts、Web Project Builds 及 Node 22/24 Web E2E Baseline。已定位两条不同的根因：独立 Vitest global setup 取得机器租约后，在发布父凭证前创建 journal，导致 inventory scanner 的嵌套租约与自身竞争；Vue 模板解析和格式化会压缩或转义内联平台脚本正文，使 uview-plus 中以行注释开头的 WXS 丢失实际导出。前者的父凭证发布修正已通过 20 项定向测试及 lint；另在无继承凭证、无父 journal 的进程中直接运行 Web Vitest 配置，真实 scanner 与三项测试通过，退出后机器租约目录已消失，证据为 `standalone-machine-scanner.log` 与 `standalone-machine-scanner-lease-after.json`。后者已完成下述本地修正和包级回归。原始失败日志按 `ci-job-<job id>.log` 保留，本地通过结果不覆盖或改写原 CI 失败。

### CI 暴露问题的本地修正

WXS/SJS 修正将原始脚本保护收敛到共享 helper：Vue 仍负责标签、属性与所属模板，WXML 的公共 core 入口负责 JavaScript 词法边界；SFC 首次解析、模板编译、uni-app 归一化、native slot 和 HMR 共用该实现。解析期间按原长度遮蔽脚本正文并保留换行，生成及格式化结束后恢复原文，避免行注释吞并导出、XML 转义运算符或误读脚本中的标签字面量。普通不含平台脚本的模板保留原解析快路径，没有新增公共 API。

编译器因此新增 `@wevu/compiler → @weapp-vite/wxml` 的内部 `workspace:*` 链接，已检查依赖无环。锁文件相对 `394dad58a` 仅增加该 importer 链接；`wxs-lock-equivalence.json` 确认 lockfileVersion、settings、catalogs、overrides、patchedDependencies、packages 和 snapshots 全部等价，没有滚动任何 registry 版本。`pnpm install --frozen-lockfile --offline --ignore-scripts` 覆盖 177 个 workspace，退出 0，证据为 `wxs-frozen-install.log`。

| 本地修正验证 | 已观察结果与证据 |
| --- | --- |
| compiler 定向回归 | 八个文件、329 项通过，覆盖脚本原文、SFC、native slot、HMR、uni-app 与组件扫描；`wxs-compiler-targeted-final.log` |
| compiler 全包单测 | 124 个文件、1616 项通过；`wxs-compiler-full.log` |
| compiler 构建与类型 | build、包级 typecheck、公开类型及修改文件 lint 均通过；`wxs-compiler-build-final.log`、`wxs-compiler-typecheck-final.log`、`wxs-compiler-public-types.log` 及对应 lint 记录 |
| Web 转换语义 | 四个文件、43 项通过，生成实际模板模块并使用生产 `createRenderContext` 执行 WXS 导出，验证行注释、运算符、标签字面量、导出返回值和两次渲染的模块缓存；`wxs-web-semantics-final.log` |
| Web 类型与 lint | 包级 typecheck 与新增回归文件 lint 通过；`wxs-web-semantics-typecheck.log`、`wxs-web-test-lint-final.log` |

VS Code 的后续 CI job `127233079512` 首个真实失败为 shared/platforms 源码无法导入 `@weapp-vite/wxml/presets`。新 checkout 没有 WXML dist，而扩展现有 source alias 闭包漏接 WXML 的 `presets`、`core` 子路径。原 CI 的 12 个失败文件、30 个失败用例及 19 个通过文件、140 个通过用例保留在 `ci-job-127233079512.log`。相关 alias、Vitest/tsdown/TypeScript 配置及 shared/language-service 消费源码从基线到 `394dad58a` 均未变化，锁中 workspace links 正确，现有证据支持既有源码闭包缺口，不能归因为 Node 或 Vitest API 变化。

修正涉及扩展的共享 alias、TypeScript paths、tsdown 配置和现有闭包回归四个文件：精确解析两个 WXML 公共子路径，真实 bundle 必须包含对应源码且不得回落到 dist 或外置 workspace 导入；除 `vscode` 宿主模块的既定例外，其余 `UNRESOLVED_IMPORT` 现在会阻断构建。未通过提前构建所有包掩盖新 checkout 的缺口。在 Node 24.22.2 下，扩展定向三个文件、30 项通过，完整 31 个文件、232 项通过，typecheck、lint、扩展构建、隔离 mock smoke 与包检查均通过；证据为 `vscode-source-closure-*.log`。本地 `check:publish` 只执行检查，没有发布扩展或启动真实 VS Code 宿主。

另一个 Windows 回归在 `autoImport.watchOwnership.test.ts` 的 fixture 原子替换阶段遭遇裸 `fs.rename` 的 `EPERM`。该测试现复用已有 `renameAtomicFile` 的有界 Windows 短暂错误重试，保持同一次原子 rename，不删除目标或改用复制；工具原有取消语义保持。具体持锁者尚无证据，不能归因为杀毒软件或产品业务逻辑。工具回归 11 项通过，根任务持有机器租约执行真实 watcher 回归七项通过，证据分别为 `windows-fixture-atomic-rename.log`、`windows-fixture-watch-ownership.log`。本机 watcher 结果不能替代修正后的真实 Windows CI。

WXS 修正后已重新构建 compiler 和 weapp-vite；`wxs-weapp-vite-build.log` 退出 0。随后串行执行 uview-plus Web 实际构建并通过，证据为 `wxs-uview-web-build.log`。真实浏览器回归于 2026-11-05 12:54:26–12:56:17 UTC 退出 0：两个正式测试验证 139 个组件的移动、桌面行为，以及 139×2 个页面的视觉基线比对，全部通过，未更新 baseline。`afterAll` 已关闭本轮创建的 headless Chrome 和 dev server，证据为 `wxs-uview-web-browser.log`。新候选 CI 与正式完整真实 IDE 验收仍待完成，已有消费者及 Workspace HMR 的其他失败继续独立分析，不能据此宣称 CI 全绿。

### 冻结模板语料的既有失败

CI 的 `Frozen template corpus, fuzz and source coverage` 在 `pnpm corpus:check` 阶段失败，尚未进入后续包 acceptance、coverage 命令。该命令读取冻结语料，不会在这轮重新构建 Taro。当前 manifest 的 190 条 generation 原本就是 184 built、四条 unsupported、两条 failed；两条 failed 分别为 `taro-4.3.2-harmony-jsui-199c3efafcceae46-development` 与对应 production。13558 份 document、26228 个 origin 仍保留原始输入。

两种模式保存的构建错误均为 `Cannot call .tap() on a plugin that has not yet been defined`，来自 Harmony 插件注册流程对 `miniPlugin` 的调用。冻结记录采用 Node 22.22.3、Taro 4.3.2，生成配置日期为 2026-11-04；本轮没有用 Node 24 重新生成这些输入。基线到 `394dad58a` 的比对证明，`packages/wxml/test/corpus` 全部档案及 generator/check 实现未变，`scripts/templateCorpus` 仅上述 benchmark entities 边界修正发生变化，证据为任务目录的 `corpus-baseline-comparison.json`。

本轮保留 failed 状态、原始日志和门禁，不改成 built/unsupported，不重采历史语料来消除失败。现有日志尚不能区分上游 Taro 缺陷与 Harmony fixture 配置问题，后续需调查插件注册流程，再通过正式 generate/collect 更新真实证据。包 `test:acceptance` 同样检查该 inventory，因此不能跳过语料门禁后宣称 acceptance 已通过。

以上完整 headless 与远端 CI 快照只覆盖 `394dad58a`。WXS 编译器、测试基础设施、VS Code 及 Windows fixture 修正的本地结果按各自日志登记，新候选仍须补齐受影响消费者、CI 和 runtime 验证，不能沿用旧 SHA 的完整通过。真实 DevTools 完整验收尚未执行，本轮仍未完成最终验收。

代码组织评审：新增原始脚本 helper 独立于 SFC 适配器，避免自动组件扫描依赖重型解析入口而形成回边；普通不含平台脚本的模板保持原解析快路径。既有超过 300 行的 SFC/编译文件仅接入共同 helper，不再复制词法规则。`machineGlobalSetup.test.ts` 保留集中 `vi.hoisted` mock、隔离租约与恢复生命周期，拆分会重复该状态边界，因此本轮保留同一测试文件。
