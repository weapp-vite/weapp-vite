# @weapp-vite/tailwindcss

## 1.1.0

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
  - @weapp-vite/hmr@0.3.0

## 1.0.1

### Patch Changes

- fix(weapp-vite): 修复导入 Tailwind 入口的普通 CSS 和 Vue 样式在状态化 HMR 中触发完整重载的问题，保留页面状态，并继续通过原生构建管线处理 scoped 样式、PostCSS 和资源 URL。快照输入、依赖或样式入口在编译期间变化时，仍会安全执行完整重同步。

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

- fix(hmr): 保持 Tailwind 热更新与首次构建的扫描范围一致，避免纯脚本保存时扫描配置范围外的文件、额外生成样式并误触发 classic 回退。

- fix(weapp-vite): 修复 Tailwind HMR 来源匹配在同一文件判断中反复解析相同目录并重复编译 glob 的开销。每个文件重新读取条目字段和真实路径，仅在本次判断内复用目录解析，并在批次内延迟复用纯 glob 编译结果；保留上游候选范围、隐藏文件、错误短路和回调后符号链接变化的行为。

- fix(weapp-vite): 修复 Tailwind HMR 将自动扫描范围扩大到项目根目录的问题。初始来源登记、新增文件发现与内存批次编译统一沿用编译器解析出的样式来源范围，避免依赖目录使用符号链接时扫描大量无关文件，并保留显式来源配置。

- fix(weapp-vite): 合并连续且语义等价的 Tailwind 来源负规则，减少首次 HMR 准备中重复的目录解析，保留上游匹配、复杂模式、输入封存和依赖验证。

- fix(hmr): 统一热更新内存编译与首次构建的 Tailwind 候选处理，避免纯脚本修改导致 rpx 字号规则换序并误触发 classic 回退；编译器产生的实际样式变化统一参与回退判断，不再依赖 watcher 回调顺序。

- Updated dependencies:
  - @weapp-vite/hmr@0.2.2

## 1.0.0

### Major Changes

- feat(engines)!: 将框架及编译依赖链的 Node.js 支持范围对齐为 `^22.18.0 || ^24.11.0 || >=26.0.0`，不再承诺 Node 20、23、25 或低于最低补丁版本的环境。CLI 在加载构建依赖前读取发布包声明并明确拒绝不支持的运行时；发布消费检查覆盖三系统最低版本和当前支持的 LTS 补丁版本。已有项目请先升级 Node.js；脚手架自身仍要求 Node 22.22.2、24.15.0 或 26 及以上版本，不降低其依赖所需版本。

### Patch Changes

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
  - @weapp-vite/hmr@0.2.1

## 0.2.0

### Minor Changes

- 提供实验性的 HMR 批次协作内核与 Tailwind 编译控制器，供小程序构建宿主复用。保留宿主自身的监听、模块图、原生写出和运行时确认协议；weapp-vite 的现有 HMR、tailwindcss 配置与 prepareHmr 类型保持兼容。

  模拟器销毁运行时后取消延迟 Promise 回调新提交的计时任务，避免 React/Taro 卸载期间产生跨会话异步异常；外部页面和节点句柄仍严格失效。

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
  - @weapp-vite/hmr@0.2.0
