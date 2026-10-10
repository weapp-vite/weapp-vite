# @weapp-vite/mcp

## 2.0.0

### Major Changes

- feat(upload)!: 升级上传、预览和验收命令的配置、环境变量及超时契约；MCP 升级为 major，验收包与 MCP 最低 Node.js 版本调整为 22.12.0。

  - 验收迁移至 Execa 10，取消或超时同时清理本次后代进程，超时后即使子命令返回零退出码也记录失败。
  - 上传/预览迁移至 dotenv-expand 1000，环境文件支持命令替换，以及提供 `DOTENV_PRIVATE_KEY` 时解密 `encrypted:` 值；区分空值和未设置变量，解析及跨文件覆盖遵循有效声明顺序，引用复用命令输出和解密结果。
  - 已有进程变量（包括空字符串）优先，不执行被覆盖的文件值且不修改全局环境。迁移时请先声明基础变量；需要原样传入包含命令文本的凭据时使用 CI Secrets 或进程变量，不经文件二次引用。

### Minor Changes

- feat(acceptance): 补齐确定性验收、Doctor、构建产物与 HMR profile 的可追溯证据，未知或未完成测量不再被记录为成功或零耗时。

  - 复用现有 MCP/runtime 会话提供无模型检查、任务管理和当前代码证据；任务在项目锁释放后再发布完成状态，Windows 报告原子替换遇短暂占用时限时重试并保留持久化与清理错误。
  - 共享 Doctor CLI/API 分离默认只读静态检查、显式构建产物和已打开宿主页面探针，提供终端、JSON、SARIF 与完整性退出码；复用平台兼容及预算规则，修正 runtime ESLint 对自定义实例方法和数组/字符串同名方法的误报。
  - analyze 产物清单按实际模块所属包区分 runtime、业务及混合输出，保留分包复制来源，明确实际字节、模块分摊估算与未归因部分；新增 runtime 文件上界和单包预算，缺测拒绝报告通过，失败关联具体文件，JSON 构建/清理日志走 stderr。
  - profile 固定版本、会话、构建、多文件批次及实际生产者身份，记录源事件、准备、提交等待、提交和发布，区分 classic/stateful 边界；失败、缺失阶段、未知版本和未完成批次不计成功，嵌套阶段不重复累加，保留旧 JSONL 兼容和残差估算口径。

### Patch Changes

- fix(acceptance): 修复 Doctor 会话清理、HMR profile 交接与测试产物缓存的归属和失效边界。

  - Doctor 分阶段保存宿主事实及脱敏清理证据，共享总预算；工具信息失败仍保留已连接事实，释放本次连接而不误删持久化会话。原生 CLI 登录查询仅显式启用，只采信布尔结果，超时或无效响应保持未知。
  - 拓扑替换独立移交原始计时与时钟，仅在完整产物发布后结算；保留重启失败、交接失效和关闭诊断。畸形枚举记录被跳过而不影响后续合法样本，异步写入使用已固定快照。
  - profile 监听只排除实际启用的输出文件，避免失败重建自触发；关闭 profile 时同名用户文件及相邻源码仍可触发更新。
  - 测试产物按进程、配置和 generation 隔离，基于源码、配置依赖和产物内容验证缓存，避免旧结果复用或覆盖在用产物；内容摘要去重重复通知，保留显式重建、构建中再编辑、合并更新、可等待关闭及过期缓存失败隔离。

- fix(devtools): 统一微信开发者工具安装、连接、受管窗口和机器租约的所有权，避免连续验证残留窗口或误清理用户项目。

  - 显式 CLI 选择贯穿安装、HTTP 端口、会话与恢复；同机跨工作区互斥，保留登录数据和其他安装连接。命名会话动态端口可正确重连，关闭保留项目路径与 CLI 参数，验收可等待宿主编译完成。
  - 启动、连接、版本/App ready、登录提示及有限重试共享总截止时间和取消信号，隔离迟到结果，移除就绪后固定等待；只释放本次持有的连接、CLI 子进程和端口。
  - 通过官方回执区分新建/复用窗口，journal 独立核验所有权并覆盖断连、失败及工作进程退出。默认整个受管任务及子任务最多一个窗口，双项目场景可明确申请两个；同一项目只能连接已登记端点，归属未确认或超额时停止后续启动。
  - 启动与关闭共用作用域门禁及登记锁，子作用域登记 borrower；中断后先核验子任务停止再回收，清理未完成继续阻断下一轮。原子租约变更保留等待预算，防止旧 owner 查询期间误删新锁。
  - 窗口销毁证据绑定已核验主进程及完整日志设备号/inode，支持 BACKEND 开头、日志轮换和同主进程多份有效日志。固定流内核对关闭及双销毁事件、窗口/WebContents/端口释放，拒绝不安全大小或游标及其他日志冲突，不因辅助日志新增而重复关窗。
  - 显式恢复核对原租约、封存 scope、精确 cleanup 绑定及已停止后代；安装退出恢复在原任务停止、安装身份一致、全部所选安装进程和登记端口消失后，可终结未知启动资源及失败关窗记录。普通未知归属仍拒绝清理，失败保留首错、销毁证据和阻塞。
  - 恢复操作只在原始 scope 和完整接管快照一致的回调中授权；等待在途领域操作结束，回调后不延长授权。Windows guard 的 EPERM 沿原预算重试，不删除其他持有者的锁。
  - Windows 身份查询保留有界首次 PowerShell/CIM 初始化预算、取消和严格比较，不永久缓存查询失败；journal 当前 writer 使用 Process API 与严格 UTF-8 文本，保留既有启动时间和十秒预算，支持中文安装路径。
  - 打开、重连和截图恢复仅重试目标连接；显式关闭失败不扩大到应用退出或按进程匹配清理。受管 automator 延迟加载，配置、恢复诊断走 stderr，保持 JSON stdout 可解析。

- perf(runtime): 按实际启用能力延迟加载可选插件与 Node 运行时，降低普通 CLI 和小程序构建的启动开销。

  - 仅在实际启用时加载 Web、Tailwind、高级路径、Dashboard、MCP 与 automator 依赖；保留同步配置 API、公开导出和包含延迟初始化的总超时预算，MCP 默认配置统一到共享常量。

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

- Updated dependencies:
  - @weapp-core/constants@0.3.1
  - @weapp-vite/acceptance@0.1.0
  - @weapp-vite/devtools-runtime@0.5.0

## 1.5.8

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 升级 Vite、Rolldown、Tailwind 构建链及 Dashboard、MCP、自动化工具的相关依赖，保持共享依赖版本一致，并同步脚手架模板使用的依赖 catalog。迁移 uview-plus 3.8.125 兼容补丁，仅保留条码实例 $nextTick 等待。保留 TypeScript 6 与现有环境变量展开语义。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：dependencies.glass-easel-template-compiler
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
  - @weapp-vite/mcp：dependencies.@modelcontextprotocol/server、devDependencies.@modelcontextprotocol/client
  - @weapp-vite/tailwindcss：dependencies.@weapp-tailwindcss/engine
  - weapp-ide-cli：dependencies.@modelcontextprotocol/server
  - weapp-vite：dependencies.@weapp-tailwindcss/engine
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.24

## 1.5.7

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.23

## 1.5.6

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：tsx, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：oxc-parser。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：devDependencies.tsx

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast：dependencies.@oxc-project/types

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.22

## 1.5.5

### Patch Changes

- 升级 weapp-tailwindcss 至 5.5.6，同步工作区默认依赖、固定版本回归环境及脚手架模板映射，使新建项目与仓库验证使用一致的 Tailwind 集成版本。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @types/node, eslint, lru-cache。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - weapp-vite：dependencies.@babel/preset-env
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.21

## 1.5.4

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.20

## 1.5.3

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.19

## 1.5.2

### Patch Changes

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.18

## 1.5.1

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：happy-dom, tsx, uview-plus, weapp-tailwindcss, zod。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

## 1.5.0

### Minor Changes

- 将 MCP 服务端升级至 TypeScript SDK v2 并显式支持 2026-07-28 协议；stdio 与 HTTP 保持旧客户端兼容，HTTP 增加 Host/Origin 防护，并新增 XPath 元素查询工具。

### Patch Changes

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.17

## 1.4.16

### Patch Changes

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.16

## 1.4.15

### Patch Changes

- Updated dependencies:
  - @weapp-vite/devtools-runtime@0.4.15

## 1.4.14

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.14`

## 1.4.13

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.13`

## 1.4.12

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.12`

## 1.4.11

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.11`

## 1.4.10

### Patch Changes

- 🐛 **修复真实微信开发者工具自动化中的会话复用、页面重启、日志收集与截图清理稳定性问题，避免 `forwardConsole` 重复连接现有会话，并降低完整 IDE E2E 在组件库和 GitHub issue 回归场景中的重复启动成本。** [#770](https://github.com/weapp-vite/weapp-vite/pull/770) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.10`

## 1.4.9

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.9`

## 1.4.8

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.8`

## 1.4.7

### Patch Changes

- 🐛 **增强微信开发者工具真实运行时与自动化链路稳定性。新版 DevTools 中 Page 域 RPC 超时后，页面查询、数据读取、setData 和页面方法调用会降级到 App-Service route 查询，避免自动化探针长期卡住；同时完善真实 DOM 与运行时状态验收，降低 request globals 场景的 setData 传输体积，并保持 native 加速能力缺失时的回退路径。** [`1f62703`](https://github.com/weapp-vite/weapp-vite/commit/1f62703e60b9db5223ef349ad4dff7ac4f16bdfc) by @sonofmagic

- 🐛 **修复微信开发者工具真实运行时中的插件页面识别、插件路由跳转、选择器查询、WXML 读取与页面栈切换稳定性，并确保 Wevu 组件注册在默认导出前完成。IDE 自动化现在会对受限协议提供明确的降级证据，同时保留真实路由、DOM 状态和构建产物验收。** [`99a816a`](https://github.com/weapp-vite/weapp-vite/commit/99a816ab79b0d93aed711a5b54f4ae4b0a4a86e3) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.7`

## 1.4.6

### Patch Changes

- 📦 **Dependencies** [`cd13a17`](https://github.com/weapp-vite/weapp-vite/commit/cd13a176f129a82cf6e4b58a5ba7449d77bd2175)
  → `@weapp-vite/devtools-runtime@0.4.6`

## 1.4.5

### Patch Changes

- 🐛 **增强 DevTools 截图链路的超时与可恢复失败重试能力，避免 IDE 自动化、MCP runtime 截图和 `weapp-ide-cli screenshot` 在 `App.captureScreenshot` 暂时无响应或返回截图失败时直接中断。** [`1e8dc3d`](https://github.com/weapp-vite/weapp-vite/commit/1e8dc3d5dfa0cbbb409b304c2dc3ebac97b7443b) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.5`

## 1.4.4

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.4`

## 1.4.3

### Patch Changes

- 🐛 **修复多个 TailwindCSS 模板同时执行 `pnpm dev:open` 时，截图、MCP 与其他微信开发者工具联动可能连接到默认全局 automator 端口或其他项目窗口的问题。开发态普通 open 后会为真实项目根目录准备独立的默认 automator 会话，MCP runtime 默认保留真实项目根目录，确保多开场景下各模板的热更新、截图和运行时调试都绑定到自己的项目。** [`16150fa`](https://github.com/weapp-vite/weapp-vite/commit/16150fa2039be50c0cd124688bdc43266181800d) by @sonofmagic
- 📦 **Dependencies** [`9799aa2`](https://github.com/weapp-vite/weapp-vite/commit/9799aa221f999a1dbd28ab95b21723336e8de680)
  → `@weapp-vite/devtools-runtime@0.4.3`

## 1.4.2

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.4.2`

## 1.4.1

### Patch Changes

- 🐛 **修复 MCP runtime 工具调用页面和组件方法时未通过小程序 automator `callMethod` 桥接的问题，并补充真实微信开发者工具里的 MCP runtime/devtools 工具成功路径覆盖，确保登录连接、截图、DOM 查询与交互能力可被端到端验证。** [`629c4c2`](https://github.com/weapp-vite/weapp-vite/commit/629c4c2e4916a22c699fba2b844b665207031e3c) by @sonofmagic
- 📦 **Dependencies** [`574c130`](https://github.com/weapp-vite/weapp-vite/commit/574c130f8c18b40cb60af8c97e38cd2db46da1ad)
  → `@weapp-vite/devtools-runtime@0.4.1`

## 1.4.0

### Minor Changes

- ✨ **支持按端口或 sessionId 区分多个 DevTools automator 会话，并为自动启动流程增加并发安全的端口租约，避免多个自动化任务同时启动时争抢同一个 websocket 端口。** [#661](https://github.com/weapp-vite/weapp-vite/pull/661) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`643c2fe`](https://github.com/weapp-vite/weapp-vite/commit/643c2fe8c0e64d3a817503d3080162b51c0d314a)
  → `@weapp-vite/devtools-runtime@0.4.0`

## 1.3.6

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.3.2`

## 1.3.5

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.3.1`

## 1.3.4

### Patch Changes

- 🐛 **新增 `weapp mcp` 标准 MCP 入口，让 AI 客户端可以直接连接微信开发者工具 automator 会话，并调用页面读取、元素查询、点击输入、截图与基础宿主 API 工具完成小程序模拟器里的 E2E 验证。** [`f41e375`](https://github.com/weapp-vite/weapp-vite/commit/f41e37591bb104b03ae9e7d60ae4499e46ce37fb) by @sonofmagic
  - 同时将 DevTools MCP 的路径解析、结构化输出序列化和元素快照读取抽到 `@weapp-vite/devtools-runtime` 公共模块，供 `@weapp-vite/mcp` 与 `weapp-ide-cli` 复用，避免两套 MCP 入口重复维护基础运行时契约。
- 📦 **Dependencies** [`f41e375`](https://github.com/weapp-vite/weapp-vite/commit/f41e37591bb104b03ae9e7d60ae4499e46ce37fb)
  → `@weapp-vite/devtools-runtime@0.3.0`

## 1.3.3

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.2.3`

## 1.3.2

### Patch Changes

- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.2.2`

## 1.3.1

### Patch Changes

- 🐛 **修复 DevTools console 日志启用超时时可能导致常驻 MCP/REST 服务退出的问题，并让 streamable-http MCP 服务使用带会话的 transport，确保标准 MCP client 可以完成初始化和工具发现。** [`6e78d57`](https://github.com/weapp-vite/weapp-vite/commit/6e78d570d4dbf459397410e0c17f8ca2ebafe873) by @sonofmagic

- 🐛 **为 streamable-http MCP 服务新增 DevTools runtime REST 接口，支持通过 HTTP 连续连接、跳转、截图、读取页面信息和日志，并让 `weapp-vite` 的 MCP 配置与 CLI 支持 `restEndpoint` 开关。** [`bc7e9e3`](https://github.com/weapp-vite/weapp-vite/commit/bc7e9e351d55811781a8aad71815f100cd71a59b) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/devtools-runtime@0.2.1`

## 1.3.0

### Minor Changes

- ✨ **为 MCP 服务新增微信开发者工具 runtime 工具集，并抽出共享 DevTools runtime 会话包，支持连接复用、页面跳转、截图、日志读取、页面数据、元素查询和组件交互等自动化能力。** [#527](https://github.com/weapp-vite/weapp-vite/pull/527) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`a3451df`](https://github.com/weapp-vite/weapp-vite/commit/a3451df4f907a58d7ba1c7ebaa78bd215c017da4)
  → `@weapp-vite/devtools-runtime@0.2.0`

## 1.2.1

### Patch Changes

- 🐛 **修复多个发布包在严格 TypeScript 校验下的类型问题，补齐 `tsd` 类型回归测试，并同步收敛 `wevu`、`@weapp-vite/mcp`、`@wevu/web-apis` 与 `create-weapp-vite` 的类型契约，减少后续重构时的类型回退风险。** [`b9a3e5b`](https://github.com/weapp-vite/weapp-vite/commit/b9a3e5b8fc6259ae5d77eba359aca3632d083b75) by @sonofmagic

## 1.2.0

### Minor Changes

- ✨ **增强 weapp-vite 的 AI 亲和性：为 MCP 新增显式的截图与截图对比工具，补充随包文档和网站中的 AI 意图映射说明，并让 create-weapp-vite 生成的项目级 AGENTS 指引默认把截图与截图对比请求路由到 weapp-vite 的原生命令能力。** [`933826c`](https://github.com/weapp-vite/weapp-vite/commit/933826cbd52e0de267069c4b67d0e6b8a669afdb) by @sonofmagic

## 1.1.2

### Patch Changes

- 🐛 **修复 `weapp-vite mcp` 在普通安装项目中的路径解析问题。现在 MCP 服务会优先识别 monorepo 布局，在用户项目里则回退到 `node_modules` 下已安装的 `weapp-vite` / `wevu` / `@wevu/compiler` 包路径，不再错误假设存在 `packages/weapp-vite/package.json`。同时补充安装态 CLI 入口与本地随包文档的回归覆盖，避免 `npx weapp-vite mcp` 启动时因 `ENOENT` 直接失败。** [#386](https://github.com/weapp-vite/weapp-vite/pull/386) by @sonofmagic

## 1.1.1

### Patch Changes

- 🐛 **优化 `weapp-vite`、`@weapp-vite/mcp`、`@weapp-vite/web`、`@wevu/api` 与 `@weapp-core/schematics` 的构建产物体积与依赖边界：将可复用的 Node 侧运行时依赖改为走 `dependencies`，把 MCP SDK 相关实现和 transport 启动逻辑集中收敛到 `@weapp-vite/mcp`，让 `weapp-vite` 通过包内桥接复用 MCP 能力，同时继续抽取共享 chunk、移除重复声明产物，减少发布包中不必要的内联与重复代码。** [`43a68e2`](https://github.com/weapp-vite/weapp-vite/commit/43a68e28e7ffcc9c6e40fa033d2f346452157140) by @sonofmagic

## 1.1.0

### Minor Changes

- ✨ **重构 `@weapp-vite/mcp` 为面向 `weapp-vite / wevu` 的完整 MCP 服务，实现包目录发现、源码读取与检索、包脚本执行、`weapp-vite` CLI 调用、文档资源暴露与调试提示词模板，并补充对应测试与使用文档。** [`a7768a3`](https://github.com/weapp-vite/weapp-vite/commit/a7768a31befe085638950e1dd54bb9da85f2ee50) by @sonofmagic

## 1.0.1

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic

## 1.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 0.0.5

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.4

### Patch Changes

- [`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.3

### Patch Changes

- [`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade 升级依赖版本

## 0.0.2

### Patch Changes

- [`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.2-alpha.0

### Patch Changes

- [`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.1

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade
