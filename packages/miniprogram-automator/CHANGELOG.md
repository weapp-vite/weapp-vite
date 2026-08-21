# @weapp-vite/miniprogram-automator

## 1.2.14

### Patch Changes

- 修复部分微信开发者工具版本中 `Element.offset()` 只返回坐标、缺少宽高的问题；当协议响应不完整时，会通过 DOM 尺寸属性补齐结果。

- 修复 App-Service 路由降级元素在页面切换或渲染瞬态窗口中读取空快照的问题，连续查询与样式、尺寸、坐标和属性读取现在会在超时范围内自动重试，降低 DevTools 长序列回归中的偶发失败。

- App-Service route 降级元素补齐只读能力：`offset()`/`size()`/`style()`/`attribute()` 经 `createSelectorQuery` 按原始组件作用域实时读取快照（每次读取重新查询，滚动/重渲染后仍新鲜），证据截图高亮框与可见性断言在 page-frame 协议失效的 DevTools 版本（如 2.01.2510290）上恢复可用；`text()`/`value()`/`property()`/`wxml()`、元素级查询与交互方法改为带替代建议的明确报错，不再等待失效协议超时。

## 1.2.13

### Patch Changes

- 🐛 **修复插件模板在微信开发者工具自动化打开时被错误按小程序模式校验的问题，保留插件项目的 `compileType: "plugin"` 与 `version: "dev"` 开发配置；同时增强已打开 automator 会话的就绪检查、缺失 SDKVersion 兼容和 IDE E2E 分层入口，使 `e2e:ide:full` 默认执行核心高信号套件，完整逐文件回归保留在 `e2e:ide:full:exhaustive`。** [#802](https://github.com/weapp-vite/weapp-vite/pull/802) by @sonofmagic

- 🐛 **统一微信开发者工具的 CLI-first 打开流程，默认先打开项目再连接 automator，避免部分 DevTools 版本在自动化启动阶段反复回退。新增 `wv ide doctor` 诊断 CLI、服务端口、登录、项目会话和 DevTools 能力，并改进开发快捷键重复操作提示。** [#807](https://github.com/weapp-vite/weapp-vite/pull/807) by @sonofmagic

## 1.2.12

### Patch Changes

- 🐛 **自动补充依赖升级发布记录。** [`8d7c0a2`](https://github.com/weapp-vite/weapp-vite/commit/8d7c0a292cd98462ba127f7ab4fd5077a09b54de) by @sonofmagic
  涉及包：
  - @weapp-vite/web：dependencies.postcss-selector-parser、dependencies.rolldown
  - @wevu/compiler：dependencies.postcss-selector-parser
  - @weapp-vite/miniprogram-automator：dependencies.ws
  - rolldown-require：peerDependencies.rolldown
  - weapp-vite：dependencies.rolldown
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 1.2.11

### Patch Changes

- 🐛 **微信小程序开发模式默认根据开发者工具的热重载设置自动选择 HMR 运行时，并在启动时显示当前模式与切换方法；同时确保 Web API 网络默认值在分包和共享 chunk 的多份运行时实例之间保持一致，并避免截图协议超时后在同一 DevTools 连接上继续叠加请求。** [#778](https://github.com/weapp-vite/weapp-vite/pull/778) by @sonofmagic

## 1.2.10

### Patch Changes

- 🐛 **升级除 TypeScript 外的依赖与 pnpm，并适配 Vite 8 的 OXC JSX 转换：已有 `esbuild.jsx: 'preserve'` 配置会同步到 OXC，避免 Wevu JSX 被误转换为 React runtime。** [#772](https://github.com/weapp-vite/weapp-vite/pull/772) by @sonofmagic
  升级至 `weapp-tailwindcss@5.2.11`，采用上游对 Tailwind v4 生成器 module ID 查询的统一清理，避免 `weapp-vite` 样式 sidecar 虚拟模块 ID 被当作磁盘路径读取，确保原生模板、脚本和样式增量更新正常输出。

  涉及包：
  - @wevu/api：dependencies.@douyin-microapp/typings
  - @weapp-vite/web：dependencies.rolldown
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - @weapp-vite/dashboard：devDependencies.@iconify/tailwind4
  - @weapp-vite/miniprogram-automator：dependencies.ws
  - rolldown-require：dependencies.get-tsconfig
  - weapp-ide-cli：dependencies.execa
  - weapp-vite：dependencies.@vercel/detect-agent、dependencies.rolldown-plugin-dts
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 1.2.9

### Patch Changes

- 🐛 **修复真实微信开发者工具自动化中的会话复用、页面重启、日志收集与截图清理稳定性问题，避免 `forwardConsole` 重复连接现有会话，并降低完整 IDE E2E 在组件库和 GitHub issue 回归场景中的重复启动成本。** [#770](https://github.com/weapp-vite/weapp-vite/pull/770) by @sonofmagic

## 1.2.8

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`71e0e70`](https://github.com/weapp-vite/weapp-vite/commit/71e0e70cc7a466d67236a406d47f261ac57c815b) by @sonofmagic
  - 默认 catalog 变更键：@vue/language-core, oxc-parser, postcss, rolldown, sass, stylelint, vue-tsc, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
  - 同时适配 Monaco Editor 0.56 的 worker 公开入口，恢复 Dashboard 构建。

## 1.2.7

### Patch Changes

- 🐛 **针对微信开发者工具 2.01.2510290 的 Page frame 协议无响应问题，自动选择 App-service Page 协议，避免元素查询、数据读写和页面方法调用等待协议超时后才降级。** [#713](https://github.com/weapp-vite/weapp-vite/pull/713) by @sonofmagic

## 1.2.6

### Patch Changes

- 🐛 **增强微信开发者工具真实运行时与自动化链路稳定性。新版 DevTools 中 Page 域 RPC 超时后，页面查询、数据读取、setData 和页面方法调用会降级到 App-Service route 查询，避免自动化探针长期卡住；同时完善真实 DOM 与运行时状态验收，降低 request globals 场景的 setData 传输体积，并保持 native 加速能力缺失时的回退路径。** [`1f62703`](https://github.com/weapp-vite/weapp-vite/commit/1f62703e60b9db5223ef349ad4dff7ac4f16bdfc) by @sonofmagic

- 🐛 **修复微信开发者工具真实运行时中的插件页面识别、插件路由跳转、选择器查询、WXML 读取与页面栈切换稳定性，并确保 Wevu 组件注册在默认导出前完成。IDE 自动化现在会对受限协议提供明确的降级证据，同时保留真实路由、DOM 状态和构建产物验收。** [`99a816a`](https://github.com/weapp-vite/weapp-vite/commit/99a816ab79b0d93aed711a5b54f4ae4b0a4a86e3) by @sonofmagic

## 1.2.5

### Patch Changes

- 🐛 **修复 `wv dev -o` 打开微信开发者工具后没有稳定接入 `forwardConsole` 的问题，避免日志桥接在自动化会话未就绪时二次拉起开发者工具，并优化小程序日志的终端颜色展示。** [`cd13a17`](https://github.com/weapp-vite/weapp-vite/commit/cd13a176f129a82cf6e4b58a5ba7449d77bd2175) by @sonofmagic

## 1.2.4

### Patch Changes

- 🐛 **增强 DevTools 截图链路的超时与可恢复失败重试能力，避免 IDE 自动化、MCP runtime 截图和 `weapp-ide-cli screenshot` 在 `App.captureScreenshot` 暂时无响应或返回截图失败时直接中断。** [`1e8dc3d`](https://github.com/weapp-vite/weapp-vite/commit/1e8dc3d5dfa0cbbb409b304c2dc3ebac97b7443b) by @sonofmagic

## 1.2.3

### Patch Changes

- 🐛 **自动补充依赖升级发布记录。** [`7df6ac4`](https://github.com/weapp-vite/weapp-vite/commit/7df6ac4c8dfc677aeb63b370c6a835a5baa0c51d) by @sonofmagic
  涉及包：
  - @weapp-vite/miniprogram-automator：devDependencies.sharp
  - @weapp-vite/qr：dependencies.sharp

- 🐛 **修复 wevu 页面布局、作用域插槽和无脚本组件在真实小程序运行时中的输出稳定性，并增强 DevTools 自动化连接、截图和 HMR fixture 的清理与恢复，避免 IDE 全量回归受残留会话或脏 fixture 状态影响。** [#679](https://github.com/weapp-vite/weapp-vite/pull/679) by @sonofmagic
- 📦 **Dependencies** [`7df6ac4`](https://github.com/weapp-vite/weapp-vite/commit/7df6ac4c8dfc677aeb63b370c6a835a5baa0c51d)
  → `@weapp-vite/qr@1.1.1`

## 1.2.2

### Patch Changes

- 🐛 **修复自动分配 DevTools 自动化端口时的并发会话冲突：启动成功后端口租约会保留到会话关闭或断开，避免多个活跃会话复用同一个自动化端口。** [`90f71b0`](https://github.com/weapp-vite/weapp-vite/commit/90f71b013cd6314977d3054fedbbc043eb24dcfd) by @sonofmagic

## 1.2.1

### Patch Changes

- 🐛 **修复 DevTools 自动化会话生命周期与截图恢复逻辑，为 wevu + Tailwind CSS + TDesign 模板补充稳定选择器，并把真实 IDE 打开、截图、DOM 操作与登录失效诊断流程纳入 e2e 覆盖。** [`574c130`](https://github.com/weapp-vite/weapp-vite/commit/574c130f8c18b40cb60af8c97e38cd2db46da1ad) by @sonofmagic

## 1.2.0

### Minor Changes

- ✨ **支持按端口或 sessionId 区分多个 DevTools automator 会话，并为自动启动流程增加并发安全的端口租约，避免多个自动化任务同时启动时争抢同一个 websocket 端口。** [#661](https://github.com/weapp-vite/weapp-vite/pull/661) by @sonofmagic

## 1.1.3

### Patch Changes

- 🐛 **为小程序自动化请求补充单次调用级 timeout，并修复请求定时器没有使用自定义 timeout 的问题。页面读取和路由切换现在可以按调用场景配置更短的探测超时与重试策略，避免微信开发者工具 App 页面协议异常时长时间阻塞 IDE e2e。** [`3eb68b6`](https://github.com/weapp-vite/weapp-vite/commit/3eb68b6e3d31ffc29c90c4c29a44ce0fc05fd1ea) by @sonofmagic

## 1.1.2

### Patch Changes

- 🐛 **修复 DevTools 在 `App.getCurrentPage` 持续超时后无法回退到 `App.getPageStack` 的问题，避免 IDE 运行时在路由切换和当前页面读取阶段卡死。该修复直接提升了 issue #597、#599、#600 这类依赖 IDE 运行结果的稳定性。** [`28bade7`](https://github.com/weapp-vite/weapp-vite/commit/28bade743e164d87316fd8949d6c82fd3dda1e07) by @sonofmagic

## 1.1.1

### Patch Changes

- 🐛 **将内部调试日志依赖从 `debug` 替换为更轻量的 `obug`，同步脚手架依赖 catalog，并升级 dashboard 路由相关依赖类型以保持当前依赖版本兼容。** [`4276782`](https://github.com/weapp-vite/weapp-vite/commit/4276782841181ef7b540be4eb5e722e979f4363f) by @sonofmagic

## 1.1.0

### Minor Changes

- ✨ **为 `Launcher` 和 `Automator` 增加平台选择能力，默认保持微信自动化行为不变，并提供轻量 TypeScript 百度智能小程序自动化 runtime，支持通过 `platform: 'swan'` 或 `platform: 'baidu'` 启动。** [`f0d3142`](https://github.com/weapp-vite/weapp-vite/commit/f0d3142250ec0ac70329215009ef5f0cff144ad9) by @sonofmagic

## 1.0.5

### Patch Changes

- 🐛 **修复 DevTools console 日志启用超时时可能导致常驻 MCP/REST 服务退出的问题，并让 streamable-http MCP 服务使用带会话的 transport，确保标准 MCP client 可以完成初始化和工具发现。** [`6e78d57`](https://github.com/weapp-vite/weapp-vite/commit/6e78d570d4dbf459397410e0c17f8ca2ebafe873) by @sonofmagic

## 1.0.4

### Patch Changes

- 🐛 **继续增强微信开发者工具命令链路的稳定封装。`weapp-ide-cli` 新增了更完整的程序化命令层与顶层 helper 分发，覆盖 `open`、`login`、`preview`、`upload`、`cache`、`close`、`quit`、`build-npm`、`open-other`、`auto`、`auto-replay`、`build-apk`、`build-ipa`、`reset-fileutils`、`engine build` 等官方命令，并为 `engine build` 补齐了 `logPath` 日志落盘语义；同时补充了 DevTools HTTP `engine build` 流程，以及基于已打开 automator 会话优先执行的 `Tool.*` 程序化 helper（如 `compile`、`clearCache`、`toolInfo`、`ticket` 相关能力）。`weapp-vite` 则开始在 IDE 顶层转发、统一执行器与 `npm` / `close` 等入口优先复用这些稳定 helper，并新增 `wv ide info`、`wv ide test-accounts`、`wv ide ticket`、`wv ide ticket:set`、`wv ide ticket:refresh` 等用户入口，减少对原始 argv 透传和官方 CLI 黑盒行为的直接耦合。** [`1ebbab3`](https://github.com/weapp-vite/weapp-vite/commit/1ebbab3f3a650caf146f340be39a0b63491f9e46) by @sonofmagic

- 🐛 **修复 `github-issues` 等场景下自动路由误收集脚本辅助文件导致 `app.json` 指向不存在页面的问题，并增强 IDE 自动化路由等待逻辑，降低微信开发者工具协议短暂超时造成的误判。** [`6549dba`](https://github.com/weapp-vite/weapp-vite/commit/6549dbad5aea7592d4b5c694c9fc7788f62c16bb) by @sonofmagic

- 🐛 **修复 `weapp-vite dev --open` 的微信开发者工具快捷键与会话协同逻辑。现在 `r` 仅用于手动重新构建当前小程序产物，不再误触发开发者工具项目重开；`c` / `C` 改为重置当前 automator 会话或重置后重开项目。与此同时，`weapp-ide-cli` 新增基于 DevTools HTTP `/open` 的项目重开能力，并统一共享输入挂起与登录重试处理，避免快捷键、重试确认和已打开会话之间发生按键冲突。** [`b3a30a3`](https://github.com/weapp-vite/weapp-vite/commit/b3a30a3454ad0ed441b14c97a15cd5e230a628b5) by @sonofmagic

## 1.0.3

### Patch Changes

- 🐛 **改进微信开发者工具打开项目的兼容性：启动前会检测并尊重用户当前的服务端口配置，不再盲目覆盖已有设置；当用户关闭服务端口时，会保留原配置并回退到普通打开流程。同时补齐 Windows 下的默认 CLI 路径探测、批处理启动兼容、项目信任预写入与调试回退错误定位，降低 automator 打开项目时的启动与信任失败概率。** [`cd33619`](https://github.com/weapp-vite/weapp-vite/commit/cd336193b4cd6c7002e574d1eeb9031c14755484) by @sonofmagic

## 1.0.2

### Patch Changes

- 🐛 **修复微信开发者工具自动化会话在启动抖动阶段容易误判为“HTTP 服务端口未开启”的问题。现在会在 `Extension context invalidated`、websocket 启动超时等可恢复场景下自动重试一次，并在仍然失败时输出更贴近真实状态的错误分类。同步修正 `weapp-vite-tailwindcss-vant-template` 的布局演示页操作区排版，避免 `@vant/weapp` 按钮以内联方式挤压换行导致页面错乱。** [`b4cfb7b`](https://github.com/weapp-vite/weapp-vite/commit/b4cfb7b6503ee4fc8758b9275aabd5f57372dd3e) by @sonofmagic

- 🐛 **修复小程序截图链路在微信开发者工具无响应或自动化会话异常时的诊断行为，并为 `weapp-vite screenshot` / `wv screenshot` / `weapp-ide-cli screenshot` 新增 `--full-page` 整页长截图能力。现在截图命令会正确等待异步命令完成；当 DevTools websocket 连接失败、截图请求长时间不返回，或清理会话时 `App.exit` / `Tool.close` 无响应时，会显式抛出可排查的错误提示，而不再静默退出或表现为“成功但没有产物”；同时 `--page pages/...` 这类常见写法也会自动归一化为小程序路由所需的前导 `/`。** [`2a5882b`](https://github.com/weapp-vite/weapp-vite/commit/2a5882b016a6018ae5e5e73d48db11a3e0456676) by @sonofmagic

## 1.0.1

### Patch Changes

- 🐛 **将 `@weapp-vite/miniprogram-automator` 内部的二维码编码、解码与终端渲染能力提取为新的 `@weapp-vite/qr` 包，并让原有 automator API 改为复用该独立包实现，方便在仓库外单独安装与复用。** [`fcf09b3`](https://github.com/weapp-vite/weapp-vite/commit/fcf09b343c38ca1d5abe662dd15dd6d9414f1ab3) by @sonofmagic
- 📦 **Dependencies** [`fcf09b3`](https://github.com/weapp-vite/weapp-vite/commit/fcf09b343c38ca1d5abe662dd15dd6d9414f1ab3)
  → `@weapp-vite/qr@1.1.0`

## 1.0.0

### Major Changes

- 🚀 **重构 `weapp-ide-cli` 的命令行入口，改为基于 `cac` 的顶层命令注册与解析，同时继续保持现有微信开发者工具透传命令、automator 子命令、`config` 子命令与 `minidev` 转发入口的兼容行为。内部的 automator 会话层也已切换到现代化的 `@weapp-vite/miniprogram-automator` 命名导出与 `Launcher` 启动路径。** [`d94a443`](https://github.com/weapp-vite/weapp-vite/commit/d94a44378ad53b3b27019bed4855f782926147ff) by @sonofmagic
  - `@weapp-vite/miniprogram-automator` 现在只发布 ESM 产物，不再提供 CJS 入口。包导出与构建配置已经同步收敛为纯 ESM 形式，使用 `require()` 加载该包的旧调用方式将不再受支持。

### Minor Changes

- ✨ **新增 `@weapp-vite/miniprogram-automator` 包，作为对微信官方 `miniprogram-automator` 的现代化兼容替代实现，提供纯根入口 named exports、`MiniProgram / Page / Element / Native` 等核心类、内置二维码解析与终端渲染能力，并接入 `weapp-vite` 生态内的 headless 运行时适配能力。** [`a979852`](https://github.com/weapp-vite/weapp-vite/commit/a97985294bb7f2fd7321aafd28b0faad4d383c8e) by @sonofmagic
  - 同时将 `weapp-ide-cli` 与仓库内 e2e 运行时切换到新的 workspace automator 包，为后续完全替换官方依赖做准备。

## 0.0.0

- 初始实现
