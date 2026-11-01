# 全仓依赖升级与迁移记录（2026-10-31）

初始依赖升级与兼容迁移已提交并推送 main。repoctl 修复、版本 PR 和正式发布均已完成，本仓库已接入官方 6.3.2 并删除整份 monorepo 补丁；冻结安装和发布回归通过。最新冻结提交 `8d95556f4` 的远端完整 CI 已终态，119 个 job 中 96 成功、19 既定范围跳过、4 失败。正式 exhaustive IDE 执行 53 个适用任务，52 通过、1 阻塞，另有 84 个适用任务未执行；Workspace HMR full 仍有 16 条计时失败。验收入口修复与 Windows 诊断已完成本机定向回归，最终 suiteRunner 复跑与 E2E 类型检查通过，后续适用门禁仍待完成，当前不标记最终交付完成。

本轮以 `8963dcaf4ea66ed1325b2f4ee28837fbf73f9f8d` 为基线，核对 257 份自有 npm 清单、278 个外部包名，以及 workspace catalog、独立 npm runner、Rust 与 GitHub Actions。npm 目标冻结于 `2026-10-31T15:02:50.556Z`，实际升级目标为 53 个 npm 包加 pnpm，共 54 项；后续验证沿用同一批直接依赖目标。下表与冻结清单逐项一致，没有漏项或目标版本差异。用户追加授权后，吸收 monorepo 补丁的 repoctl 新正式版成为唯一额外目标；该目标现重新冻结为官方 repoctl/core 6.3.2、templates 3.1.4，其他直接目标不变。

## 兼容范围

按用户确认保留 TypeScript 6.0.3 和历史 TypeScript／旧版复现 fixture，包括 `fixtures/ts-base` 中的 `miniprogram-api-typings ^2.8.3-1` 历史预发布声明。第三方 Dimina upstream、历史性能环境和报告保持原样。现有 VitePress 与 vite-tsconfig-paths 预发布版本线保留，稳定 latest 低于现有预发布线时不降级。

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
| repoctl | 6.2.1 | 6.3.1（初始冻结），6.3.2（补丁上游化后） |
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
- repoctl 6.3.1 已覆盖消费者 runtime context 和本地 peer locator；6.3.2 进一步吸收剩余 nightly 共享质量预算及三份模板的九处 artifact Actions SHA。质量脚本／verify hook 共享预算，构建、打包和上传各保留独立超时。整份 monorepo patch、workspace 登记和锁文件 patch hash 已删除；其余五份补丁 hash 不变。snapshot pair 由安装后的官方 CLI 成对生成，publisher 自动计算 builder SHA256，自动 intent 保留 plan/apply 审批覆盖。
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
| 包构建、包级 typecheck | 45 / 45、45 / 45 通过；后续 HMR 修复另完成 owning typecheck 与包重建 |
| 全仓公开类型任务 | 80 / 80 通过；DTS 兼容迁移后另补 owning typecheck、35 项回归、公开 tsd，均通过 |
| 发布回归与脚本补集 | 发布组 291 项通过、1 skip，snapshot 修正后定向 40 项通过；补集 75 文件、1,173 项通过、1 skip |
| 完整根单测 | 2,334 文件已执行；首轮 22,017 项通过，38 项失败及 5 个 suite 加载失败，按下文复验 |
| 单测失败补验 | 稳定产物后 16 文件、109 项通过；Tailwind 消费图合同修正后 4 项通过，无剩余失败 |
| 应用及模板构建 | 76 / 76 通过，无重复运行模板入口 |
| 网站构建 | 31 / 31 通过，30 项命中已有包构建缓存 |
| SSE 分块与样式变体回归 | 通过；包含分块 UTF-8、CRLF、多行事件、取消、错误及 slots／布尔变体 |
| Vite / Rolldown / Chokidar 依赖 contracts | 18 / 8 / 29 项通过 |
| Rust fmt、locked check/test、官方缓存离线复验 | 通过，20 项 Rust 测试通过 |
| 真实 N-API release 构建与 correctness | 通过；9 个导出、9 个 suite、183 项真实 addon 对齐／fallback 测试通过 |
| 实际 native profile | 通过；`f6561e7bd` 冻结输入的 40 trials、2,560 wall 与 64 diagnostic 样本，原始完整输出对齐，冻结身份终检通过；范围见下文 |
| 全包 pnpm / npm 严格 tarball 安装 | 两者通过，54 项消费工具回归通过；该批安装使用 `f6561e7bd` 档案及 peer 夹具修复输入，保留 strict peers、engine 与生命周期检查 |
| `f5f1a4b15` 当前发布档案与实际消费者 | 正式 pack、provenance verify 通过；macOS 的 `wv`、`vite`、`vite-plus` 三种实际 tarball 消费者通过，涵盖严格安装、exports、配置、类型、构建、dev/watch、Tailwind 编辑恢复及实际 stateful 请求／classic fallback |
| 当前档案 Dashboard 严格公开类型 | NodeNext 检查通过，`strict: true`、`skipLibCheck: false`，仅使用 Node ambient |
| 非 HMR CI（含六平台构建） | 87 / 87 suite 任务通过；87 是任务／测试文件数。平台补集 3 文件、11 项通过 |
| 正式 HMR build | `pnpm e2e:hmr:build` 42 / 42 适用任务通过；`f5f1a4b15` 冻结计划、回执 complete／passed |
| headless full | 89 个适用任务全部通过、14 个范围外；DOM 213 项通过、6 skip |
| 正式严格 HMR headless | `9ebebb8bfa` 冻结计划、严格 DOM／runtime 回执完整；14 个适用任务全部通过、14 个范围外。23 个选定 case、155 个 checkpoint 全部通过，原始报告另有 6 个未选定 skip，不计入选定覆盖 |
| CI Workspace HMR full | `8d95556f4` 的 76 个项目、229 / 229 功能场景与 profile 完成，0 功能失败、0 未执行；16 条计时阈值失败，包括原 14 条及 comprehensive 的 vue-script／vue-template 两条，整体 full 审计失败 |
| HMR profile 恢复同步回归 | 本机目标回归、lint、hooks 与 pre-push quick 通过；`9ebebb8bfa` 正式 CI 六个 Windows／macOS／Linux × Node 22／24 HMR Guard 均通过 |
| Web | `9ebebb8bfa` 冻结输入，24 / 24 文件、153 / 153 项通过，suite 1 / 1 通过 |
| Simulator browser | 同一冻结输入，96 / 96 文件、216 / 216 项通过 |
| 网站浏览器 | 同一冻结输入，8 / 8 项通过；复用已有 VitePress 构建 |
| 正式 exhaustive IDE | `8d95556f4` 的 run `c5db45c7-b177-4753-954a-1221fa28dbaf` 退出 1：159 个计划任务中 137 适用、22 范围外；执行 53 个，52 通过、1 阻塞，84 个适用任务未执行。扫码后的最小冷启动及首轮登录失败分别保留 |
| `f5f1a4b15` 跨系统 CI | 已终态：9 个 workflow 中 8 成功、1 失败；310 个 job 中 246 成功、62 既定跳过、2 已知失败。三系统严格消费者与核心检查通过，HMR 计时及旧 profile 同步测试失败保留 |
| `9ebebb8bfa` official E2E full | run 41251548616 已终态：119 个 job，99 成功、19 既定条件跳过、1 项计时门禁失败；无新增功能失败 |
| `8d95556f4` official E2E full | run 41264359935 已终态：119 个 job，96 成功、19 既定范围跳过、4 失败；HMR 计时、Windows Node 24 headless shard／aggregate 及 miniapp aggregate，详见下文 |
| 验收入口与 Windows 诊断定向回归 | 本机串行执行：28 文件通过、1 文件既定 skip；289 项通过、3 项既定 skip，退出 0。最终 suiteRunner 复跑 10 文件／109 项通过，E2E 工程类型检查通过；不替代新提交的远端矩阵与真实 IDE 验收 |

首轮根单测与应用 Turbo 构建重叠，构建清空并重新生成共享 dist，导致消费入口暂时不存在，部分测试又把缺失导入 externalize 成残留 require。产物稳定后，相应失败全部复验通过，未修改 runtime 源码来规避此执行竞争。后续共享产物构建与消费验证串行。

传递依赖刷新使 postcss-rule-unit-converter 0.2.6 与 0.3.0 同时存在，分别由不同父插件精确指定。原有测试误把“真实 consumer 身份一致”扩大成“全仓只有一个版本”。测试现沿锁文件的 importer 和完整 peer snapshot 逐边核对实际消费链，再与隔离消费者的 override 精确比较；产品依赖无需强制统一。

SSE 原有测试文件及 DTS 集成测试已超过 300 行，本次继续复用既有传输和编译夹具以保留完整观察面；新增配置归一化实现与其上游解析器回归放入独立 `libDts/options` 文件。没有新增超过 300 行的源文件。

## 验收入口修正

真实 profile 准备步骤发现 wrapper 与 native:build 包脚本重复传入 Cargo --locked，导致 metadata 拒绝执行，尚未进入采样。现由包脚本统一负责锁定，组合参数合同验证恰好一次，4 项准备计划回归通过。

首轮远端 Weapi Compatibility Guard 在 Node 22、24 都因干净安装后缺少 @weapp-core/types/alipay-api 构建产物而报 TS2307，随之出现派生的隐式 any。两个 guard 现通过既有 build_command 入口先构建类型包闭包、刷新 workspace 链接，再运行原有完整检查；未修改 API 类型或弱化断言。8 项工作流合同以及构建后的两个 API 源码／测试／公开类型检查通过；后续远端 Node 22、24 两组完整 guard 均通过。

实际 native profile 在 `f6561e7bd` 冻结输入上完成，8 份真实 SFC 夹具各做冷／热、sourcemap 开／关与 native 开／关成对采样，启用顺序交替。2,624 份样本均完成，完整 code、map、sourcesContent、诊断与元数据对齐。收益因场景而异，不能据此宣称整个构建链固定提速；addon 首次加载成本另计，native 继续保持可选且显式启用。该采样范围是公开 `compileVueFile`，不包含 CLI、HMR、最终 Tailwind CSS 或宿主 runtime。

三系统严格 pnpm 消费者暴露同一夹具问题：全部发布档案被放在顶层，但未显式提供 vite-plugin-performance 的必需 Vite peer；兄弟包 weapp-vite 内部依赖不承担消费者顶层 peer。夹具现从实际 tarball 清单核对全部必需 peer，并使用 packed weapp-vite 声明补入 Vite；候选档案继续优先，缺失或冲突范围直接报错，optional peer 不自动补齐。54 项回归以及使用 `f6561e7bd` 档案的 pnpm、npm 两种真实全包严格安装均通过。修复已随 `f5f1a4b15` 推送，当前档案的三种本机消费者与 Dashboard 严格类型也已通过；该提交的三系统严格消费者 CI 最终均通过，保持各批档案及安装结果的输入边界。

本机首次消费安装因任务证据目录过深触发 pnpm store 索引文件名长度限制。将同一批档案复制到短临时目录，逐文件 hash 与正式 provenance 再核对后完成安装；没有重新打包、替换候选或放宽 peer 策略。

Workspace HMR 的 React 失败已定位到原始 TSX 与转换后 JS 摘要混淆：React pre 插件先于 core 执行。现由 React 在转换前记录普通 TSX，并与 core 共用原生入口 loaded／resolved 所有权；loader 已读取的入口继续由 raw reader 独占。另修复 Vite 稳定读取跨过文件 truncate 阶段的来源版本结算，使用同一次 `read()` 的返回值，保留到达身份与时间，以每源代次保护后续保存、删除、关闭和 alias 绑定。远端 artifact 没有保存 token 摘要，无法断言该次 native restore 具体读到了空字节，也无证据将其归责于 Rolldown。9 文件、73 项根因和竞态回归、精确 lint 与 owning typecheck 已通过；重建后复测 8 项目、25 场景，更新、恢复及 native 来源回执全部成功，没有功能失败或未执行项。

原 `devProvider.ts` 已超过 300 行，本次只在两种 provider 共用的唯一 hotUpdate hook 增加稳定读取结算，保留在同一处可避免入口分叉；新增来源 helper 与回归文件分别独立，均少于 300 行。

来源修复后的 `f5f1a4b15` CI Workspace HMR full 已覆盖 76 个项目，229 / 229 功能场景成功，0 未执行；runtime-demo、uview、wot 仍有 14 条计时阈值失败，整体 full 审计保持失败。旧 `f6561e7bd` 运行中的来源失败及其连带未执行项不再算作当前功能失败。保留原 full 阈值和历史基线，不用功能全部成功替代计时门禁通过。

本机同宿主对照使用升级前 `8963dcaf` 的独立干净工作树、原 pnpm 12.15.0 和原锁，以及相同 Node 24.22.1、四项目／14 场景、完整 warmup 和原审计阈值。基线功能 14／14 成功，候选本机 8 项目／25 场景功能及来源回执全部成功；两者均只有 runtime-demo、wot 对应的 10 条计时失败。runtime-demo 场景中位数为基线 1735.1ms、候选 1748.7ms，wot 为 6809.2ms、6801.7ms。comprehensive 与 uview 在本机两轮都通过原阈值。单轮结果只能确认本机这两组超限在升级前已存在，不能据此归因远端 uview 等场景，也不能提供统计性的无退化或固定提速保证。

Ubuntu Node 22 的 HMR profile 恢复测试把旧恢复 complete 当成正常编辑的完成记录，正常编辑的异步 JSONL append 因而落入静默窗口。测试现先等待恢复记录，再以新游标等待正常编辑记录；每轮精确新增一条，确认同会话、不同 buildId／eventId，并保留完整静默数组及诊断文件来源为零的断言。目标 E2E、lint、原生 hooks 和 quick 均通过，测试修正已随 `9ebebb8bfa` 推送 main。该提交仅修改测试，生产源码与 dist 仍与 `f5f1a4b15` 一致；正式 CI full 复验已终态，六组跨平台 HMR Guard 均成功；Workspace HMR 计时审计仍失败，未将整体运行记为成功。

`9ebebb8bfa` 的 official E2E full run 41251548616 已终态：119 个 job 中 99 成功、19 既定跳过、1 个 Workspace HMR 计时门禁失败。六组 Windows／macOS／Linux × Node 22／24 HMR Guard 均成功，229 个 HMR 功能场景全部通过；14 条计时失败与前轮集合一致。三组浏览器验证已在该提交上串行完成；各自归档包含原始日志、退出状态、manifest、SHA256SUMS 与校验回执，结束时工作树干净且机器租约已释放。

`9ebebb8bfa` 这轮的 14 条计时 issue 来自 12 个场景与两个项目 p95：runtime-demo 六场景为 3.324–3.524 秒（阈值 1.5 秒）；uview 三场景与 p95 为 9.266–9.970 秒（阈值 6 秒）；wot 三场景与 p95 为 12.275–13.413 秒（阈值 5 秒）。`totalMs = bundlerMs + watchToDirtyMs`，后者分别约 9–10、12–13、58–60 毫秒，主要耗时在 bundler。snapshot build、transform/load 等统计可重叠，不能累加归因于某个插件。六份跨系统原始日志均记录 profile 恢复测试实际通过，19 个条件跳过 job 的名称集合与前轮一致，跳过不计通过。

## 上游补丁与剩余验收

已完成的 non-HMR CI、平台能力补集、正式 HMR build、headless full、正式严格 HMR headless、三组浏览器和实际 tarball 消费者使用各自冻结回执记录，不重复执行未受影响的范围。headless full 虽含 HMR 文件，正式 HMR 入口另有冻结计划、严格 DOM 和 runtime receipt，两者按各自范围验收。

用户追加授权将剩余 monorepo 补丁上游化，已创建 [issue #1127](https://github.com/icelib/repoctl/issues/1127)，修复 [PR #1128](https://github.com/icelib/repoctl/pull/1128) 以 `bfb5e5566fe67be1c7bc2ede0fc4bfed6fbd0167` squash 合并。上游 build、lint、typecheck、tsd、完整 3,470 项单测（含 41 项新增回归）、九组跨平台矩阵及同轮 PR Validation 全部通过。版本 [PR #1129](https://github.com/icelib/repoctl/pull/1129) 的九组矩阵、两组 Dev Container 及 PR Validation 共 15 个 job 全部通过，以 `c3d932afc63002ee5722648e38df4964272f842c` squash 合并。

正式 [Release run 41260866623](https://github.com/icelib/repoctl/actions/runs/41260866623) 的 plan、verify、prepare、upload、confirm、finalize 及文档部署全部成功。官方 npm exact/latest 与五个 GitHub 正式 tag 均核对：repoctl/core 6.3.2、templates 3.1.4、create-icebreaker 2.1.12、create-repoctl 1.2.12。npm 未提供 gitHead，原始缺项和初次 collector 失败保留；改用真实 SLSA 来源证据。Sigstore 4.1.1 已逐包验证签名、证书、透明日志、精确 release.yml@main 身份及 issuer，subject SHA512 绑定官方 registry integrity，source、run 与 attempt 均对应本次发布。

三份真实官方 tarball 的 SHA512／SHA1、完整 dist/resource 字节、三个模板 hash、九处 Actions pin 和精确依赖闭包均通过。独立 npm consumer 正常安装，以及本仓库 pnpm 安装后的三包内容核对均通过。公开 `releaseNightly` 离线回归保留过期 marker，实际经过归档、版本改写、构建、打包、上传回执及下载确认；质量预算递减为 2700000／2400000ms，后续构建／打包／上传仍各为 600000ms。该临时 fixture 显式平台不适用，其模拟内部 consumer 不计作真实 runtime 安装；真实安装由另行的 npm／pnpm 安装提供证据。

本仓库官方包下 `pnpm test:release` 为 22 文件、292 项通过、1 既定 skip；更新文档后的审批／文档补验另有 48 项通过。冻结安装、ESLint、catalog changeset、发布协议和 changeset frontmatter 均通过。锁文件只替换 repoctl、core、templates 三个工具包，其余 package resolution 和 importer 未变；TypeScript 6.0.3、pnpm 12.16.1、单 Rolldown 1.2.16 保持。重新安全审计仍为 51 条、严重度分布不变、没有新增 advisory；peer 约束同初次升级后的记录，变化仅在父链代表路径顺序及 repoctl 版本。纯发布工具接入不新增 changeset。

## 最新 main 与验证范围

用户要求同步后，main 先更新到 `eaa0395c634e03031d342e1de49e06c7e2ffedde`（PR #1293），再提交并推送官方 repoctl 6.3.2 接入，当前冻结远端为 `8d95556f45eb4c02cb27d3a0cc11c1483b774c15`。后续两次 fetch 均未发现新增 main 提交。新增两份内部 fixture 清单没有增加 registry 依赖；原 257 份清单评估及冻结目标继续保留其时间点。新增源码涉及 constants、Web、Simulator、compiler 与 weapp-vite，已先重建 29 个相关包及依赖闭包，并完成 owning typecheck／公开类型检查；下游使用该轮新 dist。

PR #1293 的原生 [run 41241858187](https://github.com/weapp-vite/weapp-vite/actions/runs/41241858187) 为 164 job 成功、70 既定范围跳过。已校验冻结 context、checkout 两个 parent、PR head/base 和 artifact digest；PR checkout 与接入 repoctl 6.3.2 前的 `eaa0395c6` main 完整递归文件树只差 `e2e/ci/hmr-profile-failed-recovery.test.ts` 一份恢复回归。生产源码、生产依赖和对应 harness 输入一致，恢复文件另有 `9eb` 六组跨平台成功证据；repoctl 新开发工具闭包由上述独立回归覆盖。可复用范围如下，不能将范围跳过计为通过。

| 当前源码的验证 | 实际证据与边界 |
| --- | --- |
| package 单测／coverage | PR CI：2,326 文件、22,251 项通过；28 文件／52 项既定 skip |
| 公开类型 | PR CI：37／37 任务通过；本机新增 owning 检查通过 |
| 六平台与 headless | 对应原生 CI job 成功；六平台能力集 7 文件、40 项通过 |
| Web runtime | PR CI：26 文件、165 项通过 |
| Simulator browser | PR CI：Linux 97 文件、217 项通过，对应 Windows／macOS job 成功 |
| Firefox／WebKit smoke | PR CI：1 文件、2 项通过 |
| Web 项目构建 | PR CI：49 个发现项目通过；不代表完整 apps 构建 |
| 全部应用与模板构建 | 本机新 main：76／76 任务通过，0 cached；不重复启动模板入口 |
| runtime-size | PR CI full artifact：49 tiers；已核对 frozen head/base 与摘要，job 成功 |
| 网站 | 新 main 构建 31／31 任务通过；实际网站浏览器 8／8 项通过 |
| Workspace HMR full | PR 中为范围跳过；`8d95556f4` 正式 full 已执行，229／229 功能及 profile 完成，16 条计时失败，门禁未解除 |
| 真实 IDE | 扫码后独立最小冷启动通过；`8d95556f4` 正式 159 planned／137 active／22 out-of-scope 已执行 53 个适用任务，52 通过、1 阻塞、84 未执行 |

真实 IDE 最小复验使用 Stable 2.02.2608080、基础库 3.17.2，原生和 wevu 两个 case、6 个 DOM checkpoint 均完成，日志订阅恢复。任务窗口预算保持 1，资源 journal、端口、watcher、宿主和机器租约已终结；before/after 均为 cold，域层确认所选安装进程数为 0。官方查询报告 Stable 2.02.2609240，本轮按本地约束使用已安装 Stable，记录 officialVersionMatches=false，不将元数据当作实际 runtime 版本。

正式 exhaustive IDE 已从干净且与 origin/main 一致的根 main `8d95556f4` 启动，使用包含 issue #1252 的新 manifest，未指定 filter、shard 或 allow-failures。原始失败及未执行项保持记录；后续正式验收仍须从满足相同干净条件的新冻结 main 启动。Windows／macOS／Linux 结果以实际 CI 为准；未执行、范围外、skip、环境阻塞、失败和成功分别记录。此前计时失败不改阈值、不覆盖历史基线，也不因单轮本机对照就宣称全部已存在或无退化。

## 当前远端失败与入口修复

`8d95556f4` 的 [official E2E full run 41264359935](https://github.com/weapp-vite/weapp-vite/actions/runs/41264359935) 已终态，119 个 job 为 96 成功、19 既定范围跳过、4 失败。四项失败分别为 Workspace HMR full、Windows Node 24 headless shard 1、其 headless aggregate，以及 Windows Node 24 miniapp aggregate。HMR 的 229 个功能场景及 profile 均完成，16 条计时 issue 在原 14 条之外新增 comprehensive 的 vue-script、vue-template 两项；不能将新增项称为历史失败，也不能将功能成功记为性能门禁通过。

Windows headless 的 issue #1134 已完成 DOM case 和 7 个 checkpoint，但 afterAll 因进程 parent generation unknown 清理失败。后续 recheck、capture 和 reconcile 完成、pending 归零，不撤销首次错误；现有 artifact 缺少相关进程的原始祖先、创建时间和 executable，尚不能确定具体失败分支。当前 Windows 修改只补充 generation 捕获过程的诊断，不改变 unknown guard、错误原因、查询次数或终止权限，也不宣称该根因已修复。失败时将限定范围的脱敏诊断作为独立 stdout JSON 行保留，避免通用错误格式化折叠字段；真实 Vitest 子进程回归已覆盖超过 10 KB 的完整投影和同步输出失败保留首错，相关 22 项测试通过。

Windows miniapp shard 4 原始 job 虽退出 0，实际只完成 30 个分配任务中的 2 个，另 28 个未执行，aggregate 因报告不完整而失败。原因已由原始日志确认：正常临时路径的随机后缀被宽泛的 DevTools／OOM 正则误判，触发 unsafe-stop；旧入口又将缺项失败与 strict 绑定，误报全部通过。入口现限定已知宿主日志正文中的独立 OOM token，并保留独立完整签名、fatal、宿主身份和安装守卫；unsafe 与实际缺项均强制非零退出，保留首次错误，并按冻结 shard 分配核对任务分母。真实子进程回归覆盖分块 stdout／stderr、ANSI、CRLF、末尾无换行、路径误判及后续错误，计划回归覆盖完整、partial 和 shard 执行范围。

上述入口修复与 Windows 诊断的本机串行定向回归已完成：28 文件通过、1 文件既定 skip；289 项通过、3 项既定 skip，命令退出 0。最终 suiteRunner 复跑 10 文件、109 项通过，`tsc --noEmit -p e2e/tsconfig.json` 退出 0；本机结果不替代后续新提交的原生远端 CI，也不消除本轮四项失败。

## 正式 IDE 阻塞与资源核验

正式 run `c5db45c7-b177-4753-954a-1221fa28dbaf` 退出 1，strict=true、coverage=partial、acceptance／execution 均 incomplete。159 个计划任务中 137 个适用、22 个范围外；实际执行 53 个，52 通过、1 阻塞，84 个适用任务未执行。已启动任务的 166 个选定 DOM case 为 165 通过、1 失败，另有 6 个既定 raw skip；509 个计划 checkpoint 捕获 495 个。原始报告和完整归档均保留。

首个阻塞任务为 `ide/issue-1140-mode-cache.runtime.test.ts` 的 `emptyOutDir=true`：production step0 initial 已完成构建对比，bridge 连接成功，但模拟器启动失败、没有 page ready，日志订阅预算耗尽，报 `E2E_DEVTOOLS_SIMULATOR_BOOT_FAILED`，14 个 checkpoint 均未捕获。同一原生日志窗口正在首次下载基础库 3.17.5，启动失败后约 8 秒下载校验才完成；这只能作为环境时序证据，不能证明唯一根因。失败 case 未独立观察到 runtime 基础库版本，不能倒填后续 `emptyOutDir=false` 成功 case 的 3.17.5；后者 14／14 checkpoint 通过也不撤销首错。

53 份任务资源报告均 complete、无资源错误；79 条 journal 记录已 released，对应窗口均具备 nativeClosed 与 webContentsDestroyed 双重销毁记录，79 个登记端口已释放，各任务域层宿主检查均 cold、所选安装进程数为 0。13 组 snapshot／watcher 创建与清理配平；这些结果只证明登记资源终结，不替代 runtime 通过。

正式运行退出后已完成一次 Computer Use 恢复核验：独占机器租约，从 cold 状态正常打开同一 Stable 安装，确认已登录且仅有项目列表，再通过菜单正常退出；域层重新确认 cold、所选安装进程数为 0，租约释放并退出 0。未删除登录信息、缓存或 session，也未强杀进程。该恢复不证明阻塞根因已消除；后续先做最小 smoke，再按正式入口继续验收，不通过循环重启改写本轮失败。

恢复后串行最小 smoke 的 2 个 case、6 个 checkpoint 通过，登记资源全部终结；随后按原断言复验 issue #1140，`emptyOutDir=true` 的 14 个 checkpoint 通过，`false` 初始启动仍失败，整体退出 1、仅捕获 14／28 checkpoint。Computer Use 在失败窗口确认“模拟器启动失败”和基础库 3.17.5；没有额外编译、导航或重启。再次失败说明首次下载不足以解释问题，当前暂停后续真实 IDE 启动并保留两轮失败。此次诊断的 9 条 journal 与端口均 released，宿主 cold、所选安装进程数为 0，资源报告 complete；不将资源清理成功记为 runtime 验收通过。

本轮局部失败的原生日志未出现 `MaxSubPackageLimit` 或 `checkAppFields`，只记录通用 simulator launch failed；相同 analyzer 错误在成功窗口的八次启动中也出现。基础库 3.17.5 在成功窗口初次启动前已存在于本地，具体宿主内部异常仍未确定；不据此修改项目配置或 runtime 断言。
