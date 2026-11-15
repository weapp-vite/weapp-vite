# @weapp-vite/hmr

## 0.3.4

### Patch Changes

- chore(deps): 升级 AI SDK、Babel、Vue 插件、通信依赖及构建工具，并同步工作区 catalog 和 create-weapp-vite 内置模板数据。

  weapp-vite 使用 Babel 8.1.2 与 rolldown-plugin-dts 0.30.2；automator 使用 ws 8.23.0，VS Code 扩展同步 1.146.0 类型声明。迁移 plugin-vue 6.0.11 的 Oxc 上下文补丁，并刷新父依赖允许范围内的 @hono/node-server 至 2.1.8，消除两条新增安全通告。

  验证默认环境更新为 Node 26.13.1 与 Rust 1.100.0，保留公开 Node 支持下限；Node 支持矩阵补齐 latest-26 并修复 Node 24 selector 与默认版本的耦合。TypeScript、local-pkg 和 Vite/Rolldown/Vite+ 保留已验证组合，兼容性决策见本轮升级记录。

## 0.3.3

### Patch Changes

- chore(deps): 同步工程配置、AI SDK、Dashboard、Tailwind 与组件依赖。

  更新工作区与脚手架内置 catalog，采用 TDesign 1.18.0、weapp-tailwindcss 5.7.3 和 devframe 配套包 1.3.3，同步 ESLint、Stylelint、AI SDK、axios 及相关解析器。保持 TypeScript 6.0.3、Vite 8.3.5、Rolldown 1.2.16 和 Vite+ 1.5.0，保留原版本声明形式及公开 peer 最低兼容范围。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/openai-compatible, ai, sass, sass-embedded, vue-router, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- chore(deps): 升级 AST、构建声明、脚手架和请求传输依赖。

  同步 Oxc JS 类型与可选 Rust 分析器至 0.158.0，更新 oxfmt 0.78.0、ignore 7.0.14、ws 8.22.2、dotenv 18.0.10 和 rolldown-plugin-dts 0.30.1。保留现有公开 API、类型契约及 native 的 JS fallback。

  声明构建改用 rolldown-plugin-dts 的 `dtsOnly`，消除默认构建中的弃用告警，保持声明产物契约。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - create-weapp-vite：dependencies.@inquirer/prompts

## 0.3.2

### Patch Changes

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@tailwindcss/vite, tailwindcss, tsdown, vue-eslint-parser。命名 catalog 变更键：tailwind4(tailwindcss)。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/openai-compatible, @tanstack/vue-query, ai, sass。命名 catalog 变更键：无。

- chore(deps): 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@weapp-tailwindcss/engine, miniprogram-api-typings, sass-embedded, weapp-tailwindcss。命名 catalog 变更键：latest(miniprogram-api-typings)；weapp-tailwindcss-fixed(weapp-tailwindcss)。

  同步脚手架默认依赖和微信 API 清单，支持 typings 5.3.1 新增的六个接口。
  wevu 同步宿主实例查找的可空返回值、glass-easel 静态组件选项及生命周期错误参数类型，并补充公开类型契约验证。

- chore(deps): 升级编译、运行时与开发工具依赖并同步脚手架版本。

  本轮接受 58 个 npm 直接依赖升级目标，同步包内版本声明、默认 catalog、tailwind4 catalog 与脚手架模板，更新 Babel、Vue、Tailwind CSS、Oxc、AI SDK、Devframes、Vite+、Vitest 等编译、运行时和开发工具依赖。Rust Oxc 依赖与 JavaScript parser/types 同步到 0.157，保留原有版本前缀及公开 peer 兼容下限。

  将多包共用的依赖声明归并到 workspace catalog，并同步脚手架内置映射；精确版本、`^`、`~` 的原有范围和锁定结果保持一致，减少后续升级时的重复维护。

  Vite+ 更新到 1.5.0，内置 Vite 8.3.5 与 Vitest 5.1.0。独立 Vite 8.3.6 未通过优化器关闭生命周期诊断，本轮保留 8.3.5；TypeScript 及其余兼容保留项继续沿用原基线。

  修复内联 WXS/SJS 在 Vue SFC、Web 转换和 HMR 解析中的原始脚本保护，保留行注释、运算符与标签字面量，避免组件扫描误读脚本正文。复用统一脚本边界解析，不增加公共 API。

  补齐 VS Code 扩展构建中的 WXML 源码解析依赖，缺失的模块会阻断构建，避免生成不完整的扩展包。

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @wevu/web-apis：dependencies.web-streams-polyfill
  - create-weapp-vite：devDependencies.oxfmt
  - weapp-vite：dependencies.rolldown-plugin-dts

- chore(deps): 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-agent/cli：dependencies.commander
  - weapp-vite：dependencies.@volar/language-service
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 0.3.1

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

  修复 classic HMR 的来源证明：React 普通 JSX/TSX 在转换前记录实际输入，原生入口继续由 raw reader 独占；保存事件以 Vite 同次稳定读取结算摘要，避免文件截断阶段污染恢复版本，并保留晚到读取、后续保存和关闭之间的所有权隔离。

  减少 request globals 与 prelude 的构建期重复解析：复用同一产物的 installer 识别结果，先检查已有 runtime 标记，并仅对完全缺少标记、公共导出和转义线索的代码跳过 AST；保留转义输入、跨轮次替换、初始化顺序和原生输出契约。

- fix(weapp-vite): 将 package imports 的 query/hash 兼容处理内置到发布包，在主构建、子构建与 Web 路径自动接入，保留精确映射、条件、自定义解析器和 external 语义。

  同步为 `@weapp-core/constants` 的公开直接依赖包发布补丁版本，使消费者的依赖范围随共享常量更新。

  使用官方 Vite/Rolldown，隔离连续构建中的自有插件钩子容器，并在编译插件关闭后释放会话引用。

  高级 tsconfigPaths 配置由内部创建的解析插件同样隔离每代 hook 容器，用户自行提供的同名插件保持对象与元数据语义。

  编译 provider 终结时按注册所有权撤销 HMR 回调，避免配置重启删除或改名后继续调用旧 provider，同时保留新一代同名注册与快照资源生命周期。

  状态保持快照在本轮产物生成时记录编译 provider 能力，保留构建关闭后的能力回退判断，并允许删除或替换 provider 后恢复。

  Vite+ 模板和独立消费者同步使用官方 1.4.0 launcher/core 配对及其内置 Rolldown 1.2.15，并将 Vitest 固定到配套的 5.0.5；独立构建继续使用官方 Vite 8.3.5 和 Rolldown 1.2.16，不再依赖工作区 Vite/Rolldown 补丁。

  开发宿主按每代所有权接管监听，启动和重启等待后端初扫或现存源码登记后再报告就绪；关闭先解除登记等待，再释放本代编译及监听资源，保留幸存 owner 和独立原生监听。

  classic 构建的内部完成边界等待原生发布、样式收尾和已启动的 profile 写入；配置重启与关闭撤销旧代观察，失败后只有实际成功发布才能恢复采样，避免将未完成的构建计为资源验收通过。

  修补后的 Chokidar 继续随发布产物打包交付。PR #1294 按用户授权引入两项持续的临时验收例外：Web optimizer 关闭残留，以及连续构建资源增长。两项均未修复；仅适用于固定官方 Vite 8.3.5 / Rolldown 1.2.16，版本变化时必需入口失败并要求重新评审或移除例外，不自动适用于 Vite+ 内置 Rolldown 1.2.15。

  Web 扫描期间关闭或重启可能留下临时缓存；同一 Node 进程连续构建可能保留旧代编译引用并增加内存。classic 512 SFC / 14 次编辑的产物与 runtime 对照通过，但 RSS 增长 233.938 MiB、强制 GC 后 heap 增长 37.009 MiB，仍超过原 32/16 MiB 门限。该结果不证明线性增长、所有增长同因或 Vite+ 有相同资源表现。

  Vite 必需产品入口固定执行五项并报告完整清单、豁免项和未执行项，通过时标记 accepted-with-waivers。原六项公开产品契约通过 diagnose:vite-product-lifecycle 保留，上游内部及引用回收诊断独立保留，原始失败仍非零退出。资源手动 workflow、原门限和断言不变；其他 CI、coverage、审查与真实 IDE 门禁不自动豁免，不能将例外写成问题已修复或完整验收通过。

## 0.3.0

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

## 0.2.2

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

- fix(hmr): 保留 HMR 编译准备和交付资源的释放错误，独立尝试并等待所有清理操作；编译与清理同时失败时保留编译首错，交付释放失败后阻止后续交付，并让重复关闭共享完整的错误结果。

- fix(weapp-vite): 修复状态保持 HMR 资产刷新使用旧输入和重复生成样式的问题，保持原始源码、模块加载结果及资产加载器各自的所有权。刷新完成、拓扑交接和关闭均等待编译 preparation 释放，并保留构建与清理失败，避免未释放资源被记录为成功。

  已观察的 raw 资产按冻结时的读取归属，在 Vite 加载前后核对字节摘要与文件版本，并核验已登记的别名绑定。二进制资产、别名及 Vite 的 raw/url query 遵循同一批次输入；变化或删除时转入完整重同步，未消费的普通资产保持延迟准入，避免混合提交不同版本的样式和资产。

## 0.2.1

### Patch Changes

- fix(hmr): 完善微信 stateful HMR 的批次发布、会话交接和关闭边界，避免连续更新丢失确认、误删产物或意外重置页面状态。

  - 开发构建启动前设置正确 ESM 图格式；完整构建回调仅含变化文件时仍保留全部输出归属。独立分包样式由所属子构建发布，避免同名资产冲突。
  - CSS Modules 的类名脚本与样式同批交付，维持稳定样式 factory 身份，保证后续脚本更新、完整构建或编译错误恢复后的补丁可用。
  - 原生脚本恢复到已完整发布基线后，纯样式编辑继续增量更新；基线仅在原生产物成功写出后推进，未知输入、写出失败与并发修改仍触发完整发布保护。
  - 页面、组件及 worker 拓扑变化重建正确入口，清理失效产物；删除页面后不再让旧引擎读取已删除侧车。完整快照只向替换会话交接一次，并核对源码与声明依赖版本，覆盖不足或输入变化时重新构建。
  - 宿主重启按独立上下文串行交接，兼容配置重载与强制重启；快照失败后新增文件可唤醒修复，初始化失败或关闭可取消等待并回收自有引擎。
  - 保留提前到达的客户端执行确认及客户端会话切换后的交付；接受批次时立即释放旧看门狗，同时保留未交付批次、重注册和更新失败的恢复机制。
  - 交付队列提供可等待稳定边界，覆盖快照重建与产物发布；失败明确拒绝等待，修复后可等待后续成功交付，不以页面已更新替代后台发布完成。
  - 恢复静态资源监听规则，使图片更新不触发 IDE 页面重建；会话关闭、启动失败和服务器退出恢复临时项目配置，保留借用宿主的所有权。
  - Node IPC 父进程断开时执行正常清理。退出先停止交付并取消未确认传输，再等待启动、重启、watcher、provider、Dashboard/MCP 和日志桥结束，保留清理失败且不将正常退出误报为构建失败。

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

## 0.2.0

### Minor Changes

- 提供实验性的 HMR 批次协作内核与 Tailwind 编译控制器，供小程序构建宿主复用。保留宿主自身的监听、模块图、原生写出和运行时确认协议；weapp-vite 的现有 HMR、tailwindcss 配置与 prepareHmr 类型保持兼容。

  模拟器销毁运行时后取消延迟 Promise 回调新提交的计时任务，避免 React/Taro 卸载期间产生跨会话异步异常；外部页面和节点句柄仍严格失效。

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
