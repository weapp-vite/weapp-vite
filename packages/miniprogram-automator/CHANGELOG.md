# @weapp-vite/miniprogram-automator

## 1.3.0

### Minor Changes

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

### Patch Changes

- feat(automator): 新增 AppService JS heap 能力探测，区分真实内存观察值、不支持和协议错误。

  - 新增 AppService JS heap 能力探测，返回已用/已分配字节或明确不支持原因；`Method not implemented.` 仅标记能力不支持。连接超时、无效响应及其他真实错误继续报错，未知内存不记为零并允许后续重新探测。

- fix(automator): 完善真实微信开发者工具的页面就绪、异步方法调用与内存能力观察，保留原生页面身份和组件查询作用域。

  - 启动等待原生协议返回有效页面标识与路径，截图协议响应不再被视为页面已注册；沿用原启动预算，不追加导航、编译或页面栈回退，连接关闭及不可恢复错误及时退出。
  - 同路径导航同时核对请求 query，当前页和页面栈轮询等待真实参数出现，保留宿主额外参数；持续不符时报超时，不将请求值伪装为旧页面观察值。
  - Stable 2.02.2608080 与 Nightly 2.02.2610082/2.02.2610092 沿用 AppService 兼容调用访问真实页面实例并等待异步返回，修复方法返回空对象或调用失败，保留元素查询与组件作用域。

- fix(mpcore): 对齐 mpcore Node/浏览器模拟器的原生生命周期、插槽和导航行为，并完善独立测试产物及会话释放。

  - Component 页面同时声明顶层生命周期和 pageLifetimes 时不再重复回调；双向派发页面事件。`navigateTo` 的 success/complete 等待目标 ready 与渲染提交后执行。
  - 插槽投影保留事件，attached 同步事件沿承载者传播；`selectOwnerComponent()` 遵循 `wx://component-export`，测试桥仍可访问原始实例。
  - 声明生命周期独立于可见投影：初始关闭的默认/具名插槽仍创建有效子组件，关闭不卸载、删除声明才释放；转发复用声明，循环按宿主归一化的有效 key 保持实例身份并无损编码 UTF-16 地址。
  - 对齐私有模板构造、created、初始 observer 和 attached 的顺序；隐藏声明可查询但不进入组合可见树或被就绪探针误报为正尺寸节点。
  - 挂载期间父级写入、条件插入与 observer 重入会同步最新有效属性，避免旧遍历覆盖兄弟节点。created 中 setData 后仍保留私有子树构造/属性交付边界；卸载写入不引发重入循环，事务刷新改为迭代避免兄弟 attached 写入累积调用栈。
  - WXML 插值前移除标签间静态换行缩进，保留绑定表达式生成的显式空格，Node/browser 行为一致。
  - headless 会话提供同步幂等 `disconnect()`，释放所属 runtime，包括启动取消后迟到的资源，保留其他项目；外部 automator bridge 登记会话供 CLI 安全复用。

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
  - @weapp-vite/qr@1.1.9

## 1.2.23

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

- 兼容微信开发者工具 2.02.2608070 的页面方法调用协议缺陷，通过已有 AppService 调用路径保留原生页面实例与方法接收者，同时保持元素查询的原生组件作用域。

- 兼容微信开发者工具 2.02.2609231 的 Page 帧协议异常，仅通过已有 AppService 页面方法协议调用真实页面实例，避免方法存在却调用失败，同时保留原生元素查询和组件作用域。

- 导航期间页面帧尚未就绪时，重试一次无副作用的原生元素查询，避免首次协议超时就退回不支持真实点击的只读元素。显式禁用回退的限时探针保持单次请求。

- Updated dependencies:
  - @weapp-vite/qr@1.1.8

## 1.2.22

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

- Updated dependencies:
  - @weapp-vite/qr@1.1.7

## 1.2.21

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
  - @weapp-vite/qr@1.1.6

## 1.2.20

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
  - @weapp-vite/qr@1.1.5

## 1.2.19

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

- Updated dependencies:
  - @weapp-vite/qr@1.1.4

## 1.2.18

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

- Updated dependencies:
  - @weapp-vite/qr@1.1.3

## 1.2.17

### Patch Changes

- 连接开发者工具时，WebSocket 建立与基础库版本检查共用一次超时预算；版本检查失败或预算耗尽时释放尚未交付的连接，避免遗留连接与后续重试重叠。

- 修复新版微信基础库中控制台日志转发依赖 IDE Console 面板开启的问题。日志初始化主动启用 Runtime 日志域，并保留旧版基础库的 console 包装兼容路径；合并并发初始化，保留超时预算与失败后的重试能力。

- 允许页面就绪探针显式关闭页面栈回退，配合单次尝试与协议超时，避免冷启动期间的页面元数据暂缺触发额外请求并超出调用方的就绪预算。

- 修复新版微信基础库 XPath 多节点查询直接返回数组时的协议解析，兼容旧版 elements 包装格式，并继续对缺失或异常响应报错。单节点查询正确保留新版基础库的未匹配 null 结果。

- 修复 DevTools 自动化查询选项跨执行上下文传递时的对象克隆错误，保留节点几何信息、dataset 和计算样式查询。

- 修复新版微信开发者工具 `/auto` 返回不透明 token 时被误判为失败的问题：成功响应使用请求的自动化端口建立连接，保留旧版响应兼容，并避免错误信息泄露响应 token。

- 为测试页面提供只读的 `pageId`，重新查询同一页面时保持稳定，同路由重新创建页面时生成独立身份，防止验收工具把旧页面的渲染结果归入新页面。

- 增加可选结构化日志采集，使用 CDP 数据描述符读取 Error 的非枚举消息和堆栈，避免 SDK 序列化后丢失为普通空对象。保留启动失败和断开连接前的错误证据，并按原始顺序发布单一来源日志；默认日志格式保持兼容。

## 1.2.16

### Patch Changes

- 修复微信开发者工具返回异常 XPath 集合响应时泄漏无上下文 `map` 错误的问题，改为报告明确的协议方法与缺失字段，便于 MCP runtime tools 和自动化调用定位兼容性限制。

- Updated dependencies:
  - @weapp-vite/qr@1.1.2

## 1.2.15

### Patch Changes

- 修复新版微信开发者工具中 automator 启动重复打开项目和嵌套就绪探针放大总超时的问题，并支持按 npm 包配置复制文件范围，减少原生小程序组件库进入构建产物的无关文件和首次启动压力。

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
