# 2026-10-08 全仓依赖升级

本轮按最新兼容稳定版评估，覆盖 235 份自有 npm manifest、268 个外部依赖名称、Rust 原生模块、独立 npm runner、GitHub Actions 与固定工具版本。npm registry、crates.io、GitHub tag 和工具官方下载元数据于 2026-10-08 查询。保持公开 API、peer 支持范围与各包最低运行环境；第三方 Dimina upstream 快照、测试历史版本及 latest 哨兵保留原意。

## 版本变化

初次评估的 Vite 候选为 8.3.3，实施时官方 registry 已发布 8.3.4，因此本轮验证 8.3.4。共调整 49 个 npm 依赖名称、78 处版本声明，另将根 packageManager 更新为 pnpm 12.10.1。下表记录直接声明，不将原有 peer 支持下限视为待升级的安装版本。

| 依赖 | 升级前声明 | 升级后声明 |
| --- | --- | --- |
| @ai-sdk/anthropic | 4.0.71 | 4.0.76 |
| @ai-sdk/openai | 4.0.83 | 4.0.89 |
| @ai-sdk/openai-compatible | 3.0.62 | 3.0.66 |
| @babel/core | ^8.0.6 | ^8.0.7 |
| @babel/parser | ^8.0.6 | ^8.0.7 |
| @babel/preset-env | ^8.0.6 | ^8.0.7 |
| @babel/preset-typescript | ^8.0.1 | ^8.0.7 |
| @babel/traverse | ^8.0.6 | ^8.0.7 |
| @devframes/agentic | 1.2.0 | 1.2.3 |
| @icebreakers/eslint-config | ^8.0.7 | ^8.0.8 |
| @iconify-json/vscode-icons | ^1.2.84 | ^1.2.86 |
| @microsoft/api-extractor | ^7.59.3 | ^7.59.4 |
| @modelcontextprotocol/client | ^2.2.0 | ^2.3.1 |
| @modelcontextprotocol/node | ^2.1.0 | ^2.1.1 |
| @modelcontextprotocol/server | ^2.2.0 | ^2.3.1 |
| @napi-rs/cli | ^3.10.6 | ^3.10.8 |
| @oxc-node/cli | ^0.1.3 | ^0.1.4 |
| @oxc-node/core | ^0.1.3 | ^0.1.4 |
| @oxc-project/types | ^0.152.0 | ^0.153.0 |
| @remotion/bundler | 4.0.532 | 4.0.534 |
| @remotion/cli | 4.0.532 | 4.0.534 |
| @remotion/renderer | 4.0.532 | 4.0.534 |
| @typescript-eslint/parser | ^8.71.0 | ^8.71.1 |
| @weapp-tailwindcss/engine | 0.1.3 | 0.1.4 |
| @weapp-tailwindcss/merge | 2.2.6 | 2.2.7 |
| ai | 7.0.127 | 7.0.133 |
| cac | ^7.0.0 | ^7.0.1 |
| cjs-module-lexer | ^2.2.1 | ^2.3.0 |
| devframe | 1.2.0 | 1.2.3 |
| dotenv | ^18.0.5 | ^18.0.6 |
| execa | ^10.0.1、10.0.1 | ^10.1.0、10.1.0 |
| ink | 7.1.1 | 8.0.0 |
| magic-string | ^1.4.2 | ^1.4.3 |
| oxc-parser | ^0.152.0 | ^0.153.0 |
| package-manager-detector | ^1.8.0 | ^1.9.0 |
| playwright | ^1.63.0、1.63.0 | ^1.64.0、1.64.0 |
| postcss | ^8.5.28 | ^8.5.29 |
| remotion | 4.0.532 | 4.0.534 |
| repoctl | 5.7.1 | 5.9.0 |
| rolldown | 1.2.12 | 1.2.13 |
| rollup | ^4.64.0 | ^4.64.2 |
| solid-js | 1.9.15 | 1.9.17 |
| theme-transition | ^2.1.1 | ^2.1.2 |
| uview-plus | 3.8.128 | 3.8.130 |
| vite | 8.3.2 | 8.3.4 |
| vitepress-plugin-group-icons | ^1.7.6 | ^1.7.7 |
| vue-router | 5.3.1 | 5.4.0 |
| weapp-tailwindcss | ^5.5.11、5.5.11 | ^5.5.12、5.5.12 |
| wrangler | ^4.147.0 | ^4.148.0 |

- Rust Oxc allocator、ast、ast_visit、parser、span、syntax 统一从 0.152.0 升至 0.153.0；napi 3.14.0 → 3.14.2，napi-derive 3.6.10 → 3.6.12。napi-build、serde、serde_json 已处于本轮最新稳定版。保持项目固定的 Rust 1.99.0，不改变用户默认工具链。
- Actions setup-node 7.0.0 → 7.1.0、upload-artifact 7.0.1 → 7.0.2、download-artifact 8.0.1 → 8.0.2，统一绑定官方 tag 对应的完整 commit SHA；其他 Actions 已为本轮最新稳定版。
- 教程安装路径的 Bun 1.2.21 → 1.4.2；runtime-size workflow 的独立 pnpm 11.18.0 与根 workspace 对齐至 12.10.1。原有 OS / Node 矩阵及明确固定的诊断、性能运行基线保留。

## 保留项与补丁

- TypeScript 保持 6.0.3。最新 7.0.2 超出 @typescript-eslint/parser 8.71.1 的公开支持范围（小于 6.1.0），已有 Compiler API、Volar 与 repoctl 兼容限制仍须共同迁移。
- pixelmatch 保持 7.2.0。8.0.0 从 YIQ 改为 OKLab / HyAB，会改变公开截图比较的 diffPixels、diffRatio 与既有门限含义，不在本轮兼容升级中更换算法。
- 保留 VitePress 2.0.0-alpha.20 与 vite-tsconfig-paths 7.0.0-alpha.3 的既有预发布基线，不降级到 registry latest 指向的旧稳定主线。
- fixtures/ts-base 的 miniprogram-api-typings 2.x 是既有兼容 fixture；公开 peer 支持范围与初始化 fixture 中的 latest 哨兵保持原样。
- Vite 8.3.4 和 Rolldown 1.2.13 的发布实现仍保留相关引用链。迁移原有补丁，保持 hook 元数据、resolver 回调与 normalized options 的生命周期契约；工作区补丁不会自动传递给独立 npm 消费者。
- uview-plus 3.8.130 的发布源码已使用组件实例 this.$nextTick() 等待 canvas 引用，移除旧条码补丁。同步生成页面、套件版本标签与网站、随包文档、公开 skill 的兼容基线。
- Ink 8.0.0 要求 React 19.3，现有 CLI 已满足；新增使用真实 Ink renderer 的流输入回归，覆盖输入提交、审批允许/拒绝、Esc/Ctrl+C 取消、空闲退出及读取监听器释放。

## 兼容处理

Vite 8.3.4 在 bundled development 中新增浏览器样式客户端出口。真实 JSX HMR 回归发现该客户端引用进入小程序产物，故在状态保持宿主插件中拦截 Vite 样式客户端，保留模板资产管线对样式输出的所有权。连续编辑仍由原生 DevEngine 发布，不手写 bundle，也不加载 DOM 客户端。

Rolldown 1.2.13 使用工厂序号拒绝旧补丁。模拟器 fixture 原先在恢复后重用第一次编辑的旧 payload，本轮改由真实引擎生成第四次编辑，并在恢复后使用新的 payload。保持重新进入页面的最新标记、组件身份、输入、计数和 store 状态断言。57 份状态保持 HMR 回归文件共 396 项通过。

## Actions 固定版本

| Action | 版本 | 完整 SHA |
| --- | --- | --- |
| actions/setup-node | 7.1.0 | 949feb2413d6458794dcd2491c4babbbce0c15c1 |
| actions/upload-artifact | 7.0.2 | cf430e030ddbb5b0abf93d22962f4752f3646cd9 |
| actions/download-artifact | 8.0.2 | 9000827ccba6bdab643e8b6fd33ac0654aef8333 |

保留现有 Windows、macOS、Linux 矩阵；本地结果仅证明当前 macOS 环境，其他 OS 结论须由实际 CI 运行提供。

## 审计与验证

升级前 pnpm audit 共 63 项，升级后为 52 项（low 5、moderate 18、high 20、critical 9）。独立 npm runner 仍为 86 项。剩余上游链路和统计口径见 [审计差异](./2026-10-08-dependency-audit.md)；522 项外部包解析版本集合变化见 [解析版本清单](./2026-10-08-dependency-resolved-versions.md)。

升级与本地验证已完成，真实 IDE 环境阻塞及未运行的 OS 矩阵另列，未完成项不计为通过。

| 验证范围 | 结果 |
| --- | --- |
| frozen pnpm 安装、独立 npm runner 的 npm ci | 通过 |
| catalog、生成脚手架 catalog、Rolldown 单版本 | 通过 |
| 包级 typecheck、公开类型 test:types | 39、33 个任务通过 |
| 全仓单测 | 1,606 个文件通过，13 个文件跳过；14,985 项通过，19 项按原配置跳过 |
| Ink 真实 renderer 的输入、审批、取消、退出及监听器释放 | 5 项通过 |
| 状态保持 HMR 定向回归 | 57 个文件、396 项通过；宿主注册修正后的 7 个文件、56 项通过 |
| 包构建、网站构建、独立 socket-io / VS Code 构建 | 通过 |
| 应用与模板构建 | 最终源码后的 75 个任务全部通过 |
| 六平台代表性构建 | 7 个文件、38 项通过 |
| headless gate | 6/6 个任务通过 |
| headless 状态保持 HMR 定向覆盖 | 11 项通过、5 项按筛选跳过；DOM suite 为 partial/incomplete，不计作完整门禁通过 |
| headless JSX HMR、React runtime | 1 项、3 项通过 |
| Web 浏览器 suite（包含 uView 兼容与视觉覆盖） | 17 个文件、122 项通过；使用 Playwright 1.64.0 配套 Chrome 156.0.8078.4 |
| pnpm/npm 严格消费者安装及 TypeScript/CSS 语义 | 通过 |
| Agent CLI 打包消费者与无模型验收 | 通过 |
| Vite/Rolldown hooks、watch、关闭及引用释放契约 | 通过 |
| native correctness 与 fallback | Rust 1.99.0 release 构建及 55 项 JS native 测试通过，JS fallback 单测通过；Cargo 锁定测试命令通过，当前 crate 无内置 Rust 测试 |
| 改动范围的 ESLint、SFC Stylelint、发布一致性 | 通过 |

native release profile 在固定 Rust 1.99.0 上完成，160 次测量、20 次预热。组合分析 JS 基线 5.246 ms、native 0.206 ms；直接批量调用 0.109 ms，8 份源码批量调用 0.800 ms。先前在 Rust 1.98.1 上的组合分析为 JS 5.086 ms、native 0.212 ms。该结果来自既有 profile fixture，不用于扩大 native 覆盖；显式启用、粗粒度批量接口及 JS fallback 保留。官方工具链组件按官方 SHA 核验，额外下载的 crate 按 Cargo.lock 校验；最终 Cargo 测试使用 `--locked --offline`，release 构建未改变固定工具链或用户默认工具链。

Remotion 4.0.534 的 typecheck、四个 composition、静帧、四支完整影片渲染及 verify 全部通过，验证范围包含尺寸、帧数、时长、编码、faststart 与音频响度。默认 Chrome Headless Shell 157.0.8080.0 两次独立复现加载超时；同一源码和 Remotion 版本使用本机完整 Chrome 可运行，未以更换依赖版本或放宽校验规避限制。影片的视觉和听感审阅不属于本轮依赖技术验证。

### 真实 IDE 验收限制

2026-10-08T13:26:15Z 与复核运行均从官方配置查询 Stable 2.02.2608080，并核验所选安装和连接宿主一致，未使用旧版本 opt-in。已连接场景记录基础库 3.17.3 / 3.17.4。IDE gate 的首屏及生命周期任务通过；路由任务第一项通过，但临时路由拓扑项目在模拟器初始化阶段失败，日志订阅连续 8 次超时，返回 `E2E_RUNTIME_LOG_SUBSCRIPTION_DEADLINE`。全量 gate 仅执行 3/8 个任务，其中 2 个任务通过，不能宣称 gate 通过。

首次诊断选择 UI 时重新激活了正在退出的空闲宿主，导致退出核验失败；已在机器互斥保护下通过正常退出菜单关闭，独立核验本任务宿主 PID、登记端口和机器租约均已释放。随后使用同一 Stable 安装正常复核，仍在同一临时项目初始化阶段失败。Computer Use 确认窗口显示“模拟器启动失败”、页面路径为空，未进入待验收页面。复核后的受管收尾正常完成，未强杀或清理全局用户缓存。

保留上述环境失败，暂停后续真实 IDE HMR、JSX、React 与 uView 场景；这些真实 IDE 验收尚未完成。未更换 IDE 渠道或版本，未修改 fixture/app.json 绕过宿主初始化，未弱化断言。headless 和浏览器结果单独列示，不能替代真实 IDE 结果。Windows/Linux 矩阵尚未运行，本轮无跨平台通过结论。
