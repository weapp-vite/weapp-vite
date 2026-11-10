# 2026-11-10 全仓依赖升级

实施基线为 `3453909060a3cc70fa1b03fa06319eaacdcf5148`。开始前快进同步 `main`，包含主线 snapshot 参数和 WASM 资源命名修复。实施中再快进合入主线 `4ff3d88e0b612baa6e72b0c77b087eb295ff4b79` 的内置组件与 TDesign 自动导入更新。候选版本按已批准计划冻结，验收期间不追逐新发布。使用 Node 24.22.2、pnpm 12.18.0 和 native 包固定的 Rust 1.99.1。

## 采用版本

| 分组 | 采用版本 |
| --- | --- |
| 工程工具 | repoctl 6.5.4；@icebreakers/eslint-config 8.0.17；@icebreakers/stylelint-config 6.0.3；@typescript-eslint/parser 8.72.2；ci-info 4.5.0 |
| AST 与构建 | oxc-parser、@oxc-project/types 0.158.0；oxfmt 0.78.0；rolldown-plugin-dts 0.30.1；rollup 4.68.2；rollup-plugin-visualizer 7.1.3 |
| 样式与组件 | weapp-tailwindcss 5.7.3；postcss-selector-parser 7.2.0；tdesign-miniprogram 1.18.0；tailwind-variants 4.0.2 |
| Dashboard | devframe、@devframes/agentic、@devframes/hub、@devframes/hub-ui 1.3.3 |
| AI SDK | ai 7.0.166；@ai-sdk/anthropic 4.0.99；@ai-sdk/openai 4.0.111；@ai-sdk/openai-compatible 3.0.87 |
| 通用依赖 | axios 1.21.1；dotenv 18.0.10；ws 8.22.2；ignore 7.0.14 |
| 网站与视频 | @iconify-json/vscode-icons 1.2.97；wrangler 4.160.0；remotion、@remotion/bundler、@remotion/cli、@remotion/renderer 4.0.542 |

保留精确版本、`^`、`~` 和 catalog 的原声明形式；同步脚手架内置 catalog、现行初始化 fixture，以及 repoctl 发布、自动 changeset 和 snapshot workflow 的固定版本与 builder 哈希。Dashboard 的七个间接配套包同步 1.3.3，避免旧锁文件留下精确 peer 冲突。最终 peer 检查与基线按所属包、要求范围和实际版本比较，无新增告警。

七个直接 Oxc Rust crate 同步 0.158.0；Cargo.lock 中共十四个 Oxc crate 联动更新，其余 crate 保留原版本。native 仍为可选启用，保留现有 JS fallback。

两处 `peter-evans/create-pull-request` 更新到官方 v8.1.2，固定 SHA `15733dbdfeedb4f7fdb73d13c6f5ac83b710fab8`。Node 默认版本、pnpm、Rust、Bun、独立 miniprogram-ci runner，以及两份既有依赖补丁保持当前选择。历史 fixture、第三方 upstream、性能基线和公开 peer 最低兼容范围保留原用途。

## 编译器候选与保留原因

| 项目 | 决策与证据 |
| --- | --- |
| Vite 8.3.7 / Rolldown 1.2.18 | 已安装官方配对并重建 weapp-vite。hooks、resolver、mini-optimizer 通过；web-optimizer 在立即关闭和 requests idle 后关闭两种时序均残留 `deps_temp_*`，原断言失败。polling、ready 因前置失败未执行；不继续采样已拒绝组合的内部和资源门限。清理确认，保留 8.3.5 / 1.2.16。 |
| Vite+ 1.5.1 | 用官方 launcher 对应的 core 独立执行原产品生命周期断言，未沿用旧 Vite 例外。前三项通过，web-optimizer 同样在两种关闭时序失败，清理确认。保留 1.5.0。 |
| Rolldown 1.3.1 | 超出 Vite 8.3.7 官方 `~1.2.18` 配对范围，不采用。最终普通 Rolldown 只有 1.2.16。 |
| local-pkg 1.2.1 | 2.0.0 官方类型声明仍引用未定义的 `Args`，不升级直接声明。上游内部已有的 2.0.0 不另作覆盖。 |
| TypeScript 6.0.3 | 按计划保留。历史 fixture 内独立的旧编译器版本不改写。 |

基线 8.3.5 / 1.2.16 在同一原始全量产品入口也有 Web optimizer 缓存清理失败。既有版本的验收边界继续由仓库原策略约束，未修改策略文件、门限或断言。最终 `pnpm test:dependency-contracts` 通过，包含 Vite 的既定产品门禁、Rolldown 七项产品契约和 Chokidar 二十九项契约。

## 本地验证

最终主线已完成 74 项全仓 lint、50 项包构建、88 项公开类型任务及 80 项应用/模板构建。内部声明选项修正后显式重建 weapp-vite，网站与 lib 模板的 37 项构建任务、lib 消费者与关联公开类型的 59 项任务再次通过；默认弃用告警已消除。

- 最终冻结源码完整单测（`pnpm test`）：2701 个文件通过，26182 项测试通过；13 个文件、20 项测试按既有规则跳过。
- 包构建：49 项任务通过；应用与模板构建：80 项任务通过，包含 TDesign 模板。
- 公开类型：`pnpm test:types` 的 88 项任务通过；8 个直接相关包的源码类型检查通过。
- AST、Tailwind 动态颜色与缓存、语言服务、automator：133 文件、1459 项定向测试通过。
- 脚手架、初始化器、Dashboard：72 文件、664 项测试通过；保留 Vite+ 后另跑 66 项版本与模板配对测试通过。
- repoctl 发布、workflow 与 hooks：358 项通过、1 项既定跳过。
- 网站在恢复已接受的 Vite 后重新构建通过；Dashboard 源码 ESLint 与样式检查通过。
- 完整 headless：classic 范围内 97/97 个任务通过，14 个实验性 HMR 任务按原策略列为范围外；无失败、阻塞、跳过或未执行。
- Git 管理的 1874 份样式文件通过 Stylelint。初次通配扫描包含未跟踪的生成产物和历史初始化输出，报告 243 个错误；它不作为受管源码通过证据，未批量改写这些文件。
- native：183 项测试通过，release 构建通过。六份仓库原始 SFC 各执行 10 轮预热和 40 轮 native/Babel 交替 profile，所有结果、sourcemap、告警一致。暖入口 wall P50 变化为 -11.04% 至 -0.14%，P95 仍有噪声和退化样本；不据此扩大默认启用范围，也不推断完整构建、HMR 或 RSS 收益。
- 最终主线额外复验 TDesign dialog 两种导入路径均通过（1 个适用任务，1 个实验 HMR 任务范围外）；它是定向复验，不替代前述完整 headless 结果。
- 最终锁文件离线冻结安装再次通过，catalog 与两份补丁保持同步。候选 Vite 8.3.7 从普通及网站间接依赖中移除。

声明构建将已弃用的内部 `emitDtsOnly` 调用改为等价的 `dtsOnly`，消除已有弃用告警。先在原 lib-mode 集成测试中复现告警，再验证完整声明文件和组件产物保持原断言；相关 38 项测试、源码 typecheck 与 ESLint 通过。未修改公开配置类型。

全仓 lint 首轮发现 React 打包 skill 副本未继承源码元数据的引号规则。根规则已有明确的 quoted scalar 契约；将同一例外覆盖所有包内 skill 副本，保留元数据原文，避免构建后 lint 与源码 lint 不一致。

首次基线产品验证遇到旧 constants dist 缺少 WASM marker，重建 constants 和 weapp-vite 后重新验证，原始失败单独保留，不算升级回归。Cargo 首次访问 crates.io 超时，使用仅本任务临时 IPv4 连接完成下载，未修改系统或仓库网络配置。Vite+ 临时诊断入口首次遇到 loader 递归，修正入口后才采集产品结果，不把启动错误计为产品失败。

## 安全审计

升级前后 advisory 集合相同，无新增或消除；仍为 low 7、moderate 23、high 18、critical 8，`pnpm audit --json` 退出码为 1。

按 advisory 与依赖路径逐项比较，最终增加 90 条、移除 91 条路径，全部属于 `GHSA-g3hv-75wg-m249` 的 minimatch 10.2.6。路径变化来自依赖图与 peer 解析变化，不记为 advisory 修复。其他 advisory 路径未变化。完整版本清单、registry 元数据、审计原文和逐路径差异保存在本任务本地证据目录。

## Runtime 与交付状态

依赖生命周期、完整 headless 和最终冻结本地验证已通过，repoctl 原生 hooks 安装成功。接下来由原生 hooks 执行提交与推送检查，并跟踪主线提交的跨平台 CI，再从同步、干净根 `main` 启动正式完整 IDE 验收；在结果落定前，本记录不宣称最终 runtime 验收完成。
