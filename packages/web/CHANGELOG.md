# @weapp-vite/web

## 1.3.10

### Patch Changes

- 📦 **Dependencies** [`2acd828`](https://github.com/weapp-vite/weapp-vite/commit/2acd828b54fc6d5218cfdce38153691adce46522)
  → `rolldown-require@2.0.12`

## 1.3.9

### Patch Changes

- 📦 **Dependencies** [`0066308`](https://github.com/weapp-vite/weapp-vite/commit/0066308e1af282e9bc204143e685c54edd490f41)
  → `rolldown-require@2.0.11`

## 1.3.8

### Patch Changes

- 📦 **Dependencies** [`3094be8`](https://github.com/weapp-vite/weapp-vite/commit/3094be81a5c569237425602388b7a7a579cdbce0)
  → `rolldown-require@2.0.10`

## 1.3.7

### Patch Changes

- 📦 **Dependencies** [`aae675c`](https://github.com/weapp-vite/weapp-vite/commit/aae675c4084864f16d74cce1d0f19592d6abf0c6)
  → `rolldown-require@2.0.9`

## 1.3.6

### Patch Changes

- 🐛 **升级 `htmlparser2` 到 `^11.0.0`，同步刷新工作区锁文件与相关包的依赖解析结果，确保 `weapp-vite` 与 `@weapp-vite/web` 在后续发布时携带一致的解析器版本。由于本次发布包含 `weapp-vite`，按仓库发布约定同时补充 `create-weapp-vite` 的版本变更。** [`526c0db`](https://github.com/weapp-vite/weapp-vite/commit/526c0dbc3e415095a87b661fb26d9624ef6b4b5d) by @sonofmagic

- 🐛 **升级 `htmlparser2` 到 `^12.0.0`，同步刷新 workspace catalog、脚手架生成 catalog 与锁文件，确保 `weapp-vite` 和 `@weapp-vite/web` 后续发布时解析器版本保持一致。考虑到 `create-weapp-vite` 会下发同一份 catalog 版本，本次也一并补充脚手架包的补丁版本变更。** [`84c227a`](https://github.com/weapp-vite/weapp-vite/commit/84c227a0b537a2f12bc512686970a0f63916366a) by @sonofmagic

- 🐛 **同步升级 workspace catalog 中的 `tdesign-miniprogram` 到 `1.13.0`，并刷新 `create-weapp-vite` 生成 catalog 产物，使脚手架模板解析 `catalog:` 与命名 catalog 时能拿到当前仓库内的一致版本。对应的 `createProject` 单测也改为基于生成 catalog 做断言，避免后续 catalog 升级时因为硬编码版本号而重复误报失败。** [`ff929d6`](https://github.com/weapp-vite/weapp-vite/commit/ff929d605b5cd9fd9d09eb4283a4af1cefa7cfcc) by @sonofmagic
  - 同时将 `@weapp-vite/web` 中的 `domhandler` 依赖提升到 `^6.0.1`，与当前相关解析栈版本保持一致。

## 1.3.5

### Patch Changes

- 🐛 **修复 `packages/web` 与仓库级构建中的声明打包 warning，减少 `pnpm build` 时的噪音日志，并为包含 Vue SFC 的 e2e 工程补齐 `wevu` 依赖声明，避免构建阶段出现误报警告。** [`2a6d379`](https://github.com/weapp-vite/weapp-vite/commit/2a6d3790d88224f17a26bfe1e0bc28532d0c6380) by @sonofmagic

- 🐛 **优化 `weapp-vite`、`@weapp-vite/mcp`、`@weapp-vite/web`、`@wevu/api` 与 `@weapp-core/schematics` 的构建产物体积与依赖边界：将可复用的 Node 侧运行时依赖改为走 `dependencies`，把 MCP SDK 相关实现和 transport 启动逻辑集中收敛到 `@weapp-vite/mcp`，让 `weapp-vite` 通过包内桥接复用 MCP 能力，同时继续抽取共享 chunk、移除重复声明产物，减少发布包中不必要的内联与重复代码。** [`43a68e2`](https://github.com/weapp-vite/weapp-vite/commit/43a68e28e7ffcc9c6e40fa033d2f346452157140) by @sonofmagic

## 1.3.4

### Patch Changes

- 🐛 **将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8) by @sonofmagic
- 📦 **Dependencies** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8)
  → `rolldown-require@2.0.8`

## 1.3.3

### Patch Changes

- 🐛 **修复 `weapp-vite` 在生成 DTS 时对 `@weapp-vite/web` 类型导出的解析问题：为 `@weapp-vite/web` 增加稳定的 `./plugin` 子路径导出，并让配置类型改为从该子路径引用 `WeappWebPluginOptions`，避免构建类型声明时出现缺失导出报错。** [`4b17371`](https://github.com/weapp-vite/weapp-vite/commit/4b17371069a13272d0e227c682a7d6cabaca9627) by @sonofmagic

## 1.3.2

### Patch Changes

- 📦 **Dependencies** [`88b2d31`](https://github.com/weapp-vite/weapp-vite/commit/88b2d316fe1238ea928abf7d63d0cb63ae29e1e8)
  → `rolldown-require@2.0.7`

## 1.3.1

### Patch Changes

- 🐛 **汇总 `c8f491b328e2151eb8b8d284a1fac0974de09476` 与 `4ba41941f18028bedbb4b8d75426780b442d95c6` 两个重构提交。** [`590893f`](https://github.com/weapp-vite/weapp-vite/commit/590893f02d3bac84a4b3566326cbe5498880edf9) by @sonofmagic
  ## 变更摘要
  1. `c8f491b328e2151eb8b8d284a1fac0974de09476`：重构 `@wevu/compiler`，将过长源码拆分为职责更聚焦的模块（覆盖 JSX 编译流程、`vueSfc` block src 解析、template 元素辅助逻辑、class/style computed 构建、`defineOptions` 序列化等），降低单文件复杂度并提升维护性。该提交以代码组织优化为主，不改变既有编译语义。
  2. `4ba41941f18028bedbb4b8d75426780b442d95c6`：重构 `@weapp-vite/web` 运行时，拆分 `element`、`mediaApi`、`network`、`selectorQuery` 等超长模块为独立子模块（如 `mediaApi/*`、`network/*`），并抽离配套类型定义，增强边界清晰度与后续可扩展性。该提交同样以结构重排为主，不引入对外行为变更。

## 1.3.0

### Minor Changes

- ✨ **继续补齐 Web runtime 的高频兼容桥接能力：** [`67d333e`](https://github.com/weapp-vite/weapp-vite/commit/67d333e05fa999e9bc15595b30987859c4f10621) by @sonofmagic
  - 新增 `wx.hideKeyboard`，通过 `blur` 当前聚焦输入元素近似桥接收起键盘流程。
  - 新增 `wx.loadSubPackage` / `wx.preloadSubpackage`，提供 no-op 成功桥接以兼容分包加载调用链。
  - 新增 `wx.getUpdateManager` / `wx.getLogManager`，提供更新流程与日志能力的 Web 占位桥接。

  同时补齐 `canIUse`、单元测试与 Web 兼容矩阵文档，明确这些能力当前均为 `partial` 实现。

- ✨ **为 Web runtime 补充一批高频兼容桥接能力：** [`297b211`](https://github.com/weapp-vite/weapp-vite/commit/297b211bfe2b2cea0f629f029e5f022e4d92af91) by @sonofmagic
  - 新增 `wx.chooseLocation`，支持通过预设结果或 `prompt` 输入经纬度完成基础选点流程调试。
  - 新增 `wx.getImageInfo`，基于浏览器 `Image` 对象提供图片宽高与类型读取。
  - 新增 `wx.showTabBar` / `wx.hideTabBar` no-op 成功桥接，用于兼容调用链。

  同时补齐对应单测与 Web 兼容矩阵文档说明，明确上述能力当前均为 `partial` 实现。

- ✨ **继续补充 Web runtime 的媒体与刷新兼容桥接：** [`90dfafe`](https://github.com/weapp-vite/weapp-vite/commit/90dfafe1b63f44363d021f5ede5cc72fd3f9b116) by @sonofmagic
  - 新增 `wx.getVideoInfo`，优先读取运行时预设并降级到浏览器 video 元信息读取。
  - 新增 `wx.compressVideo`，提供 no-op 兼容桥接（默认返回原路径），并支持注入预设压缩结果用于调试。
  - 新增 `wx.startPullDownRefresh` no-op 成功桥接，与既有 `wx.stopPullDownRefresh` 形成完整调用链兼容。

  同时补齐对应 `canIUse`、单测和 Web 兼容矩阵文档，明确以上能力当前均为 `partial` 实现。

- ✨ **继续补充 Web runtime 的地址与授权高频桥接能力：** [`7436e05`](https://github.com/weapp-vite/weapp-vite/commit/7436e0536c8222505385b650f84338e29d8f7ff3) by @sonofmagic
  - 新增 `wx.chooseAddress`，支持通过运行时预设或 `prompt` 输入完成地址选择流程调试。
  - 新增 `wx.openAppAuthorizeSetting`，提供应用级授权状态桥接并支持预设状态注入。
  - 新增 `wx.getFuzzyLocation`，优先读取运行时预设并降级到定位结果模糊化（经纬度保留两位小数）桥接。

  同时补齐 `canIUse`、单测与 Web 兼容矩阵文档，明确以上能力当前均为 `partial` 实现。

- ✨ **补充 Web runtime 下一批高频桥接 API：** [`3777574`](https://github.com/weapp-vite/weapp-vite/commit/3777574bbdc425fcb92942631b9d577a16c06bd1) by @sonofmagic
  - 权限相关：新增 `wx.getSetting`、`wx.authorize`、`wx.openSetting`，基于运行时内存态维护常见 scope 的授权结果，便于流程调试。
  - 媒体相关：新增 `wx.chooseMedia`，通过文件选择器桥接图片/视频选择；新增 `wx.compressImage`，优先使用 Canvas 执行近似压缩并在能力缺失时降级。

  同时补齐对应单测与 Web 兼容矩阵文档，明确以上能力当前均为 `partial`。

- ✨ **继续补充 Web runtime 的登录与用户信息高频桥接能力：** [`eb6dbe7`](https://github.com/weapp-vite/weapp-vite/commit/eb6dbe7886610fcd33ba5226d0950e902bae03fe) by @sonofmagic
  - 新增 `wx.checkSession`，提供会话有效性占位校验并支持预设会话状态注入。
  - 新增 `wx.getUserInfo` / `wx.getUserProfile`，提供用户信息读取与授权确认流程桥接，可通过预设结果注入用户资料。

  同时补齐 `canIUse`、单测与 Web 兼容矩阵文档，明确以上能力当前均为 `partial` 实现。

- ✨ **继续补充 Web runtime 的媒体高频桥接能力：** [`7fdef4e`](https://github.com/weapp-vite/weapp-vite/commit/7fdef4e59cabd82885f3d2814adeacf3c7770455) by @sonofmagic
  - 新增 `wx.chooseVideo`，基于浏览器文件选择能力完成视频选择并返回临时路径信息。
  - 新增 `wx.previewMedia`，支持以浏览器新窗口方式预览媒体 URL，用于调试媒体预览调用链。
  - 新增 `wx.saveVideoToPhotosAlbum`，通过浏览器下载行为近似桥接保存流程。

  同时补齐 `canIUse`、单测与 Web 兼容矩阵文档，明确以上能力目前均为 `partial` 实现。

- ✨ **继续补齐 Web runtime 的高频 API 兼容桥：** [`2b648fa`](https://github.com/weapp-vite/weapp-vite/commit/2b648fa4ec6d27d1b0c245a1ebd14b6afa09e41f) by @sonofmagic
  - 新增 `wx.saveFile`，支持将临时文件路径近似持久化到 Web 内存文件系统并返回 `savedFilePath`。
  - 新增 `wx.createVideoContext`，支持 `play/pause/stop/seek/playbackRate/requestFullScreen/exitFullScreen` 基础控制桥接。
  - 新增 `wx.requestSubscribeMessage`，支持模板消息授权结果桥接，并可通过运行时预设注入每个模板的决策结果。

  同时补齐 `canIUse`、单元测试与 Web 兼容矩阵文档，明确以上能力当前为 `partial` 实现。

- ✨ **继续补齐 Web runtime 的页面背景能力桥接：** [`94bdd19`](https://github.com/weapp-vite/weapp-vite/commit/94bdd19112e9f70e1f2275a61d137ac7c4d1475f) by @sonofmagic
  - 新增 `wx.setBackgroundColor`，支持将背景色设置近似映射到 Web 页面样式。
  - 新增 `wx.setBackgroundTextStyle`，支持 `light/dark` 文本样式设置并提供非法参数校验。

  同时补齐 `canIUse`、单元测试与 Web 兼容矩阵文档，明确上述能力均为 `partial` 实现。

- ✨ **继续补充 Web runtime 的文件与视频编辑兼容桥接能力：** [`e091f0a`](https://github.com/weapp-vite/weapp-vite/commit/e091f0a4d58aaa74fb906db164bb3da3dc5d76fa) by @sonofmagic
  - 新增 `wx.chooseFile`，基于文件选择器桥接通用文件选择，支持 `extension` 过滤并返回临时文件信息。
  - 新增 `wx.openVideoEditor`，提供 API 级兼容桥接（默认返回原视频路径），并支持注入预设编辑结果用于流程调试。
  - 新增 `wx.saveFileToDisk`，通过浏览器下载行为近似桥接文件保存流程。

  同时补齐 `canIUse`、单测与 Web 兼容矩阵文档，明确以上能力当前均为 `partial` 实现。

## 1.2.4

### Patch Changes

- 📦 **Dependencies** [`7f1a2b5`](https://github.com/weapp-vite/weapp-vite/commit/7f1a2b5de1f22d5340affc57444f7f01289fa7b4)
  → `rolldown-require@2.0.6`

## 1.2.3

### Patch Changes

- 📦 **Dependencies** [`b15f16f`](https://github.com/weapp-vite/weapp-vite/commit/b15f16f9cc1c3f68b8ec85f54dcd00ccfe389603)
  → `rolldown-require@2.0.5`

## 1.2.2

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `rolldown-require@2.0.4`

## 1.2.1

### Patch Changes

- 🐛 **升级多处依赖版本（Babel 7.29、oxc-parser 0.112、@vitejs/plugin-vue 6.0.4 等）。** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628) by @sonofmagic
  - 同步模板与示例的 tdesign-miniprogram、weapp-tailwindcss、autoprefixer 等版本，确保脚手架默认依赖一致。

- 🐛 **Miscellaneous improvements** [`c4d3abb`](https://github.com/weapp-vite/weapp-vite/commit/c4d3abb8e4642dc38fa9a47efc7ac26b41703db1) by @sonofmagic
  - 新增共享 chunk 的配置能力，并在构建阶段仅使用 rolldown（忽略 rollupOptions）。
  - web 插件在未扫描模板列表时也可直接转换 wxml。
- 📦 **Dependencies** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628)
  → `rolldown-require@2.0.3`

## 1.2.0

### Minor Changes

- ✨ **Miscellaneous improvements** [`9632f14`](https://github.com/weapp-vite/weapp-vite/commit/9632f14e874d38b271b77d5ac978569e794c44b5) by @sonofmagic
  - WXML 支持 `slot` 原生标签，并为 `wx-import` / `wx-include` 提供别名处理。
  - `<template is>` 支持 `data` 简写对象语法，自动补齐为对象字面量。
  - WXML 编译递归收集 `import` / `include` 依赖，缺失或循环时给出警告。
  - 缺失模板时给出告警并安全返回空输出，避免运行时报错。
  - WXS 增强：解析扩展名顺序、`?wxs` 标记、`require` 规则与缺失模块告警。
  - `defineComponent` 支持 `observerInit`，初始化阶段只触发一次 observer。
  - Component behaviors 支持递归合并 data / properties / methods / lifetimes，并保持顺序。

## 1.1.0

### Minor Changes

- ✨ **Web 运行时 weapp-button 样式对齐小程序默认按钮，并支持通过 adoptedStyleSheets 复用样式，降低 ShadowRoot 注入成本。** [`f7810a7`](https://github.com/weapp-vite/weapp-vite/commit/f7810a7ff4647307824bd8f4fd8a2fab0c7fa716) by @sonofmagic

- ✨ **新增 Web 模式的 --host CLI 参数，并增强 Web 编译期组件标签映射与属性绑定，提升 H5 运行时的交互兼容性。** [`f38965c`](https://github.com/weapp-vite/weapp-vite/commit/f38965c654802dfb5a415d7f85e88c079bdb85b9) by @sonofmagic

## 1.0.1

### Patch Changes

- 🐛 **Web 端 HMR 支持保留页面状态，模板/样式/逻辑更新不触发全量刷新。** [`dd2b69d`](https://github.com/weapp-vite/weapp-vite/commit/dd2b69d81b8b0aa530654b349be304c6081b8500) by @sonofmagic

- 🐛 **Web 端新增导航栏对齐能力：构建期注入 `weapp-navigation-bar`，并补齐 `wx.setNavigationBarTitle/setNavigationBarColor/showNavigationBarLoading/hideNavigationBarLoading` 等 API 以支持安全区与样式更新。** [`6e1c9c7`](https://github.com/weapp-vite/weapp-vite/commit/6e1c9c71ce0c861ec35be4028b78992b8769c059) by @sonofmagic

## 1.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 0.0.3

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 0.0.2

### Patch Changes

- [`252b807`](https://github.com/weapp-vite/weapp-vite/commit/252b80772508ef57a0dc533febddc1a1e69aa4c2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 autoImportComponents.htmlCustomData 选项，支持在 VS Code 等编辑器中生成小程序组件的 HTML Custom Data；同时扩展 H5 运行时对多种模板后缀的识别能力，使 `.html` 等模板与小程序组件共用自动导入机制。
