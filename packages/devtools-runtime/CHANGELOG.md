# @weapp-vite/devtools-runtime

## 0.7.1

### Patch Changes

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-core/types：devDependencies.tsdown
  - @weapp-vite/glass-easel-web-adapter：devDependencies.tsdown
  - @wevu/web-apis：devDependencies.eventsource-parser
  - @weapp-agent/cli：dependencies.@ai-sdk/anthropic、dependencies.@ai-sdk/openai、dependencies.@ai-sdk/openai-compatible、dependencies.ai、devDependencies.tsdown
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - create-weapp-vite：dependencies.@inquirer/prompts
  - @weapp-vite/dashboard：dependencies.@devframes/agentic、dependencies.@devframes/hub、dependencies.@devframes/hub-ui
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
  - @weapp-vite/miniprogram-automator：dependencies.ws
  - weapp-vite：dependencies.@typescript-eslint/parser、dependencies.rolldown-plugin-dts、devDependencies.@devframes/agentic、devDependencies.@devframes/hub、devDependencies.@devframes/hub-ui、optionalDependencies.@swc/core

  chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @icebreakers/eslint-config, @types/node, @vue/language-core, autoprefixer, axios, devframe, eslint, magic-string, oxc-parser, postcss, rolldown, sass, sass-embedded, tailwind-variants, tslib, uview-plus, vue-tsc。命名 catalog 变更键：无。

  迁移 rolldown-plugin-dts 0.29 的 tsc 配置命名空间，兼容旧顶层配置，保留项目引用、上下文隔离和 Vue 声明生成契约。Rust N-API 与 Oxc 配套升级，保留可选原生路径及 JavaScript fallback；SSE 与样式变体由回归覆盖。TypeScript 保留 6.0.3，Node 支持范围不变。

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.5.1

## 0.7.0

### Minor Changes

- chore(deps)!: 升级工具链依赖，更新 Node.js 支持范围与升级提醒。

  Node.js 官方支持范围为 `^22.23.4 || ^24.22.1 || >=26.12.1`，发布包与生成项目的 `engines.node` 使用此范围。Vite+ 仍使用 `^24.22.1 || >=26.12.1`。

  `weapp-vite` 的 `build`、`dev`、`prepare`、`accept`、`mcp` 和 Tailwind 集成在范围外提示升级并继续运行。提醒通过 stderr 输出中文，按终端颜色设置突出当前版本和推荐范围，并提示“建议升级到受支持 LTS 分支的最新补丁版本，以获得安全修复”；Tailwind 每个插件实例只提醒一次。

  依赖加载、构建和 CSS 入口错误仍按原有方式处理，`prepare` 保留既有容错行为；允许尝试运行不代表承诺兼容所有旧版本。Bun 按独立运行时识别，不因其 Node 兼容版本触发提醒。入门与随包文档同步说明这一行为。

  修复仓库首次安装时，`wv prepare` 因日志依赖尚未构建而提前退出的问题。中文与颜色提示在 workspace 包尚无构建产物时也能正常加载；CLI 尚未构建时仍提示跳过支持文件预生成，不阻断安装。

  此次升级还修复了 Web 路由目录重命名时的重复 reload，以及 Wot UI 2.4.0 宽屏裁剪器白屏问题。TypeScript 编译器版本保持不变。

  升级时请检查以下迁移要求：

  公开构建队列升级至 p-queue 10：事件监听改用 `addEventListener` / `removeEventListener`，事件值从 `event.detail` 读取；清空队列会以 `AbortError` 拒绝尚未执行的任务。

  截图比较升级至 pixelmatch 8 的 OKLab/HyAB 算法：相同阈值可能得到不同差异结果，请保留现有阈值并重新复核截图基线。

  Chokidar 6 自有监听器通过 `build.watch.chokidar` 配置 `backend`、`pollingInterval`、`pollingBinaryInterval`，兼容旧 polling 别名。`server.watch` 仍由 Vite 管理，Rolldown 原生监听选项使用 `build.watch.watcher`。

  本轮依赖升级沿用已确认的发布例外，该条目覆盖 40 个 minor 和 2 个 patch，不代表完全向后兼容。具体依赖版本和迁移步骤见 `docs/plans/2026-10-26-dependency-upgrade.md`。

### Patch Changes

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.5.0

## 0.6.0

### Minor Changes

- feat(automator): 完整吸收官方 miniprogram-automator 0.13.0 的公开协议、CDP、触摸字段和诊断能力。新增 `MiniProgram.send()`、共享连接的 `CDP()` 及可取消事件订阅；`changedTouches` 优先于保留的弃用别名 `changeTouches`，启动失败附带脱敏、有界的 CLI 输出。

  `Transport.close()`、`Connection.dispose()`、`MiniProgram.disconnect()` 与共享会话释放方法的返回值改为 `Promise<void>`，调用方应使用 `await` 确认关闭完成。断开立即拒绝未决 RPC，避免上游清理回归；并发清理共享结果，超时或释放失败保留资源归属及重试机会，同时保留业务错误与清理错误。

  headless 同步触摸传递、异步断开和已有真实语义的五个公开协议，CDP 与其他协议明确报告 `HEADLESS_PROTOCOL_UNSUPPORTED`。同步 IDE CLI、MCP、日志、doctor 与重连的等待边界及迁移文档。

### Patch Changes

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@vitejs/devtools, @vitejs/devtools-kit, eslint, happy-dom, sass, sass-embedded。命名 catalog 变更键：无。

- chore(deps): 升级兼容的 AI SDK、Vue 类型工具及构建依赖，同步脚手架依赖目录和应用模板。TypeScript 保持 6.0.3，截图比较算法及既有 Vite、Rolldown 兼容补丁保持原有契约。

  升级 pnpm、Bun 和 Rust JSON 序列化依赖，并迁移 repoctl 发布说明分类补丁；沿用上游已有的发布 PR 去重修复。

- chore(deps): 升级 Vue、React、Vitest、Rolldown、Oxc 与 AI SDK 等兼容依赖，同步应用、模板和脚手架 catalog。

  迁移 Rolldown 1.2.14 兼容补丁，并对齐 Rust Oxc 0.154.0；保留 Vite 8.3.4、DevTools/Kit 0.7.6、TypeScript 6.0.3 和截图比较语义，p-queue 更新至兼容的 9.3.5。

  默认 catalog 变更键：@icebreakers/eslint-config, @vue/compiler-core, @vue/compiler-dom, devframe, happy-dom, oxc-parser, postcss, react, rolldown, vue, weapp-tailwindcss, zod。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- chore(deps): 刷新兼容范围内的运行时与构建依赖。

  升级 AI SDK、TanStack Vue Query、Rollup、weapp-tailwindcss 及其 engine；VS Code 扩展的打包检查脚本改用 adm-zip 自带类型的运行时包。p-queue 与 pixelmatch 保持兼容版本，TypeScript 不在本轮升级范围内。默认 catalog 变更键为 weapp-tailwindcss，命名 catalog 变更键为 weapp-tailwindcss-fixed（均升级至 5.6.3）。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @mpcore/vitest：devDependencies.vitest
  - @weapp-vite/glass-easel-web-adapter：devDependencies.vitest
  - @weapp-agent/cli：dependencies.@ai-sdk/anthropic、dependencies.@ai-sdk/openai、dependencies.@ai-sdk/openai-compatible、dependencies.ai
  - @weapp-vite/ast-native：devDependencies.vitest
  - @weapp-vite/eslint：devDependencies.vitest

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.4.0

## 0.5.0

### Minor Changes

- feat(acceptance): 补齐确定性验收、Doctor、构建产物与 HMR profile 的可追溯证据，未知或未完成测量不再被记录为成功或零耗时。

  - 复用现有 MCP/runtime 会话提供无模型检查、任务管理和当前代码证据；任务在项目锁释放后再发布完成状态，Windows 报告原子替换遇短暂占用时限时重试并保留持久化与清理错误。
  - 共享 Doctor CLI/API 分离默认只读静态检查、显式构建产物和已打开宿主页面探针，提供终端、JSON、SARIF 与完整性退出码；复用平台兼容及预算规则，修正 runtime ESLint 对自定义实例方法和数组/字符串同名方法的误报。
  - analyze 产物清单按实际模块所属包区分 runtime、业务及混合输出，保留分包复制来源，明确实际字节、模块分摊估算与未归因部分；新增 runtime 文件上界和单包预算，缺测拒绝报告通过，失败关联具体文件，JSON 构建/清理日志走 stderr。
  - profile 固定版本、会话、构建、多文件批次及实际生产者身份，记录源事件、准备、提交等待、提交和发布，区分 classic/stateful 边界；失败、缺失阶段、未知版本和未完成批次不计成功，嵌套阶段不重复累加，保留旧 JSONL 兼容和残差估算口径。

### Patch Changes

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

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.3.0

## 0.4.24

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

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
  - @weapp-vite/miniprogram-automator@1.2.23

## 0.4.23

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.2.22

## 0.4.22

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
  - @weapp-vite/miniprogram-automator@1.2.21

## 0.4.21

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
  - @weapp-vite/miniprogram-automator@1.2.20

## 0.4.20

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.2.19

## 0.4.19

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.2.18

## 0.4.18

### Patch Changes

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.2.17

## 0.4.17

### Patch Changes

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.2.16

## 0.4.16

### Patch Changes

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.2.15

## 0.4.15

### Patch Changes

- Updated dependencies:
  - @weapp-vite/miniprogram-automator@1.2.14

## 0.4.14

### Patch Changes

- 📦 **Dependencies** [`dcee1d2`](https://github.com/weapp-vite/weapp-vite/commit/dcee1d2c7efe5dca0ff3751c4c9d4f5ea83a4e89)
  → `@weapp-vite/miniprogram-automator@1.2.13`

## 0.4.13

### Patch Changes

- 📦 **Dependencies** [`8d7c0a2`](https://github.com/weapp-vite/weapp-vite/commit/8d7c0a292cd98462ba127f7ab4fd5077a09b54de)
  → `@weapp-vite/miniprogram-automator@1.2.12`

## 0.4.12

### Patch Changes

- 📦 **Dependencies** [`b055929`](https://github.com/weapp-vite/weapp-vite/commit/b055929f8c18a2a9be800eff88f8f7806a9a4f46)
  → `@weapp-vite/miniprogram-automator@1.2.11`

## 0.4.11

### Patch Changes

- 📦 **Dependencies** [`c7d8514`](https://github.com/weapp-vite/weapp-vite/commit/c7d85143aeb5edaaf5d1902a8bd3d5fe09ef570e)
  → `@weapp-vite/miniprogram-automator@1.2.10`

## 0.4.10

### Patch Changes

- 📦 **Dependencies** [`aceaafa`](https://github.com/weapp-vite/weapp-vite/commit/aceaafaadb179498a56261721ce4db9bcbee1d0c)
  → `@weapp-vite/miniprogram-automator@1.2.9`

## 0.4.9

### Patch Changes

- 📦 **Dependencies** [`71e0e70`](https://github.com/weapp-vite/weapp-vite/commit/71e0e70cc7a466d67236a406d47f261ac57c815b)
  → `@weapp-vite/miniprogram-automator@1.2.8`

## 0.4.8

### Patch Changes

- 📦 **Dependencies** [`7caa834`](https://github.com/weapp-vite/weapp-vite/commit/7caa8345cfc208b9a1321cba6d7cf4b7965a9221)
  → `@weapp-vite/miniprogram-automator@1.2.7`

## 0.4.7

### Patch Changes

- 📦 **Dependencies** [`1f62703`](https://github.com/weapp-vite/weapp-vite/commit/1f62703e60b9db5223ef349ad4dff7ac4f16bdfc)
  → `@weapp-vite/miniprogram-automator@1.2.6`

## 0.4.6

### Patch Changes

- 🐛 **修复 `wv dev -o` 打开微信开发者工具后没有稳定接入 `forwardConsole` 的问题，避免日志桥接在自动化会话未就绪时二次拉起开发者工具，并优化小程序日志的终端颜色展示。** [`cd13a17`](https://github.com/weapp-vite/weapp-vite/commit/cd13a176f129a82cf6e4b58a5ba7449d77bd2175) by @sonofmagic
- 📦 **Dependencies** [`cd13a17`](https://github.com/weapp-vite/weapp-vite/commit/cd13a176f129a82cf6e4b58a5ba7449d77bd2175)
  → `@weapp-vite/miniprogram-automator@1.2.5`

## 0.4.5

### Patch Changes

- 📦 **Dependencies** [`1e8dc3d`](https://github.com/weapp-vite/weapp-vite/commit/1e8dc3d5dfa0cbbb409b304c2dc3ebac97b7443b)
  → `@weapp-vite/miniprogram-automator@1.2.4`

## 0.4.4

### Patch Changes

- 📦 **Dependencies** [`7df6ac4`](https://github.com/weapp-vite/weapp-vite/commit/7df6ac4c8dfc677aeb63b370c6a835a5baa0c51d)
  → `@weapp-vite/miniprogram-automator@1.2.3`

## 0.4.3

### Patch Changes

- 🐛 **修复 `weapp-vite dev -o` 通过 automator 打开带 `miniprogramRoot` 项目时可能切到临时哈希目录的问题。开发模式现在直接打开真实项目目录，打开后的 HTTP 编译刷新失败时也不会回退到会创建临时 wrapper 的 automator 编译；开发态 `s` 截图热键会保留真实项目根，避免微信开发者工具监听临时拷贝导致后续热更新失效。** [`9799aa2`](https://github.com/weapp-vite/weapp-vite/commit/9799aa221f999a1dbd28ab95b21723336e8de680) by @sonofmagic

- 🐛 **修复多个 TailwindCSS 模板同时执行 `pnpm dev:open` 时，截图、MCP 与其他微信开发者工具联动可能连接到默认全局 automator 端口或其他项目窗口的问题。开发态普通 open 后会为真实项目根目录准备独立的默认 automator 会话，MCP runtime 默认保留真实项目根目录，确保多开场景下各模板的热更新、截图和运行时调试都绑定到自己的项目。** [`16150fa`](https://github.com/weapp-vite/weapp-vite/commit/16150fa2039be50c0cd124688bdc43266181800d) by @sonofmagic

## 0.4.2

### Patch Changes

- 📦 **Dependencies** [`90f71b0`](https://github.com/weapp-vite/weapp-vite/commit/90f71b013cd6314977d3054fedbbc043eb24dcfd)
  → `@weapp-vite/miniprogram-automator@1.2.2`

## 0.4.1

### Patch Changes

- 🐛 **修复 DevTools 自动化会话生命周期与截图恢复逻辑，为 wevu + Tailwind CSS + TDesign 模板补充稳定选择器，并把真实 IDE 打开、截图、DOM 操作与登录失效诊断流程纳入 e2e 覆盖。** [`574c130`](https://github.com/weapp-vite/weapp-vite/commit/574c130f8c18b40cb60af8c97e38cd2db46da1ad) by @sonofmagic
- 📦 **Dependencies** [`574c130`](https://github.com/weapp-vite/weapp-vite/commit/574c130f8c18b40cb60af8c97e38cd2db46da1ad)
  → `@weapp-vite/miniprogram-automator@1.2.1`

## 0.4.0

### Minor Changes

- ✨ **支持按端口或 sessionId 区分多个 DevTools automator 会话，并为自动启动流程增加并发安全的端口租约，避免多个自动化任务同时启动时争抢同一个 websocket 端口。** [#661](https://github.com/weapp-vite/weapp-vite/pull/661) by @sonofmagic

### Patch Changes

- 📦 **Dependencies** [`643c2fe`](https://github.com/weapp-vite/weapp-vite/commit/643c2fe8c0e64d3a817503d3080162b51c0d314a)
  → `@weapp-vite/miniprogram-automator@1.2.0`

## 0.3.2

### Patch Changes

- 📦 **Dependencies** [`3eb68b6`](https://github.com/weapp-vite/weapp-vite/commit/3eb68b6e3d31ffc29c90c4c29a44ce0fc05fd1ea)
  → `@weapp-vite/miniprogram-automator@1.1.3`

## 0.3.1

### Patch Changes

- 📦 **Dependencies** [`28bade7`](https://github.com/weapp-vite/weapp-vite/commit/28bade743e164d87316fd8949d6c82fd3dda1e07)
  → `@weapp-vite/miniprogram-automator@1.1.2`

## 0.3.0

### Minor Changes

- ✨ **新增 `weapp mcp` 标准 MCP 入口，让 AI 客户端可以直接连接微信开发者工具 automator 会话，并调用页面读取、元素查询、点击输入、截图与基础宿主 API 工具完成小程序模拟器里的 E2E 验证。** [`f41e375`](https://github.com/weapp-vite/weapp-vite/commit/f41e37591bb104b03ae9e7d60ae4499e46ce37fb) by @sonofmagic
  - 同时将 DevTools MCP 的路径解析、结构化输出序列化和元素快照读取抽到 `@weapp-vite/devtools-runtime` 公共模块，供 `@weapp-vite/mcp` 与 `weapp-ide-cli` 复用，避免两套 MCP 入口重复维护基础运行时契约。

## 0.2.3

### Patch Changes

- 📦 **Dependencies** [`4276782`](https://github.com/weapp-vite/weapp-vite/commit/4276782841181ef7b540be4eb5e722e979f4363f)
  → `@weapp-vite/miniprogram-automator@1.1.1`

## 0.2.2

### Patch Changes

- 📦 **Dependencies** [`f0d3142`](https://github.com/weapp-vite/weapp-vite/commit/f0d3142250ec0ac70329215009ef5f0cff144ad9)
  → `@weapp-vite/miniprogram-automator@1.1.0`

## 0.2.1

### Patch Changes

- 📦 **Dependencies** [`6e78d57`](https://github.com/weapp-vite/weapp-vite/commit/6e78d570d4dbf459397410e0c17f8ca2ebafe873)
  → `@weapp-vite/miniprogram-automator@1.0.5`

## 0.2.0

### Minor Changes

- ✨ **为 MCP 服务新增微信开发者工具 runtime 工具集，并抽出共享 DevTools runtime 会话包，支持连接复用、页面跳转、截图、日志读取、页面数据、元素查询和组件交互等自动化能力。** [#527](https://github.com/weapp-vite/weapp-vite/pull/527) by @sonofmagic
