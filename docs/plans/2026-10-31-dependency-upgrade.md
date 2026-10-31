# 全仓依赖升级与迁移记录（2026-10-31）

本轮以 `8963dcaf4ea66ed1325b2f4ee28837fbf73f9f8d` 为基线，覆盖 257 份自有 npm 清单、workspace catalog、独立 npm runner、Rust 及 GitHub Actions。npm 目标冻结于 `2026-10-31T15:02:50.556Z`，共 53 个 npm 包和 pnpm；后续验证沿用同一批直接依赖目标。

## 兼容范围

按用户确认保留 TypeScript 6.0.3 和历史 TypeScript/旧版复现 fixture。第三方 Dimina upstream、历史性能环境和报告保持原样。现有 VitePress 与 vite-tsconfig-paths 预发布版本线保留，稳定 latest 低于现有预发布线时不降级。

开发及验证使用 Node 24.22.1、pnpm 12.16.1。产品 Node 范围继续为 `^22.23.4 || ^24.22.1 || >=26.12.1`。保留原有精确、`^`、`~` 和 catalog 声明方式，以及公开 peer 的兼容范围。

## 冻结的 npm 直接版本

| 依赖 | 升级前声明 | 目标稳定版 |
| --- | --- | --- |
| @ai-sdk/anthropic | 4.0.88 | 4.0.94 |
| @ai-sdk/openai | 4.0.102 | 4.0.106 |
| @ai-sdk/openai-compatible | 3.0.78 | 3.0.82 |
| @babel/core | ^8.0.9 | 8.0.10 |
| @babel/generator | ^8.0.6 | 8.0.10 |
| @babel/parser | ^8.0.8 | 8.0.10 |
| @babel/traverse | ^8.0.7 | 8.0.10 |
| @babel/types | ^8.0.8 | 8.0.10 |
| @devframes/agentic | 1.2.6 | 1.3.0 |
| @devframes/hub | 1.2.6 | 1.3.0 |
| @devframes/hub-ui | 1.2.6 | 1.3.0 |
| @icebreakers/eslint-config | 8.0.11 | 8.0.12 |
| @iconify-json/logos | ^1.2.17 | 1.2.18 |
| @iconify-json/vscode-icons | ^1.2.93 | 1.2.94 |
| @inquirer/prompts | ^8.7.4 | 8.7.5 |
| @microsoft/api-extractor | ^7.59.4 | 7.60.1 |
| @oxc-project/types | ^0.155.0 | 0.156.0 |
| @remotion/bundler | 4.0.538 | 4.0.539 |
| @remotion/cli | 4.0.538 | 4.0.539 |
| @remotion/renderer | 4.0.538 | 4.0.539 |
| @swc/core | ^1.16.20 / 1.16.20 | 1.16.21 |
| @tanstack/vue-query | ^5.104.5 | 5.105.0 |
| @types/estree | ^1.0.9 | 1.0.10 |
| @types/node | ^26.6.5 | 26.6.6 |
| @types/vscode | ^1.140.0 | 1.144.0 |
| @typescript-eslint/parser | ^8.72.0 | 8.72.1 |
| @vue/language-core | ^3.3.13 | 3.3.14 |
| @vue/language-plugin-pug | ^3.3.13 | 3.3.14 |
| ai | 7.0.153 | 7.0.159 |
| autoprefixer | ^10.6.1 | 10.6.2 |
| axios | ^1.20.0 | 1.21.0 |
| devframe | 1.2.6 | 1.3.0 |
| es-toolkit | ^1.53.0 | 1.53.1 |
| eslint | ^10.13.0 | 10.14.0 |
| eventsource-parser | 3.1.1 | 4.1.3 |
| magic-string | ^1.4.3 | 1.4.5 |
| oxc-parser | ^0.155.0 | 0.156.0 |
| pnpm | 12.15.0 | 12.16.1 |
| postcss | ^8.5.31 | 8.5.32 |
| remotion | 4.0.538 | 4.0.539 |
| repoctl | 6.2.1 | 6.3.1 |
| rolldown | 1.2.15 | 1.2.16 |
| rolldown-plugin-dts | 0.28.8 | 0.29.0 |
| rollup | ^4.65.0 | 4.67.2 |
| sass | ^1.106.1 | 1.107.1 |
| sass-embedded | ^1.106.1 | 1.107.1 |
| solid-js | 1.9.17 | 1.9.18 |
| tailwind-variants | ^3.3.1 | 4.0.1 |
| tsdown | 0.23.2 | 0.23.4 |
| tslib | ^2.8.1 | 2.9.1 |
| uview-plus | 3.8.130 | 3.8.138 |
| vue-tsc | ^3.3.13 | 3.3.14 |
| wrangler | ^4.152.0 | 4.156.0 |
| ws | ^8.22.0 | 8.22.1 |

## 接入与补丁

- eventsource-parser 4 继续使用 `eventsource-parser/stream`；验证分块 UTF-8、CRLF、多行事件、取消和错误传播。
- tailwind-variants 4 的现有 `tv`、variants、defaultVariants 和 slots 用法继续适用；验证 CSS 变量类、padding 覆盖及 slot 隔离。
- Rolldown 1.2.16 保持锁文件单版本，迁移原生 options 的纯 JavaScript 快照与生命周期补丁，保留新版缓存逻辑。
- repoctl 6.3.1 的上游实现已覆盖消费者 runtime context 和本地 peer locator；补丁保留共享 nightly 截止时间处理，并固定官方生成模板中的 artifact Actions SHA。snapshot 工作流通过正式 API 重新生成，内嵌工具版本和 builder 内容摘要一起更新，保留逐字节比较合同。
- rolldown-plugin-dts 0.29 将六个 TypeScript 编译选项迁至 `tsc`。包装层归一化旧顶层选项，新 `tsc` 值优先，显式 `false` 生效；保留自动 project references、每轮独立上下文及独立 Vue 声明生成。公开配置类型兼容旧键并支持新命名空间。
- Vite 8.3.5、Chokidar 6.0.0、Vitest 5.0.5、plugin-vue 6.0.10 仍为本轮稳定目标，现有补丁继续保留。

## Rust 与 Actions

N-API 的 napi 升至 3.16.1、napi-derive 升至 3.7.0；七个 Oxc crate 与 JavaScript parser/types 统一为 0.156.0。现有 Rust 1.99.1 满足目标 MSRV。Cargo 更新或新增 20 个锁定包，locked 编译及 20 项 Rust 测试通过，无需修改 Rust 源码。

官方 registry 的索引和压缩包端点曾持续超时。恢复过程固定官方 crates.io-index commit，核对 Git blob、索引内容及 crate checksum，由 Cargo 生成锁文件与缓存；随后关闭临时传输，使用原官方源执行 `cargo check --locked --offline`、`cargo test --locked --offline` 并通过。Cargo.lock 保持 canonical registry 地址，全局 Cargo 配置保持原样。

三个 workflow 中的九处 artifact Actions 更新为官方 tag 解引用后的 commit：upload-artifact v7.0.2 五处、download-artifact v8.0.2 四处。其余外部 Actions 已核对为当前稳定目标。

## 安全审计

两种工具统计口径不同，各自比较前后变化，不能相加。兼容范围内刷新传递依赖，未添加越过上游依赖范围的安全覆盖。

| 统计口径 | 升级前 | 升级后 | 差异 |
| --- | --- | --- | --- |
| pnpm advisory 条目 | 78 | 51 | 消除 27，新增 0 |
| pnpm low / moderate / high / critical | 10 / 30 / 30 / 8 | 6 / 19 / 18 / 8 | critical 仍有 8 |
| npm runner 受影响包 | 91 | 90 | 消除 1，新增 0 |
| npm runner low / moderate / high / critical | 1 / 30 / 19 / 41 | 1 / 30 / 18 / 41 | high 减少 1 |

workspace 消除项涉及 markdown-it、body-parser、undici、fast-uri、seroval、@hono/node-server 和 follow-redirects。runner 消除 follow-redirects 的 GHSA-mrwp-f3q8-3g9p。剩余问题主要受父依赖的精确版本、旧主版本范围或尚无修复版限制。

| 依赖链 | 尚未修复的约束 |
| --- | --- |
| minidev → request / download / proxy-agent | request、decompress、ip 尚无 patched version；got、tough-cookie、tar、form-data、qs 等修复版超出父范围 |
| miniprogram-ci → file-type / image-size / phin | 修复需跨主版本，npm 的 fixAvailable 不能证明可兼容替换 |
| miniprogram-simulate → postcss | 仍依赖 PostCSS 7，修复要求 PostCSS 8 |
| cos-wx-sdk-v5 → fast-xml-parser | 父包固定 4.5.0，修复要求 5.7.0 或以上 |
| monaco-editor → dompurify | 父包固定 3.4.15，修复要求 3.4.17 或以上 |
| ESLint markdown / oxfmt → katex / tinypool | 现有父约束不能解析到修复版本 |
| Remotion Studio → zod | Studio 固定 4.5.4，安全修复要求 4.6.6 或以上 |
| vitepress-plugin-llms → minimatch；cacache → glob | 修复需要新主版本，保留上游声明范围 |

新增 peer 提示是 schema-utils 4.8.1 的可选 webpack `^5.112.0`，Remotion 仍固定 webpack 5.105.0。上游新增的 `precompile({ minify: true })` 才使用新 webpack 打印接口，当前 Remotion 使用原有 validate 路径。真实 Remotion bundle 已通过；CLI 同时提示仓库 zod 4.6.7 与其推荐 4.5.4 不同。保留这两项提示，不据此改写冻结目标或强制覆盖父依赖。原有 Vite+ alias、GraphQL 和 Mermaid peer 提示继续记录。

## 验证结果

开发验证固定 Node 24.22.1、pnpm 12.16.1、Rust 1.99.1。下表只记录实际执行结果；任务原始日志和命令退出状态保存于本地证据目录。

| 验证 | 结果 |
| --- | --- |
| frozen install、生命周期、独立 runner npm ci 和 API smoke | 通过 |
| catalog 同步、peer 清单、发布协议、包元数据、changeset、Rolldown 单版本 | 通过；peer 提示见上文 |
| 包构建、包级 typecheck | 45 / 45、45 / 45 通过 |
| 全仓公开类型任务 | 80 / 80 通过；DTS 兼容迁移后另补 owning typecheck、35 项回归、公开 tsd，均通过 |
| 发布回归与脚本补集 | 发布组 291 项通过、1 skip，snapshot 修正后定向 40 项通过；补集 75 文件、1,173 项通过、1 skip |
| 完整根单测 | 2,334 文件已执行；首轮 22,017 项通过，38 项失败及 5 个 suite 加载失败，按下文复验 |
| 单测失败补验 | 稳定产物后 16 文件、109 项通过；Tailwind 消费图合同修正后 4 项通过，无剩余失败 |
| 应用及模板构建 | 76 / 76 通过，无重复运行模板入口 |
| 网站构建 | 31 / 31 通过，30 项命中已有包构建缓存 |
| SSE 分块与样式变体回归 | 通过；包含分块 UTF-8、CRLF、多行事件、取消、错误及 slots/布尔变体 |
| Vite / Rolldown / Chokidar 依赖 contracts | 18 / 8 / 29 项通过 |
| Rust fmt、locked check/test、官方缓存离线复验 | 通过，20 项 Rust 测试通过 |
| 真实 N-API release 构建与 correctness | 通过；9 个导出、9 个 suite、183 项真实 addon 对齐／fallback 测试通过，profile 待执行 |
| 非 HMR CI（含六平台构建） | 87 / 87 场景通过；平台补集 3 文件、11 项通过 |
| headless、Web、HMR、真实 tarball、正式 IDE 与跨系统 CI | 待继续执行；未完成项不计通过 |

首轮根单测与应用 Turbo 构建重叠，构建清空并重新生成共享 dist，导致消费入口暂时不存在，部分测试又把缺失导入 externalize 成残留 require。产物稳定后，相应失败全部复验通过，未修改 runtime 源码来规避此执行竞争。后续共享产物构建与消费验证串行。

传递依赖刷新使 postcss-rule-unit-converter 0.2.6 与 0.3.0 同时存在，分别由不同父插件精确指定。原有测试误把“真实 consumer 身份一致”扩大成“全仓只有一个版本”。测试现沿锁文件的 importer 和完整 peer snapshot 逐边核对实际消费链，再与隔离消费者的 override 精确比较；产品依赖无需强制统一。

SSE 原有测试文件及 DTS 集成测试已超过 300 行，本次继续复用既有传输和编译夹具以保留完整观察面；新增配置归一化实现与其上游解析器回归放入独立 `libDts/options` 文件。没有新增超过 300 行的源文件。

## 验收入口修正

真实 profile 准备步骤发现 wrapper 与 native:build 包脚本重复传入 Cargo --locked，导致 metadata 拒绝执行，尚未进入采样。现由包脚本统一负责锁定，组合参数合同验证恰好一次，4 项准备计划回归通过。

首轮远端 Weapi Compatibility Guard 在 Node 22、24 都因干净安装后缺少 @weapp-core/types/alipay-api 构建产物而报 TS2307，随之出现派生的隐式 any。两个 guard 现通过既有 build_command 入口先构建类型包闭包、刷新 workspace 链接，再运行原有完整检查；未修改 API 类型或弱化断言。8 项工作流合同以及构建后的两个 API 源码／测试／公开类型检查通过，远端新提交复验待完成。

## 待完成验收与交付

按既有 manifest 去重执行 non-HMR CI、平台能力补集、HMR build、headless full、正式 HMR headless、Web、Simulator browser 和网站浏览器。headless full 虽含 HMR 文件，正式 HMR 入口还有冻结计划、严格 DOM 和 receipt，保留有意重叠；正式 exhaustive IDE 已覆盖全部适用 HMR IDE 文件，不再另跑相同 gate。

源码验证后按现有主线授权提交推送。正式 exhaustive IDE 必须从干净且与 origin/main 一致的根 main 启动；Windows、macOS、Linux 结果以实际 CI 为准。未执行、环境阻塞、失败和成功分别记录，全部适用门禁完成前保持“未完成最终验收”。
