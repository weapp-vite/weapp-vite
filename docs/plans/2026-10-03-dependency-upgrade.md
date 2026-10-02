# 2026-10-03 依赖升级与兼容迁移

本轮盘点 233 份 package manifest、268 个外部依赖名称，覆盖 npm workspace、Cargo、独立 npm runner 和 GitHub Actions。首轮目标为最新稳定且兼容的版本，保持当时各包的 Node、公开 API、类型和 VS Code 支持底线；后续已确认的 Node 与环境展开策略修订见下节。版本信息于 2026-10-03 查询官方 npm registry、crates.io 和上游 Actions release。

## 后续策略修订

首轮升级记录形成后，用户确认继续迁移至 Execa 10.0.1 与 dotenv-expand 1000.0.0，接受相应运行要求与环境文件语义变化：

- acceptance 的直接 Execa 由 9.6.1 升至 10.0.1；`@weapp-vite/acceptance` 和 `@weapp-vite/mcp` 的 Node 范围由 `^20.19.0 || >=22.12.0` 改为 `>=22.12.0`，其他包的 Node 范围不因本次修订改变。
- 上传环境文件采用 dotenv-expand 1000.0.0 的官方展开语义：`$(...)` 自动执行命令替换，提供 `DOTENV_PRIVATE_KEY` 时解密 `encrypted:` 前缀值。该版本没有公开禁用开关，反斜杠也不能阻止命令替换。
- 新增直接依赖 `dotenv ^18.0.5`，仅调用保留声明顺序的纯 `parse`，不调用会加载配置或展开环境的入口。原生 `parseEnv` 会按键排序，回归由此发现命令可能重复执行、引用可能拿到原密文；逐文件合并时先删除旧键再赋值，保留最后生效声明的位置，让后续引用复用命令输出和解密结果。
- 已有进程同名值（包括空字符串）在展开前排除对应文件值，保持原样最高优先级，不执行被覆盖文件值的命令替换或解密；文件优先级和不修改 `process.env` 的契约保留。`envDir: false` 完全跳过此入口的环境文件加载与展开。
- 含字面 `$(...)` 的凭据直接通过 CI Secrets 或进程环境提供，并避免从其他文件变量再次引用；引用展开后的命令文本仍可能执行。网站与随包上传文档同步这一边界。
- 单层反向引用保留，但不保证任意多级反向链递归展开：`A=$B`、`B=$C`、`C=value` 在新版得到 `A=$C`、`B=value`、`C=value`。多级引用应先声明基础值，再声明依赖它的变量。默认值与替代值也按新版语义区分 unset / empty：空变量的 `${VAR-fallback}` 为空、`${VAR:-fallback}` 为 fallback、`${VAR+alternate}` 为 alternate、`${VAR:+alternate}` 为空。
- 独立硬超时探针确认上游在带后缀的循环引用下可能同步无限循环。因此上传指南要求引用无环，同一文件避免重复声明，覆盖值放入更高优先级文件；这是配置约束，不宣称新版具备循环检测或自动恢复。

以下版本表、审计计数、引擎闭包和首轮验证记录保留**首轮快照**含义，包括 dotenv-expand 13.0.0、acceptance 的 Execa 9.6.1 与 Node 20 兼容结论。后续迁移的独立验证如下：

- `pnpm install --frozen-lockfile --ignore-scripts` 与 `node scripts/postinstall-sync.mjs --check` 通过。锁文件只保留本次 Execa、dotenv-expand 及新增 dotenv 的依赖变化。
- acceptance 包级测试 19 项、MCP acceptance 集成测试 6 项、上传目录 13 个文件 / 137 项测试通过，共 162 项。覆盖真实进程树取消与超时、超时后零退出码仍判失败、环境覆盖、跨文件解密引用、命令只执行一次及 unset / empty 语义。
- acceptance、MCP、weapp-vite 的包级 typecheck、build 和 test:types 均通过。实际 Node 22.12.0 下通过 acceptance / MCP 公开构建入口、成功与失败命令、取消后的父子进程退出，以及 MCP 服务创建 / 关闭冒烟。
- `pnpm --filter website-weapp-vite build` 通过，生成的上传页面包含最新迁移约束；随包文档通过既有同步脚本刷新。变更文件 ESLint、changeset frontmatter 与差异检查通过。
- 发布预演保持 weapp-vite / wevu 固定组为 7.5.0 minor；MCP 因取消 Node 20 支持记录为 2.0.0 major，acceptance 为 0.1.0 minor，并联动 create-weapp-vite patch。
- 本次验证为 macOS 本地结果，未运行完整根单测、E2E 或 Windows / Linux 矩阵；未替代下文首轮仍待完成的 runtime 验收。上游循环引用风险按前述配置约束记录，未宣称已修复。

## 首轮兼容边界

- TypeScript 保持 6.0.3。7.0.2 不再提供旧 Compiler API，最新 ESLint parser、repoctl、Volar 与 Vue SFC 类型检查尚不能共同迁移。
- dotenv-expand 升至 13.0.0：官方 tarball 的变量展开实现与 12.0.3 完全相同，仅更新 dotenv 依赖。1000.0.0 自动执行命令替换及解密，不适用于当时的上传凭据契约。回归覆盖字面命令文本、加密前缀、转义、默认值、环境覆盖及不修改 process.env。
- acceptance 使用 Execa 9.6.1，保持 Node 20 支持；IDE CLI 和 Dimina 自有工具使用 10.0.1。公开 peer 范围不收窄。
- 保留 VitePress 2.0.0-alpha.20、vite-tsconfig-paths 7.0.0-alpha.3 的现有兼容基线；不降级、不引入新的预发布依赖。
- Dimina upstream 为独立上游快照，保留其固定 commit、工具链和锁文件。初始化 fixture 的 latest 哨兵、local file/workspace 依赖和上游来源标记维持原有测试语义。
- Rolldown 保持 1.2.12，保留 catalog override 与单版本检查；Vue、React、Babel 等已到本轮稳定目标的依赖不重复改动。

完整的 533 项 pnpm 项目依赖版本集合变化和 75 项独立 npm runner 变化见[解析版本对照](./2026-10-03-dependency-upgrade-versions.md)。以下列出首轮直接声明的变化，后续修订不回写这份历史快照。

## 首轮直接依赖版本

| 依赖 | 升级前声明 | 升级后声明 |
| --- | --- | --- |
| @ai-sdk/anthropic | 4.0.68 | 4.0.71 |
| @ai-sdk/openai | 4.0.81 | 4.0.83 |
| @ai-sdk/openai-compatible | 3.0.59 | 3.0.62 |
| @icebreakers/eslint-config | ^8.0.3 | ^8.0.7 |
| @icebreakers/stylelint-config | ^5.1.2 | ^5.1.3 |
| @napi-rs/cli | ^3.10.5 | ^3.10.6 |
| @npmcli/config | ^11.1.0 | ^11.2.0 |
| @shikijs/engine-javascript | ^4.4.3 | ^4.5.0 |
| @shikijs/langs | ^4.4.3 | ^4.5.0 |
| @shikijs/themes | ^4.4.3 | ^4.5.0 |
| @shikijs/vitepress-twoslash | ^4.4.3 | ^4.5.0 |
| @swc/core | 1.16.2、^1.16.2 | 1.16.13、^1.16.13 |
| @tanstack/vue-query | ^5.104.0 | ^5.104.1 |
| @types/node | ^26.6.3 | ^26.6.4 |
| @types/react | ^19.2.0 | ^19.3.0 |
| @types/react-dom | ^19.2.0 | ^19.3.0 |
| @types/react-reconciler | 0.33.0 | 0.33.1 |
| @types/vscode | ^1.138.0 | ^1.140.0 |
| @types/ws | ^8.18.1 | ^8.18.2 |
| @vitest/browser-playwright | 5.0.2 | 5.0.3 |
| @vitest/coverage-v8 | ~5.0.2 | ~5.0.3 |
| @vue/language-core | ^3.3.11 | ^3.3.12 |
| @vue/language-plugin-pug | ^3.3.11 | ^3.3.12 |
| ai | 7.0.122 | 7.0.127 |
| autoprefixer | ^10.4.20 | ^10.6.1 |
| devframe | 1.1.0 | 1.2.0 |
| dotenv-expand | ^12.0.3 | ^13.0.0 |
| element-plus | ^2.14.6 | ^2.14.7 |
| execa | ^9.6.1、9.6.0 | ^10.0.1、9.6.1、10.0.1 |
| hono | ^4.13.10 | ^4.13.12 |
| lodash | ^4.17.21 | ^4.18.1 |
| memfs | ^4.79.0 | ^4.80.0 |
| mermaid | ^12.0.0 | ^12.1.0 |
| oxc-parser | ^0.151.0 | ^0.152.0 |
| packageManager | pnpm@12.6.0 | pnpm@12.8.1 |
| postcss | ^8.4.47 | ^8.5.28 |
| repoctl | 5.5.7 | 5.6.0 |
| rollup | ^4.63.5 | ^4.64.0 |
| sass | ^1.105.0 | ^1.105.1 |
| sass-embedded | ^1.105.0 | ^1.105.1 |
| shiki | ^4.4.3 | ^4.5.0 |
| stylelint | ^17.15.0 | ^17.16.0 |
| supertest | ^7.3.0 | ^7.3.1 |
| tdesign-miniprogram | latest | catalog: |
| turbo | ^2.11.5 | ^2.11.7 |
| uview-plus | 3.8.125 | 3.8.127 |
| vite | 8.3.1 | 8.3.2 |
| vitest | ~5.0.2、5.0.2、^5.0.2 | ~5.0.3、5.0.3、^5.0.3 |
| vue-tsc | ^3.3.11 | ^3.3.12 |
| weapp-tailwindcss | ^5.0.4 | ^5.5.11 |
| wrangler | ^4.143.0 | ^4.147.0 |

普通 mixjs fixture 的 TDesign 浮动 latest 改为既有 catalog，统一可复现的安装来源。`glass-easel-miniprogram-adapter` 的声明仍为 `^1.2.0`，锁文件解析由 1.2.0 更新为 1.2.1；该变化列在解析版本对照中，不属于直接声明变更。

## 原生模块与补丁

- Rust Oxc allocator、ast、ast_visit、parser、span、syntax 从 0.136.0 统一升级至 0.152.0。
- napi 3.9.2 → 3.14.0；napi-derive 3.5.6 → 3.6.10；napi-build 2.2.3 → 2.6.0；serde 1.0.228 → 1.0.229；serde_json 1.0.145 → 1.0.151。
- 原生模块使用独立 Rust 1.99.0 工具链，保持显式启用、批量分析及 JS fallback，不修改用户全局 Rust 默认版本。
- uview-plus 3.8.127 上游仍需条码组件实例 $nextTick 补丁；迁移版本绑定，并同步组件生成器、展示内容和补丁说明。
- React 文档、网站、公开 skill 和脚手架说明同步实际 React 19.3 / reconciler 0.34 基线，公开 peer 支持范围保持原样。

## 兼容迁移

- React renderer 对齐新版 HostConfig 类型，补齐不支持宿主 View Transition 时的提交 hook。新增 startTransition 回归先复现缺失方法异常，再验证异步更新成功；公开 API 不变。
- Vue language-core 新增编译选项解析结果，Volar 测试使用官方 CompilerOptionsResolver 构造 fixture，避免手写完整接口随版本漂移。
- Oxc 的 fatal_error 与 ArrowFunctionBody 结构更新由 native visitor 适配，保持单次解析和批量返回；新增 8 个回归。现有 AST profile 误传 Babel Program，已与正式转换入口统一传 File，并覆盖宏绑定及导入清理。
- 统一 pnpm 锁文件读取，按官方多文档格式区分包管理器引导文档与实际项目图；兼容单文档、BOM 和 CRLF，非法项目文档继续报错。
- uView 新增 u-flex，解析器支持 u-/up- 两种前缀，场景矩阵、页面和 DevTools 条件列表同步到 138 个组件。
- repoctl 5.6 将 registry 查询失败且错误文本为空的情况视为 unknown，并禁止在此状态下重传。发布测试的“版本不存在”夹具改用真实 E404 输出，另补空错误及 E503 的 unknown 状态回归，保持禁止重复上传的契约。
- 时间相关测试改用受控时钟：动态 React HMR 交付保留注册请求耗尽 deadline 时拒绝交付的断言，automator 连接保留读取会话元数据消耗总超时预算的断言；不放宽生产 deadline 或以机器调度速度作为通过条件。
- native lib.rs 和现有 profile 脚本超过 300 行；此次保留批量 visitor 和分阶段采样的既有边界，避免将依赖迁移扩大为文件重组。

## CI 与锁文件

- cache 6.1.0、setup-bun 2.2.0、codecov 7.1.1、upload-artifact 7.0.1 均使用核实的固定 SHA；保留现有 OS / Node 矩阵。
- pnpm 更新保持 catalog 引用及原有版本范围形式，刷新兼容范围内的间接依赖；通过现有生成脚本同步 workspace、weapi 和脚手架 catalog。
- 独立 miniprogram-ci runner 已为最新 2.1.31，维持独立 npm 锁文件；验证不执行 preview 或 upload。
- 发布元数据检查暴露 5 个包在基线已有的缺项：acceptance、agent CLI、HMR、Tailwind 控制器和 json-render-components。按同仓现有项目地址、issues 入口、关键词及 npmjs public 发布配置补齐；未改变依赖、导出或运行时行为。
- minidev 2.2.5 已为最新，其 request、decompress、ip 以及旧 tar / got / 代理依赖链仍有上游未修复问题。vm2 在 degenerator 的原有 ^3.9.17 范围内刷新至 3.12.2，不保留覆盖。
- 其他受上游精确版本或窄范围限制的审计项：repoctl 的 pnpm 子包链固定 @yarnpkg/shell 4.0.0 → cross-spawn 7.0.3、adm-zip 0.5 和 UUID 9；cos-wx-sdk-v5 1.8.0 固定 fast-xml-parser 4.5.0；monaco-editor 0.57.0 固定 dompurify 3.4.15；miniprogram-simulate 保持 PostCSS 7；request 限制 form-data ~2.3.2、旧 qs / cookie / UUID。保留上游声明，不用跨范围覆盖隐藏告警。

## 首轮验证记录

验证分为原工作区的定向检查和隔离 worktree 的最终复核。原工作区后续出现其他任务并发修改源码与 dist，因此将本任务改动迁至以 `90ff982d7` 为基线的隔离 worktree，并重新安装、构建和验证。以下分开记录已经完成的证据、主动中断的运行与仍待执行的项目；迁移前通过的局部检查不能替代隔离后的完整回归结果。

### 原工作区已完成检查

- Node 支持范围：234 个受版本控制的 manifest 对比确认 engines 未改动；对 42 个可发布包的 runtime / optional 依赖闭包检查 5614 个节点，未解析节点为 0，未发现新增引擎范围冲突。该结论来自依赖元数据比较，尚未在各包最低支持的 Node 或 VS Code 版本上实际运行。
- 包类型检查：React 和其余受影响包通过；公开类型契约 30 个非 React 包、43 条 tsd 命令全部通过，React 新 dist 的 tsd 另行通过。
- 定向回归：React renderer 8 项、Volar 34 项、组件 resolver 23 项、锁文件/脚本相关 39 项、上传环境 4 项通过。
- native：隔离 Rust 1.99 的 cargo check/test --locked、release binding 构建、debug/release 各 55 项 correctness/fallback 测试、lint、profile 单次回归和完整 profile 通过。Rust 本身暂无独立单测。实测 JS 三项分析 14.750ms、native 0.912ms、单次 batch 0.236ms；共享机器负载下只作为兼容与现有性能验证，不扩大 native 默认使用范围。
- 第一轮包构建：45/45 build 任务成功，包含 Dashboard 与 SFC playground；该范围不等于所有应用、模板和网站均已构建。
- Dashboard typecheck、ESLint 与 Stylelint 通过。
- 最终锁文件下的网站构建通过，耗时 75.93 秒；这是静态生成结果，Mermaid 浏览器交互仍待单独验证。
- VS Code 扩展 typecheck、`check:publish` 与 `check:vsix` 通过：24 个测试文件、194 项测试，包含 ESLint、构建、mock 激活、发布包清单和 VSIX 内容检查。使用缓存中的 vsce 3.9.2 离线打包，不安装或启动 VS Code 宿主、不发布扩展；`engines.vscode` 仍为 `^1.88.0`。
- 迁移前 frozen-lockfile 安装通过；项目图 173 个 importer、3157 个 registry 包，TypeScript 无 7.x，Vite 统一 8.3.2，Rolldown 仅 1.2.12。独立 npm runner 刷新锁文件后 npm ci 通过。
- 严格消费者验证：`packages/weapp-vite/scripts/verify-dependency-install.mjs` 在 pnpm 和 npm 路径均以退出码 0 完成，启用 `strictPeers` 与 `engineStrict`；TypeScript 6 的 default / native / advanced 消费模式均为 0 diagnostics，CSS 语义保持一致。npm 消费者项目的 audit 告警为 0，仅代表该消费者依赖图；独立 miniprogram-ci runner 仍有 75 项告警，两者不混用。
- pnpm audit 告警从 low 6 / moderate 36 / high 37 / critical 17（共 96）降为 3 / 20 / 21 / 5（共 49）；仍受上游约束的链见前文。告警不是零，不将依赖升级表述为消除全部漏洞。
- fresh 解析后 Devframe 版本相关 peer 告警已消失；其余为既有 repoctl 的 pnpm 内部 peer、不支持 TS6 的 unbuild peer、graphql-request 与 GraphQL17、Mermaid/VitePress 插件声明范围。未添加忽略规则或缩小公开 peers。

### 隔离复核与中断记录

- 原工作区的根单测及 `pnpm build:apps` 均因其他任务并发修改源码/dist、存在验证互相干扰风险而主动中断，退出码均为 130；对应运行未完成，不计为通过，也不据此判断产品失败。中断前未启动 E2E。
- 隔离 worktree 的 `pnpm install --frozen-lockfile` 已通过，耗时 32 秒；补齐发布元数据后再次冻结安装通过，耗时 83.1 秒。
- 隔离 worktree 的 `pnpm build:pkgs --concurrency=2` 已完成，45/45 build 任务通过。
- 隔离后的 catalog、Rolldown 单版本、生成 AGENTS、公开 skills、DOM inventory 检查及 64 个文件的精确 ESLint 均通过。
- 补充扫描应用 manifest 时，`apps/vite-native/package.json` 的既有 lodash 声明触发 e18e 建议告警；该应用不属于现有 lint-staged 范围。本轮未修改 lint 规则或删除示例依赖，最终提交按仓库既有范围执行 ESLint 与 Stylelint。
- 补齐既有元数据缺项后，`pnpm check:npm-package-metadata` 通过，42 个可发布包的元数据与构建入口均有效；5 个 manifest 和本报告的精确 ESLint 通过，未执行发布。
- 根全量单测已运行结束，耗时 1528.59 秒：1417 个测试文件中 1401 通过、4 失败、12 跳过；12895 项测试中 12871 通过、6 失败、18 跳过。失败集中于已定位的 4 个文件，不能将该次全量运行记为通过。
- 修复后的定向回归已通过：发布流程 2 个文件 / 14 项、动态交付 17 项、profile 1 项、automator 3 项。发布夹具与受控时钟迁移保留原语义和 deadline 断言；没有再次执行全量单测，因此结论为“全量发现的失败已完成定向复核”，而非“全量重跑全绿”。
- 隔离环境新增验证通过：mjs 套件 4 个文件 / 52 项、native correctness/fallback 55 项，以及 native、profile 与 CLI 相关类型检查。
- 隔离环境最新 profile：`sequentialAll` 的 JS 为 9.307ms、native 为 0.403ms，`directBatch` 为 0.308ms，`multiBatch8` 为 1.155ms。本次采样处于共享机器负载下，仅确认迁移后的实现可运行和现有路径性能，不据此宣传稳定速度或扩大 native 默认覆盖。
- 隔离 worktree 的应用/模板、聊天示例独立入口和网站构建已通过；下表记录覆盖范围及未执行的运行时验证。

| 检查范围 | 入口与边界 | 当前状态 |
| --- | --- | --- |
| 应用与模板构建 | `pnpm build:apps --concurrency=2` 同时选择 `apps/*` 与 `templates/*`，包含 30 个应用、12 个模板的 `build` 及其上游构建依赖 | 隔离复核 75/75 任务通过，27 项缓存，耗时 105.788 秒 |
| 独立应用脚本 | `socket-io-chat` 只有 `build:mini` / `build:web`，不在通用 `build` 任务中；其余无 `build` 的应用为 `playground`、`miniprogram-ts-quickstart`、`rollup-watcher` | 聊天示例两项构建均通过，4 个小程序页面及 Web 入口、JS 产物完整；其余无构建入口的应用不宣称覆盖 |
| 多平台构建 | 多平台应用与模板的默认 `build` 仅选择 weapp，不能替代其 alipay / tt / swan / jd / xhs / web 脚本 | 六平台矩阵未验证 |
| 网站构建与 Mermaid | 先 `pnpm --filter website-weapp-vite build`，再 `pnpm --filter website-weapp-vite test:browser tests/theme.spec.ts --grep '^Mermaid '`；现有单 worker headless 场景检查 7 张图首次渲染、主题切换、客户端导航及页面错误 | 隔离构建复核通过，耗时 24.60 秒；Mermaid 浏览器回归未执行 |
| React 与 uView headless runtime | 重建相关包后，使用现有 provider-compatible 的 `react-runtime-spike.runtime.test.ts` 与 `uview-plus-compat.runtime.test.ts`；uView 需要显式选择对应套件 | 待同机全局串行窗口执行，未标记 runtime 通过 |
| uView Web 交互与截图 | `e2e/web-runtime/uview-plus-compat.test.ts`；新增 `up-flex` 与版本内容变化需通过真实渲染核对基线 | 待执行 |
| 真实 WeChat DevTools runtime | 必须使用已核实的 stable 安装，确认实际连接宿主和基础库后验证相关场景 | 环境阻塞，未完成最终 runtime 验收 |

所有 E2E 与浏览器验证由一个执行者统一串行运行并收尾；隔离目录本身不解除同一用户会话的全局串行约束。收尾时，同机其他会话持续运行 headless / 真实 DevTools stateful HMR E2E，以及独立项目的长期 dev-watch 服务。本任务未启动任何 E2E，也未终止这些非本任务资源。用户选择记录环境阻塞并先完成本地提交；因此构建/HMR E2E、六平台矩阵、模板首屏、React / uView headless、Web / Mermaid 浏览器及真实 IDE 场景均保留待验收状态，不将根单测中的 HMR 集成测试或静态构建结果替代上述运行时验收。

### 真实 IDE 环境

2026-10-03 01:41:42（Asia/Shanghai）核对[官方下载页](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)及其动态 channels 配置：最新 stable 为 2.02.2608080，发布日期 2026-09-30；2.02.2609231 属 RC。已隔离解包官方 ARM64 stable，Tencent 签名、Apple 公证和应用完整性校验通过。通过稳定版完整路径两次调用 Computer Use 均 timeoutReached；读取现有安装 AX 成功，确认实际宿主仍为 RC 且打开另一项目。保留该共享窗口，未关闭或替换用户会话。当前真实 IDE 场景未执行、实际连接基础库未取得，不能标记 runtime 通过。

### 平台范围

本地为 macOS ARM64，保留原 Windows/macOS/Linux CI 矩阵；未推送或触发远程 CI，Windows/Linux 的执行结果尚未验证。
