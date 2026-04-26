# weapp-vite

## 6.15.17

### Patch Changes

- 📦 **Dependencies** [`4884ea5`](https://github.com/weapp-vite/weapp-vite/commit/4884ea5c2cb13e267ed245f8b42ed74b8ea09fa4)
  → `wevu@6.15.17`, `@weapp-core/constants@0.1.3`, `@weapp-vite/ast@6.15.17`

## 6.15.16

### Patch Changes

- 🐛 **修复开发模式 HMR 在 6.15.15 中因额外 snapshot build 导致的回退：普通 watcher 结束后不再补跑全量 snapshot，直接 sidecar 更新改为标记对应入口并交给主 watcher 增量写盘，仅在新增、删除或无法定位入口时保留全量 snapshot 兜底。** [`1b5f77c`](https://github.com/weapp-vite/weapp-vite/commit/1b5f77c11e8ef438fca34c2695994227478385f4) by @sonofmagic
- 📦 **Dependencies** [`664cb3e`](https://github.com/weapp-vite/weapp-vite/commit/664cb3ee6f9f515c759368a0d7ddb27dcee7ca2c)
  → `wevu@6.15.16`, `@weapp-vite/ast@6.15.16`

## 6.15.15

### Patch Changes

- 🐛 **继续增强小程序文件型热更新的原因解释日志，把 layout 传播、layout 回退全量和 auto-routes 拓扑变化纳入 pending 原因摘要，帮助开发阶段快速判断本次重构建是否由布局依赖或路由拓扑变更触发。** [`65cca45`](https://github.com/weapp-vite/weapp-vite/commit/65cca457437bf0e5e6dafd9957930c85ec377877) by @sonofmagic

- 🐛 **增强开发态 HMR profile 的粗粒度阶段采样：新增 `buildCoreMs`、`transformMs`、`writeMs` 指标，并同步到 JSONL profile、`analyze --hmr-profile` 聚合结果与 IDE/CLI 摘要，便于定位热更新慢点是在核心构建、transform 还是写盘尾段。** [`500b3c1`](https://github.com/weapp-vite/weapp-vite/commit/500b3c116105b8d9a4b2087a95044665f02a0724) by @sonofmagic

- 🐛 **优化小程序文件型热更新里 shared chunk 关联项的增量判定路径，避免每次 watch 重构都全量扫描所有 shared chunk importer 集合，并补齐反向索引与回归测试以保持部分重构语义稳定。** [`45f8533`](https://github.com/weapp-vite/weapp-vite/commit/45f8533e5e4a4237000dd857189b4860ee131963) by @sonofmagic

- 🐛 **修复 Vue 页面与共享 chunk 相关的 HMR 回归，恢复无显式 page hook hint 时的页面特性注入，并补回样式块预解析与构建轮次级 compileOptions 缓存隔离，避免 watch 重编译时出现组件默认导出丢失。** [`fb991fc`](https://github.com/weapp-vite/weapp-vite/commit/fb991fc16e227a1a8517cfb3a86ccaad4bddaf37) by @sonofmagic

- 🐛 **修复小程序文件级热更新中 `auto-routes` 与 `layout` 链路的多余失效、全量重扫、删除窗口期误报与状态丢失问题，并收敛对应 e2e 断言到稳定的重构建信号。** [`385ebeb`](https://github.com/weapp-vite/weapp-vite/commit/385ebebc9965c1468a21340dd317f23c39351cb2) by @sonofmagic

- 🐛 **在开发态文件型热更新中，当启用 HMR profile JSONL 输出且最近一次重建明显慢于近期均值时，追加提示开发者运行 `weapp-vite analyze --hmr-profile`，把慢样本诊断从日志直接闭环到结构化分析命令。** [`2614395`](https://github.com/weapp-vite/weapp-vite/commit/2614395e7145d72137571fa85681f65fe6a35e73) by @sonofmagic

- 🐛 **增强小程序文件型热更新的阶段采样与原因解释日志，新增 shared chunk 解析耗时、脏标记来源摘要与 pending 扩张原因摘要，帮助开发阶段更快定位为何触发增量或扩大量重构建。** [`485e021`](https://github.com/weapp-vite/weapp-vite/commit/485e021b77f321ecd9a8d7c9956cbb8057bd3159) by @sonofmagic

- 🐛 **为小程序文件型热更新新增可选的 JSONL profile 输出能力，支持把单次变更的 watch 到脏标记、shared chunk 解析、emit 以及 dirty/pending 原因摘要落盘，方便持续定位开发态体感延迟到底卡在构建链路的哪一段。** [`504aadc`](https://github.com/weapp-vite/weapp-vite/commit/504aadcdf1461f639013dd22f1129302ed8f8dd2) by @sonofmagic

- 🐛 **为 `weapp-vite analyze` 增加 `--hmr-profile` 模式，可读取文件型热更新生成的 JSONL profile 并输出聚合后的阶段耗时、事件分布、dirty/pending 原因和最慢样本，方便开发者直接定位热更新慢点。** [`2d39c91`](https://github.com/weapp-vite/weapp-vite/commit/2d39c91ede8a4ed09e4a79e9479209eced1c18f1) by @sonofmagic

- 🐛 **修复 `weapp auto-preview -p` 在微信开发者工具不在前台时可能无法唤起小程序预览的问题。现在 `auto-preview` 会在执行前先按同一项目定位信息唤起开发者工具，再继续运行官方自动预览命令，提升后台场景下的预览启动稳定性。** [#506](https://github.com/weapp-vite/weapp-vite/pull/506) by @sonofmagic

- 🐛 **在 `weapp-vite ide logs` 启动日志桥前读取最近一次 HMR profile 样本，并输出简洁的热更新阶段摘要，帮助开发者在查看 IDE 日志前先看到最近一次文件型热更新的大致耗时与主耗时阶段。** [`6878cb9`](https://github.com/weapp-vite/weapp-vite/commit/6878cb93afce717100b89f6f3e2c24ed85b10e58) by @sonofmagic

- 🐛 **修复开发态 HMR 的 shared chunk / snapshot emit 路径，约束最终 dist 产物统一来自 Vite 或 Rolldown 的原生 emit/write，避免通过手动写文件生成构建输出，并补齐相关回归测试与流程约束。** [`8dad804`](https://github.com/weapp-vite/weapp-vite/commit/8dad80499848e6827ce10be37818fb5ccd8a0eff) by @sonofmagic

- 🐛 **补充开发态 HMR 日志分层开关：新增 `weapp.hmr.logLevel`，支持 `default`、`concise`、`verbose` 三档输出。默认仅展示总耗时，简洁与详细诊断只在显式开启时输出。** [`d157615`](https://github.com/weapp-vite/weapp-vite/commit/d157615436e43046517cddadf1336b1b788ea97d) by @sonofmagic

- 🐛 **修复 ESM shared chunk 中 request runtime 安装代码覆盖第三方库同名局部变量的问题，并稳定微信开发者工具打开后的项目索引刷新流程。现在 request globals 共享安装阶段只同步运行时 actuals 与 `globalThis`，避免把 `Request`、`WebSocket` 等 Web API 绑定回写到 chunk 内部变量；同时 `wv open` / `wv dev --open` 会在打开后刷新项目、重置 fileutils 并在 HTTP engine build 端点缺失时回退到官方 CLI，减少模拟器首次启动时读取陈旧配置导致的 `subPackages` 异常。** [`471286e`](https://github.com/weapp-vite/weapp-vite/commit/471286ea43d918d07c0dd38058429987c0c335e1) by @sonofmagic

- 🐛 **在 `dev` 快捷键的重开开发者工具动作中追加最近一次 HMR 摘要，让 `o` / `C` 热键执行后显示的“最近操作”同时带出文件型热更新的最近耗时与主耗时阶段。** [`d5921e5`](https://github.com/weapp-vite/weapp-vite/commit/d5921e59ebb68c391ea18c5eb7ef978506f026f8) by @sonofmagic

- 🐛 **修复 Vue SFC 模板中 `<slot />` 携带 `v-if` / `v-else-if` / `v-else` 时条件指令丢失的问题，确保编译到小程序模板后保留对应平台条件分支。** [#503](https://github.com/weapp-vite/weapp-vite/pull/503) by @sonofmagic

- 🐛 **在 `weapp-vite open` 执行前也会读取最近一次 HMR profile 样本并输出简洁摘要，让手动重开开发者工具时同样能看到最近一次文件型热更新的耗时与主耗时阶段。** [`40933d1`](https://github.com/weapp-vite/weapp-vite/commit/40933d1bd66ca0e25cd8beff679a6b2d2833746e) by @sonofmagic

- 🐛 **收紧开发态 HMR 默认日志的单行长度：压缩 `dirty/pending/emitted` 统计、简写原因摘要，并把滚动趋势缩减为 `avg/max`，减少频繁热更新时的终端噪音。** [`efa0bb0`](https://github.com/weapp-vite/weapp-vite/commit/efa0bb0f1a4d69d7d8ed6f101bf4ab5492fbde2d) by @sonofmagic

- 🐛 **在开发态 HMR 慢样本提示里补充“疑似慢段”摘要，会优先指出 `watch->dirty`、`emit` 或 `shared` 哪一段相对近期均值回归最明显，帮助开发者在进入 `analyze --hmr-profile` 前先快速判断问题大致落点。** [`18f6f2d`](https://github.com/weapp-vite/weapp-vite/commit/18f6f2d5b210728c1f4f990040229000e7e9e283) by @sonofmagic
- 📦 **Dependencies** [`56dc259`](https://github.com/weapp-vite/weapp-vite/commit/56dc2592e5c4d9c5c6e5ddb3cae809f6e8a16c4a)
  → `wevu@6.15.15`, `weapp-ide-cli@5.2.6`, `@weapp-vite/ast@6.15.15`

## 6.15.14

### Patch Changes

- 🐛 **增强 `weapp-vite dev --open` 的终端开发快捷键体验：新增手动重新构建、清理微信开发者工具 compile/全部缓存、重新打开当前 DevTools 项目等快捷键，并把帮助面板与动作执行统一收敛为可扩展的热键注册表，方便后续继续扩展更多开发态调试操作。** [`80932ff`](https://github.com/weapp-vite/weapp-vite/commit/80932ff0bed75f97782ccd969d3b3db5835f99dd) by @sonofmagic

- 🐛 **修复开发态快捷键与小程序产物重建流程：将 `r` 调整为通知微信开发者工具重新编译当前项目，将手动重建产物改为 `R`，并修复 dev 重建清空 `dist` 后因 emit 缓存未失效导致 `app.json` 等产物未重新写回的问题。** [`7e9447c`](https://github.com/weapp-vite/weapp-vite/commit/7e9447c157298d7ecb6341060b00b17f51bd43fe) by @sonofmagic

- 🐛 **修复 `injectRequestGlobals` 与 `appPrelude` 联用时的 IDE 运行时模块装载问题。现在会避免把 request-globals support chunk 继续拆成额外共享模块，而是折叠回 `request-globals-runtime.js` 并统一改写相关引用，避免微信开发者工具在主包运行时出现 `module "... is not defined"` 的异常日志；同时补充了 request-globals 共享绑定注入与构建产物形态的回归测试，防止后续再次回退到不稳定的 chunk 结构。** [`3c81dae`](https://github.com/weapp-vite/weapp-vite/commit/3c81daee04b236bd2461e2235c6c388517bcb5b3) by @sonofmagic

- 🐛 **继续增强微信开发者工具命令链路的稳定封装。`weapp-ide-cli` 新增了更完整的程序化命令层与顶层 helper 分发，覆盖 `open`、`login`、`preview`、`upload`、`cache`、`close`、`quit`、`build-npm`、`open-other`、`auto`、`auto-replay`、`build-apk`、`build-ipa`、`reset-fileutils`、`engine build` 等官方命令，并为 `engine build` 补齐了 `logPath` 日志落盘语义；同时补充了 DevTools HTTP `engine build` 流程，以及基于已打开 automator 会话优先执行的 `Tool.*` 程序化 helper（如 `compile`、`clearCache`、`toolInfo`、`ticket` 相关能力）。`weapp-vite` 则开始在 IDE 顶层转发、统一执行器与 `npm` / `close` 等入口优先复用这些稳定 helper，并新增 `wv ide info`、`wv ide test-accounts`、`wv ide ticket`、`wv ide ticket:set`、`wv ide ticket:refresh` 等用户入口，减少对原始 argv 透传和官方 CLI 黑盒行为的直接耦合。** [`1ebbab3`](https://github.com/weapp-vite/weapp-vite/commit/1ebbab3f3a650caf146f340be39a0b63491f9e46) by @sonofmagic

- 🐛 **修复 `github-issues` 等场景下自动路由误收集脚本辅助文件导致 `app.json` 指向不存在页面的问题，并增强 IDE 自动化路由等待逻辑，降低微信开发者工具协议短暂超时造成的误判。** [`6549dba`](https://github.com/weapp-vite/weapp-vite/commit/6549dbad5aea7592d4b5c694c9fc7788f62c16bb) by @sonofmagic

- 🐛 **修复已本地化到 `miniprogram_npm` 的 copied `miniprogram` / `miniprogram_dist` 依赖在页面产物里仍保留 Node 模式 `__toESM(..., 1)` 的互操作问题。现在会沿着同作用域别名链追踪这些本地 npm 绑定，并统一降级为普通 `__toESM(...)` 包装，避免 `Dialog.confirm is not a function`、`.default.default` 等双层默认导出回归，同时补齐主包与分包 alias 链路的回归覆盖。** [`a3d3d56`](https://github.com/weapp-vite/weapp-vite/commit/a3d3d5671a1567b71d112cc32fb0b6e74e503ac2) by @sonofmagic

- 🐛 **修复 `weapp-vite prepare` 在安装阶段通过 Vite `runner` 加载配置时遗留大量原生句柄、导致宿主环境里的 `pnpm install` 在末尾长时间卡住的问题。现在 `prepare` 会改用更轻量的 `native` 配置加载模式，并局部抑制 Node 针对无 `type` 的临时 TS 配置告警，避免安装收尾阶段无响应。** [`82bb8a0`](https://github.com/weapp-vite/weapp-vite/commit/82bb8a0243c23c953047d282fb103bef3ea8156f) by @sonofmagic

- 🐛 **修复 `weapp-vite dev --open` 的微信开发者工具快捷键与会话协同逻辑。现在 `r` 仅用于手动重新构建当前小程序产物，不再误触发开发者工具项目重开；`c` / `C` 改为重置当前 automator 会话或重置后重开项目。与此同时，`weapp-ide-cli` 新增基于 DevTools HTTP `/open` 的项目重开能力，并统一共享输入挂起与登录重试处理，避免快捷键、重试确认和已打开会话之间发生按键冲突。** [`b3a30a3`](https://github.com/weapp-vite/weapp-vite/commit/b3a30a3454ad0ed441b14c97a15cd5e230a628b5) by @sonofmagic

- 🐛 **保持 `weapp.jsFormat` 默认值为 `cjs`，同时补齐 `esm` / `cjs` 双格式回归覆盖，并修复显式 `esm` 场景下请求相关全局注入缺失的问题。** [#491](https://github.com/weapp-vite/weapp-vite/pull/491) by @sonofmagic

- 🐛 **修复开发态终端输入冲突：当 `wv dev` 的快捷键与微信开发者工具登录失效后的“按 r 重试”交互同时存在时，统一由共享输入协调器管理 `stdin`，避免 DevTools 重试按键被外层热键错误拦截。** [`79105e6`](https://github.com/weapp-vite/weapp-vite/commit/79105e635727529ee06d1434eed0fb57a08843e5) by @sonofmagic

- 🐛 **修复小程序 `.vue` 文件中裸 `import.meta.env` 被展开为多行对象后导致源码调试行号偏移的问题。现在聚合 env 会保持为单行表达式，同时补齐 `issue #475` 的 page/component 回归覆盖，避免页面与组件调试定位再次漂移。** [#495](https://github.com/weapp-vite/weapp-vite/pull/495) by @sonofmagic

- 🐛 **为普通 `template v-slot` 新增 `weapp.vue.template.slotSingleRootNoWrapper` 配置开关，默认值为 `false`，保持原先的包裹行为不变；当显式开启后，只有“单个可投影根节点”会把 `slot` 直接下推到该子节点，避免额外生成包裹用的 `<view>`。多子节点场景仍会保留真实 `<view slot="...">...</view>` 容器，以避免 `<block slot="...">` 在小程序运行时里出现整组内容丢失的问题。这让 `<template #icon><img /></template>` 这类迁移自 Web Vue 的写法既可以按需保留 `img -> image` 的标签映射，又能在开启新行为时减少单节点场景的布局错乱。** [#497](https://github.com/weapp-vite/weapp-vite/pull/497) by @sonofmagic

- 🐛 **修复并收敛小程序开发态的 DevTools 交互流程：`weapp-vite dev --open` 现在将 `r` 明确用于通知微信开发者工具重新编译，将手动重新构建产物调整为 `R`，并修复手动重建清空 `dist` 后 `app.json` 等关键产物未重新写回的问题；同时统一 IDE 打开、登录失效重试与终端按键输入协调逻辑，避免在微信开发者工具登录过期时出现热键监听、重试提示与重新编译动作互相干扰的情况。** [`b759e42`](https://github.com/weapp-vite/weapp-vite/commit/b759e42b1b8d1e42ae1e8de60ed64418364bdb0c) by @sonofmagic
- 📦 Updated 9 dependencies [`2a9ea57`](https://github.com/weapp-vite/weapp-vite/commit/2a9ea57748425265c35533646bdc0c3fa70c440f)
  <details><summary>Details</summary>

  `@wevu/api@0.2.6`, `rolldown-require@2.0.15`, `wevu@6.15.14`, `weapp-ide-cli@5.2.5`, `@weapp-vite/miniprogram-automator@1.0.4`, `@weapp-core/constants@0.1.2`, `@wevu/web-apis@1.2.10`, `@weapp-vite/web@1.3.19`, `@weapp-vite/ast@6.15.14`

  </details>

## 6.15.13

### Patch Changes

- 🐛 **修复原生小程序页面默认导入 `tdesign-miniprogram/dialog` 或 `tdesign-miniprogram/dialog/index` 时的 ESM/CJS 互操作回归。现在当页面产物中的 npm require 已被本地化到 `miniprogram_npm` 后，`weapp-vite` 会同步去掉错误的 `__toESM(..., 1)` Node 模式包装，避免 `Dialog.confirm is not a function` 这类双层 `default` 问题；同时补齐 copied `miniprogram` / `miniprogram_dist`、alias 回写、本地化构建产物与 DevTools 运行时的回归覆盖。** [`d0ebfd3`](https://github.com/weapp-vite/weapp-vite/commit/d0ebfd31aeadf6155d3f3e37437371bbf0dd6a19) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.15.13`, `wevu@6.15.13`

## 6.15.12

### Patch Changes

- 🐛 **修复 `config.define` 中 `import.meta.env.*` 自定义定义在 `weapp-vite` 预处理链路中丢失的问题，使 `.vue` 页面与其直接引用脚本中的成员访问行为重新与 Vite 保持一致，并补齐对应的回归测试与 issue 复现用例。** [#485](https://github.com/weapp-vite/weapp-vite/pull/485) by @sonofmagic

- 🐛 **修复 `weapp-vite prepare` 在部分 Wevu / issue 工程中会额外预加载应用入口，导致 `pnpm install` 的 workspace `postinstall` 偶发不退出并看起来卡在 `website postinstall` 的问题。** [`1ddff0e`](https://github.com/weapp-vite/weapp-vite/commit/1ddff0e7226008939e31566fff09329993f4b4c2) by @sonofmagic

- 🐛 **修复 `defineConfig` 回调中解构 `env` 参数时的类型推导问题，并收敛多处测试的临时目录与 fixture 隔离方式，避免 `pnpm test` 在并发执行下出现超时或共享目录冲突。** [`a1f49af`](https://github.com/weapp-vite/weapp-vite/commit/a1f49afc2b23951627f7d3b307d04a63c027d173) by @sonofmagic

- 🐛 **修复 `defineConfig(() => ({ ... }))` 在函数式配置下丢失上下文类型的问题，避免 `weapp.platform` 等联合字面量字段被宽化为 `string` 并导致 `vite.config.ts` 类型报错。** [`d187404`](https://github.com/weapp-vite/weapp-vite/commit/d1874040e3048ed06027db96f20b36da8af6af68) by @sonofmagic

- 🐛 **修复托管 tsconfig 仍然回灌已弃用 `baseUrl` 的问题，并同步更新相关测试夹具，避免 TypeScript 6+ 持续报废弃诊断。** [`c3f2913`](https://github.com/weapp-vite/weapp-vite/commit/c3f2913a00145b802510608a2a50cdcf23c64975) by @sonofmagic

- 🐛 **修复主包页面使用 `tdesign-miniprogram/dialog` 与 `tdesign-miniprogram/dialog/index` 时的 npm 路径本地化错误：现在会把主包 JS `require` 与 `usingComponents` 正确重写到 `dist/miniprogram_npm`，并对目录入口显式补齐 `/index`，避免微信运行时报 `Dialog.confirm is not a function` 或 `组件路径未找到`。同时新增专用 e2e app、构建回归测试与 DevTools 运行时回归测试覆盖该场景。** [#487](https://github.com/weapp-vite/weapp-vite/pull/487) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.15.12`, `wevu@6.15.12`

## 6.15.11

### Patch Changes

- 🐛 **修复 wevu 页面通过本地 helper 间接注册 `onPullDownRefresh`、`onReachBottom` 时，`weapp-vite` 漏掉页面特性注入，导致下拉刷新与触底钩子在最终产物中不生效的问题。** [#481](https://github.com/weapp-vite/weapp-vite/pull/481) by @sonofmagic

- 🐛 **修复 `tdesign-miniprogram/*` 这类通过相对 `node_modules` 的 `miniprogram_dist` / `miniprogram` alias 引入时的 npm 路径归一化。现在这类路径会在依赖识别与产物重写阶段恢复成稳定的包内入口，避免命令式调用 `Dialog.confirm()` 等 API 时命中错误的模块包装层。** [#480](https://github.com/weapp-vite/weapp-vite/pull/480) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.15.11`, `wevu@6.15.11`

## 6.15.10

### Patch Changes

- 🐛 **修复了绝对 `node_modules` alias 导入在 pnpm hoist 安装场景下的 npm 包根解析问题。现在即使导入路径指向包内不存在的局部 `node_modules` 位置，`weapp-vite` 也会按 Node 解析规则回退到真实安装位置读取包的 `miniprogram` 配置，从而正确去掉 `tdesign-miniprogram/miniprogram_dist` 这类小程序入口前缀，恢复子包 `miniprogram_npm` 本地化与相关发布测试流程。** [`66409cf`](https://github.com/weapp-vite/weapp-vite/commit/66409cf9fd5130c51023630f43b1523feedf7c53) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.15.10`, `wevu@6.15.10`

## 6.15.9

### Patch Changes

- 🐛 **修复开发模式下自动导入新建组件时，只更新页面 `usingComponents`、但未补发组件产物的问题。** [#474](https://github.com/weapp-vite/weapp-vite/pull/474) by @sonofmagic

- 🐛 **修复本地分包按依赖列表复制 `miniprogram_npm` 产物时遗漏 copied `miniprogram` 包传递依赖的问题。像 `miniprogram-computed` 这类通过 build-npm 复制的 CJS 小程序包，声明在分包后会继续把 `rfdc`、`fast-deep-equal` 等运行时依赖一并带入分包产物，避免真实 DevTools 运行时报模块缺失。** [#477](https://github.com/weapp-vite/weapp-vite/pull/477) by @sonofmagic

- 🐛 **修复原生小程序构建中复制型 `miniprogram` npm 包的 ESM `default` 互操作问题：当 `tdesign-miniprogram/dialog` 这类依赖以 `export default` 形式发布时，构建产物现在会在缓存与输出阶段统一归一化为带 `__esModule` 标记的 CommonJS，避免页面侧 `require + __toESM` 再次包裹默认导出，导致 `Dialog.confirm is not a function` 一类双层 `default` 报错。** [#477](https://github.com/weapp-vite/weapp-vite/pull/477) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在共享 WXML/WXS 依赖与 WeChat DevTools 运行态下的两类稳定性问题。现在共享模板/脚本模块的 importer 传播和产物引用路径会更稳定，避免构建结果里出现错误的共享依赖落位，`wevu-runtime-e2e` 的 shared template/WXS HMR 场景也会在进入用例前主动恢复基线，避免中断后的脏状态把 `shared-hmr/helper.wxs` 之类的临时依赖残留到后续运行。与此同时，IDE 侧长链路 e2e 用例会在关键场景改用 fresh launch 与更明确的残留清理，减少 DevTools automator bridge 重启和页面 relaunch 失稳导致的误报。** [`209f263`](https://github.com/weapp-vite/weapp-vite/commit/209f263b19afea01e9c2fe9be21bcc4d8bcf66a7) by @sonofmagic

- 🐛 **修复小程序 Web Runtime 的网络兼容层不支持把宿主扩展参数稳定传到底层请求与 Socket 能力的问题。现在除了 `fetch(url, { miniProgram: { ... } })` / `fetch(url, { miniprogram: { ... } })` 和 `axios` 的 `fetchOptions.miniProgram` 之外，还新增了运行时级默认配置能力，可统一作用于 `fetch`、`XMLHttpRequest`、`WebSocket` 以及依赖这些全局对象的 `graphql-request`、`axios(xhr)`、`socket.io-client` 等库。`weapp-vite` 现在也支持直接在 `vite.config.ts` 的 `weapp.appPrelude.webRuntime.networkDefaults` 或 `weapp.injectWebRuntimeGlobals.networkDefaults` 中声明这些默认参数，让 app prelude、bundle runtime 与源码注入链路都能在安装 Web Runtime 时同步下发。显式请求参数会覆盖默认配置，同时仍保持 `url`、`method`、`header`、`data`、`responseType` 等标准字段由兼容层接管，不允许被宿主扩展项破坏。** [`c9c1da1`](https://github.com/weapp-vite/weapp-vite/commit/c9c1da16e3c59a43b6b0fd42ac7f078174447f5f) by @sonofmagic

- 🐛 **修复 `weapp-vite` / `@wevu/compiler` 在 `.vue` 文件源码调试链路中丢失脚本 sourcemap 的问题。现在 Vue SFC 的 `compileScript`、wevu 脚本重写、页面特性注入、`setData.pick` 注入以及最终入口代码拼装会连续传递并组合 sourcemap，避免 `app.vue`、页面与组件在开发者工具里出现不同程度的断点行号偏移。** [#476](https://github.com/weapp-vite/weapp-vite/pull/476) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在 dev/HMR 增量产物里刷新 shared chunk importer 关系时，对“当前 partial emit 缺失中间 shared chunk，但该 chunk 仍继续依赖更深层 vendor helper”的场景处理不完整的问题。现在会同时保留这类缺席 chunk 的嵌套依赖关系，避免 `computed is not a function`、`createComponent is not a function` 这类由 wevu 共享运行时 helper 丢失或未联动重编译导致的偶发报错。** [#474](https://github.com/weapp-vite/weapp-vite/pull/474) by @sonofmagic

- 🐛 **修复 `tdesign-miniprogram/*` 通过 TypeScript alias 指向 `node_modules/.../miniprogram_dist/*` 时的小程序 npm 本地化兼容问题。`weapp-vite` 现在会把 alias 展开的绝对 `node_modules` 文件路径还原成稳定的 npm specifier，再继续走分包 `miniprogram_npm` 重写逻辑，避免 `Dialog.confirm` 这类命令式 API 在产物里落成错误的双层 `default` 访问或错误的 `miniprogram_dist` 路径。** [#477](https://github.com/weapp-vite/weapp-vite/pull/477) by @sonofmagic

- 🐛 **修复 `weapp-vite` 对 `wevu/web-apis` 子路径的工作区包解析与别名映射，避免在本地 workspace / demo app 中引用该子路径时被错误拼接成 `dist/index.mjs/web-apis` 一类无效路径。现在 `wevu/web-apis` 可以和 `wevu`、`wevu/fetch`、`wevu/router` 等子路径一样被稳定解析到对应 dist 入口，便于在小程序项目里直接引入新的 Web Runtime 安装函数与兼容层导出。** [`0741a97`](https://github.com/weapp-vite/weapp-vite/commit/0741a97d2d402de3e172b2550bdf40098ae446ad) by @sonofmagic
- 📦 Updated 6 dependencies [`624f9ee`](https://github.com/weapp-vite/weapp-vite/commit/624f9ee0bf09d9cf5a5d0815cbff1aa094cdd702)
  <details><summary>Details</summary>

  `rolldown-require@2.0.14`, `wevu@6.15.9`, `@wevu/web-apis@1.2.9`, `@wevu/api@0.2.5`, `@weapp-vite/web@1.3.18`, `@weapp-vite/ast@6.15.9`

  </details>

## 6.15.8

### Patch Changes

- 🐛 **修复 `weapp-vite` 发布链路中对 `@weapp-core/init` 的旧产物依赖，避免 `pnpm dev:open` 等命令在安装最新依赖后因 `@weapp-core/shared` 根入口不再导出 `fs` 而直接崩溃。同时为 `@weapp-core/*` 增加 changeset 守卫，并为 `@weapp-core/init` 增加打包产物回归测试，防止类似的内部依赖版本漂移再次进入发布结果。** [#470](https://github.com/weapp-vite/weapp-vite/pull/470) by @sonofmagic
- 📦 **Dependencies** [`10bfa49`](https://github.com/weapp-vite/weapp-vite/commit/10bfa49e48401f05c3ff7467c8fd9e672813be04)
  → `@weapp-core/init@6.0.8`, `@weapp-vite/ast@6.15.8`, `wevu@6.15.8`

## 6.15.7

### Patch Changes

- 🐛 **修复本地分包按依赖列表复制 `miniprogram_npm` 产物时遗漏 copied `miniprogram` 包传递依赖的问题。像 `miniprogram-computed` 这类通过 build-npm 复制的 CJS 小程序包，声明在分包后会继续把 `rfdc`、`fast-deep-equal` 等运行时依赖一并带入分包产物，避免真实 DevTools 运行时报模块缺失。** [#467](https://github.com/weapp-vite/weapp-vite/pull/467) by @sonofmagic

- 🐛 **继续收敛多平台接入链路：统一默认平台与微信兼容别名导出，补充宿主 source registry/contract 类型入口，并让抖音 typings 元数据、tsconfig 生成与脚手架模板依赖池保持一致。** [`1f76780`](https://github.com/weapp-vite/weapp-vite/commit/1f76780d69a3e0a7f8d9d197f50865c7d6d0c3b3) by @sonofmagic

- 🐛 **改进微信开发者工具打开项目的兼容性：启动前会检测并尊重用户当前的服务端口配置，不再盲目覆盖已有设置；当用户关闭服务端口时，会保留原配置并回退到普通打开流程。同时补齐 Windows 下的默认 CLI 路径探测、批处理启动兼容、项目信任预写入与调试回退错误定位，降低 automator 打开项目时的启动与信任失败概率。** [`cd33619`](https://github.com/weapp-vite/weapp-vite/commit/cd336193b4cd6c7002e574d1eeb9031c14755484) by @sonofmagic

- 🐛 **修复原生小程序构建中复制型 `miniprogram` npm 包的 ESM `default` 互操作问题：当 `tdesign-miniprogram/dialog` 这类依赖以 `export default` 形式发布时，构建产物现在会在缓存与输出阶段统一归一化为带 `__esModule` 标记的 CommonJS，避免页面侧 `require + __toESM` 再次包裹默认导出，导致 `Dialog.confirm is not a function` 一类双层 `default` 报错。** [#467](https://github.com/weapp-vite/weapp-vite/pull/467) by @sonofmagic

- 🐛 **继续收敛多平台小程序适配的共享 contract 与宿主中立命名。`@weapp-core/shared` 现在提供更安全的运行时根入口与独立的 Node 子入口，统一平台 registry、宿主全局对象、模板指令前缀、路由与 capability 描述，避免小程序环境误入 Node-only 能力；`weapp-vite`、`@weapp-vite/ast`、`@wevu/compiler`、`wevu`、`@wevu/api`、`@weapp-vite/web` 与 `weapp-ide-cli` 则统一消费这套 contract，补齐 `a` / `tt` / `s` 等结构指令识别、默认平台回退、配置读取与多宿主 bridge 挂载逻辑，减少核心链路里散落的 `wx` 单宿主假设。** [`27c655f`](https://github.com/weapp-vite/weapp-vite/commit/27c655f20e4f033cbefa0920a1b60a55343a22f1) by @sonofmagic
  - 同时继续扩展公共 API 与运行时类型面的宿主中立别名，包括 `miniProgramRouter`、`AutoRoutesMiniProgramRouter`、`WeapiMiniProgramMethodName`、`WeapiMiniProgramAdapter`、`WeapiMiniProgramRequestTask`、`WeapiMiniProgramRequestSuccessResult`、`MiniProgramRequestMethod`、`MiniProgramSelectorQuery`、`MiniProgramIntersectionObserver`、`MiniProgramRouter`、`MiniProgramLaunchOptions` 等，并保持原有 `wx` / `WeapiWx*` 兼容导出不变。这样后续接入支付宝小程序、抖音小程序、百度小程序等宿主时，可以逐步迁移到统一的小程序命名与共享平台能力，而不需要继续把公共类型和内部模板协议绑定到微信前缀。
  - 在 Web 运行时侧，也继续把多平台桥接协议做成宿主中立模型：`canIUse` 支持解析 `wx.*`、`my.*`、`tt.*` 等前缀，模板事件属性默认输出 `data-mp-on-*` / `data-mp-on-flags-*`，并把 bridge 同步挂到 `wx`、`my`、`tt`、`swan`、`jd`、`xhs` 等宿主全局对象上。这样同一套运行时与工具链在多小程序平台之间更容易复用，也为后续平台接入继续收窄改造面。

- 🐛 **增强多平台模板兼容处理。`weapp-vite` 现在会按已支持的小程序平台指令前缀集合统一重写模板指令，支付宝 npm 模板转换也能识别并转换来自微信、百度、抖音等平台的条件与循环指令，`injectWeapi.replaceWx` 也会同步挂载所有已支持宿主全局；`@wevu/compiler` 同步放宽模板表达式里的宿主全局白名单，避免 `my`、`tt`、`swan`、`xhs` 等平台全局被误当成本地变量改写，降低支付宝和抖音小程序接入成本。** [`8d69179`](https://github.com/weapp-vite/weapp-vite/commit/8d691793607fe7806095b0db6d3b7514388bc408) by @sonofmagic
- 📦 Updated 9 dependencies [`1f76780`](https://github.com/weapp-vite/weapp-vite/commit/1f76780d69a3e0a7f8d9d197f50865c7d6d0c3b3)
  <details><summary>Details</summary>

  `@weapp-core/shared@3.0.4`, `@wevu/api@0.2.4`, `wevu@6.15.7`, `@weapp-vite/miniprogram-automator@1.0.3`, `weapp-ide-cli@5.2.4`, `@weapp-vite/ast@6.15.7`, `@weapp-vite/web@1.3.17`, `@weapp-vite/volar@2.1.0`, `@wevu/web-apis@1.2.8`

  </details>

## 6.15.6

### Patch Changes

- 🐛 **修复小程序 production 构建下 Web Runtime 自动注入代码的可读性退化问题。现在 `miniprogram` 目标在 production 合并配置中默认关闭 `build.minify`，使注入后的 runtime 安装与局部绑定代码保持可读形态，便于定位线上问题与调试构建产物。同时补充 `github-issues` 的 issue #457 回归用例，锁定注入代码可读输出。** [#462](https://github.com/weapp-vite/weapp-vite/pull/462) by @sonofmagic

- 🐛 **修复 `weapp-vite.config.ts` 与 `vite.config.ts` 的合并行为：现在无论只存在 `weapp-vite.config.ts`，还是两份配置同时存在，`weapp-vite.config.ts` 中的顶层 Vite 配置与 `weapp` 配置都会生效，且优先级高于 `vite.config.ts`。这保证了 `plugins`、`css`、`resolve`、`define` 等配置能稳定参与构建。** [`789815e`](https://github.com/weapp-vite/weapp-vite/commit/789815ea79e0fe65a836bbc262284e294c53e2e2) by @sonofmagic

- 🐛 **增强微信开发者工具启动前的本地配置预热能力。`weapp-ide-cli` 现在会在 `open`、`auto`、`auto-preview` 与 automator 启动前自动补齐 DevTools 安全设置，并可按命令参数或全局配置自动信任目标项目；同时新增 `autoBootstrapDevtools`、`autoTrustProject` 配置项与更直观的 `config show` / `config doctor` 输出。`weapp-vite` 复用了这套底层能力，新增 `ide setup` 命令，并让 `open`、`dev --open`、`build --open` 共享同一套 DevTools 预热与项目信任策略。** [`08fd6ae`](https://github.com/weapp-vite/weapp-vite/commit/08fd6ae8093f7935ee6a9df51eef639c185fa861) by @sonofmagic

- 🐛 **统一仓库内微信小程序模板与夹具的默认 `appid` 为真实可用值 `wxb3d842a4a7e3440d`，不再保留测试账号或游客账号占位；同时修复 IDE E2E 在扩展 `project.config.json` 时无差别追加末尾空行的问题，避免运行开发者工具验证后产生纯换行噪音改动。** [`8809778`](https://github.com/weapp-vite/weapp-vite/commit/880977826aa7d4f33275d8acfaca3bbd70e16417) by @sonofmagic
- 📦 Updated 4 dependencies [`fcd6d99`](https://github.com/weapp-vite/weapp-vite/commit/fcd6d990e4e6b996a761d43226e42a756793fe22)
  <details><summary>Details</summary>

  `@weapp-vite/web@1.3.16`, `weapp-ide-cli@5.2.3`, `@weapp-vite/ast@6.15.6`, `wevu@6.15.6`

  </details>

## 6.15.5

### Patch Changes

- 🐛 **修复 `wv dev -o` 复用已打开微信开发者工具窗口时可能继续命中旧模块缓存的问题。现在开发态打开同一项目时会主动重开 DevTools，以刷新最新构建产物，避免构建已更新但 IDE 仍报旧 chunk / 旧依赖错误。** [`9e3a1c6`](https://github.com/weapp-vite/weapp-vite/commit/9e3a1c6680b19d514ece0ffbe6c2fc27cf7b3aa5) by @sonofmagic

- 🐛 **补齐 `vite.config.*` 与 `weapp-vite.config.*` 双配置入口在工程体验上的一致性。现在托管的 `.weapp-vite/tsconfig.node.json`、示例项目 `tsconfig`、配置加载提示与相关 benchmark 脚本都会同时识别这两类文件；当项目中同时存在两套配置时，CLI 会明确提示当前已合并 `weapp` 配置，并说明 `weapp-vite.config.*` 的优先级高于 `vite.config.*`。同时同步更新手动接入、目录结构、自动路由、分包、插件、npm 等文档入口，避免用户继续误以为只能使用 `vite.config.ts`。** [`d17dfd7`](https://github.com/weapp-vite/weapp-vite/commit/d17dfd791d68aaf2f41e1083bf05c4558f1c75b0) by @sonofmagic

- 🐛 **为 Vue 模板的 `htmlTagToWxml` 转换补充默认标签语义 class 注入能力：当 `.vue` 中的 HTML 标签被转换为小程序内置标签时，会默认追加原标签名 class（如 `h3 -> <view class="h3">`、`br -> <view class="br" />`），便于用户自行用 CSS 低成本恢复默认外观；同时新增 `vue.template.htmlTagToWxmlTagClass` 开关，支持按需关闭该行为。** [`5f21605`](https://github.com/weapp-vite/weapp-vite/commit/5f21605625cc29e206650890438e8be53d3311de) by @sonofmagic

- 🐛 **修复小程序构建透传上游 `dist` 内部 hash chunk 名的问题。`wevu/dist/src-*.mjs`、`store-*.mjs` 一类内部产物现在会被改写为稳定的 `weapp-vendors/*` 文件名，避免微信开发者工具在 `dev` / 重开场景中出现 `module is not defined` 的漂移模块报错。** [`e1d94a1`](https://github.com/weapp-vite/weapp-vite/commit/e1d94a18296b8d88eaad78b70cfa8f8966f10f7e) by @sonofmagic
- 📦 Updated 4 dependencies [`eedc149`](https://github.com/weapp-vite/weapp-vite/commit/eedc149b8c5668ee3dc86008de27b83609efeb6c)
  <details><summary>Details</summary>

  `wevu@6.15.5`, `@weapp-core/init@6.0.7`, `@wevu/web-apis@1.2.7`, `@weapp-vite/ast@6.15.5`

  </details>

## 6.15.4

### Patch Changes

- 🐛 **修复 `weapp-vite` 等公开包对 `@weapp-core/constants` 发布依赖被锁定为精确版本的问题，并补充 constants 包变更必须带 changeset 的发布校验，避免共享常量新增导出后用户安装到旧版 constants 产物时出现运行时报错。** [`a1951ca`](https://github.com/weapp-vite/weapp-vite/commit/a1951ca0c73cca640f4897ed42814f787b5e6446) by @sonofmagic
- 📦 Updated 5 dependencies [`a1951ca`](https://github.com/weapp-vite/weapp-vite/commit/a1951ca0c73cca640f4897ed42814f787b5e6446)
  <details><summary>Details</summary>

  `@weapp-core/constants@0.1.1`, `wevu@6.15.4`, `@weapp-vite/web@1.3.15`, `@wevu/web-apis@1.2.6`, `@weapp-vite/ast@6.15.4`

  </details>

## 6.15.3

### Patch Changes

- 🐛 **修复仅包含 `<script setup>` 的 Vue 页面在自动注入 Web Runtime 全局能力时被错误跳过的问题。现在 issue #448 这类页面会正确注入 `atob`、`btoa`、`queueMicrotask`、`performance`、`crypto`、`Event`、`CustomEvent` 对应的 runtime installer，并补齐构建回归与微信开发者工具 e2e 覆盖，避免页面在 attached 阶段因全局能力未初始化而挂载失败。** [#453](https://github.com/weapp-vite/weapp-vite/pull/453) by @sonofmagic

- 🐛 **为 `weapp-vite` / `@wevu/web-apis` 的 Web Runtime 按需注入链路补齐下一批高频全局能力：新增 `atob`、`btoa`、`queueMicrotask`、`performance.now`、`crypto.getRandomValues`、`Event`、`CustomEvent` 的 runtime installer、局部绑定和自动目标解析，并补充 `github-issues` 中 issue #448 的构建回归页，确保这些能力在真实小程序构建产物里可以按需注入到页面作用域。** [#452](https://github.com/weapp-vite/weapp-vite/pull/452) by @sonofmagic
- 📦 **Dependencies** [`1393de9`](https://github.com/weapp-vite/weapp-vite/commit/1393de9cab02b635501b397b36f8d5fd2e2bb44b)
  → `@wevu/web-apis@1.2.5`, `wevu@6.15.3`, `@weapp-vite/ast@6.15.3`

## 6.15.2

### Patch Changes

- 🐛 **修复小程序请求运行时按需注入缺失 `TextDecoder` 与 `TextEncoder` 的问题。现在 `fetch`、`Request`、`Response`、`XMLHttpRequest`、`WebSocket` 等链路会自动补齐文本编解码构造器，并在运行时 installer、局部自由变量绑定和最终 bundle 注入阶段保持一致，避免真实宿主里出现 `TextDecoder is not defined` 一类初始化错误；同时把共享 runtime marker 常量收敛到 `@weapp-core/constants`，统一跨包实现与测试约束。** [`b8b4b0e`](https://github.com/weapp-vite/weapp-vite/commit/b8b4b0e6aa0f878de557fa1a93f583f4df8bb232) by @sonofmagic

- 🐛 **调整 request globals 的默认自动注入策略，改为按源码与产物中的实际引用按需注入。现在只有在实际使用 `fetch` 相关能力时才会注入请求运行时那组依赖，只有在实际使用 `WebSocket` 时才会注入 `WebSocket` 兼容层，同时保持入口、公共 chunk 与 app prelude 的注入目标一致。** [`b8f58bb`](https://github.com/weapp-vite/weapp-vite/commit/b8f58bb9b93429ac376b610f240c5160672fa195) by @sonofmagic

- 🐛 **修复 request globals 默认自动注入在按需模式下的多处边界场景。现在会同时识别源码中的自由变量引用、常见请求库导入，以及构建后 shared chunk 中的 websocket 线索，按需补齐 `fetch`、`XMLHttpRequest`、`WebSocket`、`URL` 等关联全局对象；同时避免把仅存在于 `<script setup>` 中的源码级注入错误地下沉进 `setup()`，并在无法静态确定 installer 导出名时回退到运行时解析，确保 `socket.io-client` 与 request-globals 页面在真实小程序构建产物里仍能拿到顶层局部绑定。** [`0510a45`](https://github.com/weapp-vite/weapp-vite/commit/0510a45ea0a9882e9549e9791e7bbc07f6a97002) by @sonofmagic

- 🐛 **修复 dev / HMR 场景下 shared chunk importer 的增量刷新丢失问题。现在当 partial emit 没把未变化的 shared chunk 一起带进当前 bundle 时，会保留已有 importer 关联，不再先删后丢，避免后续页面、layout、组件在连续热更新后失去 shared runtime 的联动重编译，导致小程序模拟器偶发出现 `** is not a function`、运行时 helper 缺失或相关 chunk 引用失配。** [`e75773a`](https://github.com/weapp-vite/weapp-vite/commit/e75773a28c8a75d03fcbf7498f1c316c05844444) by @sonofmagic

- 🐛 **将按需注入能力的主命名从偏窄的 request 语义收敛为更准确的 Web Runtime 语义。现在推荐使用 `weapp.appPrelude.webRuntime`、`weapp.injectWebRuntimeGlobals` 与 `installWebRuntimeGlobals()`，并保留 `requestRuntime`、`injectRequestGlobals`、`installRequestGlobals()` 作为兼容别名与过渡提示；同时同步更新类型导出、示例项目与文档，避免新增 `TextEncoder`、`TextDecoder`、`WebSocket`、`URL` 等能力后继续沿用过时命名。** [`a4b33b0`](https://github.com/weapp-vite/weapp-vite/commit/a4b33b089b0487120c1cf999a9fdb17efb5b9055) by @sonofmagic

- 🐛 **修复 request runtime / request globals 在真实小程序构建产物中的按需注入回归。现在会为未显式导出的 installer 自动补稳定私有导出，确保页面入口、`app.prelude.js` 和独立 `request-globals-runtime.js` 都能拿到正确的安装函数，并把运行时覆盖补齐到 `wevu-runtime-demo`、Vue 版 request-clients、原生 request-clients 以及 app prelude 场景，避免 DevTools 真机链路中出现 `fetch`、`XMLHttpRequest` 或 `WebSocket` 未初始化的问题。** [`cd7cf6a`](https://github.com/weapp-vite/weapp-vite/commit/cd7cf6aac3a85dd766f5600234e5305eb0798fdd) by @sonofmagic
- 📦 **Dependencies** [`b8b4b0e`](https://github.com/weapp-vite/weapp-vite/commit/b8b4b0e6aa0f878de557fa1a93f583f4df8bb232)
  → `@wevu/web-apis@1.2.4`, `wevu@6.15.2`, `@weapp-vite/ast@6.15.2`

## 6.15.1

### Patch Changes

- 🐛 **修复自动生成的 `components.d.ts` 在为带源码跳转的原生组件补充类型时，没有把小程序通用基础属性稳定合并进最终组件 props 的问题。现在这类组件在 Vue 模板中也能正确接受 `class`、`style`、`id` 等基础属性，避免像 `<Tabbar class="text-red" />` 这样的写法被误报类型错误。** [#445](https://github.com/weapp-vite/weapp-vite/pull/445) by @sonofmagic

- 🐛 **调整 `weapp.appPrelude` 的默认模式为 `require`，避免项目在未显式配置时默认采用 `inline` 或多入口内联注入。现在默认行为会为主包与独立分包产出独立的 `app.prelude.js`，入口 chunk 仅保留 `require()` 调用；如需原先的内联效果，仍可显式配置 `weapp.appPrelude.mode = "inline"` 或 `weapp.appPrelude.mode = "entry"`。** [`81d7a3e`](https://github.com/weapp-vite/weapp-vite/commit/81d7a3ee2feac484fa5435a3d24a81c45f02c4b7) by @sonofmagic

- 🐛 **修复 `injectWeapi.replaceWx` 注入时代码仍依赖 `Function(...)` 动态执行的问题，改为仅使用静态宿主全局同步与源码重写方案，避免在小程序宿主中因 `Function` 不可用而导致 `wx` / `my` 替换逻辑失效。** [`2291aca`](https://github.com/weapp-vite/weapp-vite/commit/2291aca7ca26f2f5e486dbef2b5e4dbe87f3aef7) by @sonofmagic

- 🐛 **修复本地分包从共享 `miniprogram_npm` 缓存复制 npm 产物时的稳定性问题。现在 `weapp-vite` 在按依赖过滤复制独立分包 npm 文件时会使用受控的目录遍历复制，避免 `tdesign-miniprogram/transition/*` 这类深层文件在构建阶段偶发 `ENOENT`，恢复 GitHub issue 分包场景和相关 CI e2e 的稳定通过。** [`6c36a6e`](https://github.com/weapp-vite/weapp-vite/commit/6c36a6ee2e05a2a5395de21c88354d7bf28db5de) by @sonofmagic

- 🐛 **修复组件 props 在传入 `undefined` 后被小程序运行时视为 `null` 时的兼容缺口。`wevu` 现在提供显式的 `allowNullPropInput` 开关，并补齐显式 `properties` 分支的归一化逻辑；`weapp-vite` 则把该行为接入 `vite.config.ts` 的 `weapp.wevu.defaults.component.allowNullPropInput` 默认值体系中，Vue SFC 默认保持开启，也允许项目侧统一关闭，避免微信开发者工具对 `String` / `Number` 等已声明类型 props 反复输出 `null` 类型告警。** [`2fda07a`](https://github.com/weapp-vite/weapp-vite/commit/2fda07a604e64608b976a7782e7f1dbb4308aef4) by @sonofmagic

- 🐛 **修复本地依赖安装与小程序 npm 构建的两个稳定性问题：一是 `postinstall` 现在会自动修正根目录损坏的 `weapp-vite` workspace 链接，避免 `pnpm build` 在 fixture 与 e2e 应用里找不到 CLI 入口；二是小程序 npm 目录改为使用受控递归复制，避免像 `tdesign-miniprogram` 这类包在分包依赖缓存构建时触发 `ENOENT`，从而让 `pnpm test` 与相关分包构建流程更稳定。** [`9e558da`](https://github.com/weapp-vite/weapp-vite/commit/9e558dabe6a3ef7ac76bf4167bd3813a06eed324) by @sonofmagic

- 🐛 **修复 `app.prelude.ts` 中 `import.meta.filename` 未被静态替换的问题，并补齐 `appPrelude.mode: "inline"` 的构建与 DevTools 运行时回归用例。现在 `app.prelude.ts` 会沿用常规脚本的 `import.meta` 编译行为，在多次页面 `reLaunch` 场景下也只会通过内置 guard 执行一次。** [`f8d3dbd`](https://github.com/weapp-vite/weapp-vite/commit/f8d3dbd07f064f8d0c5b979c7e1233291a0fa0f4) by @sonofmagic

- 🐛 **将请求相关运行时注入能力收敛到 `weapp.appPrelude.requestRuntime`，统一用 `appPrelude` 表达前置执行时机，同时保留 `weapp.injectRequestGlobals` 作为过渡兼容配置。当前版本中旧配置仍可使用，但会输出废弃提示；当新旧配置同时存在时，会优先采用 `appPrelude.requestRuntime`。** [`b336110`](https://github.com/weapp-vite/weapp-vite/commit/b3361100b404f6ea20cdaf168dead4bea4fbc8d7) by @sonofmagic

- 🐛 **收敛 `appPrelude` 与 `requestRuntime` 的默认注入路径，并修复默认开启 `allowNullPropInput` 后无 props 页面在小程序运行时触发 `Object.entries(undefined)` 的问题。现在 `weapp.appPrelude.requestRuntime` 在 `require` 模式下会优先安装到 `app.prelude.js`，对应的 DevTools 运行时用例已覆盖；同时无 props 的页面也不会再因为空属性归一化而在启动时崩溃。** [`195783b`](https://github.com/weapp-vite/weapp-vite/commit/195783b2be1c76f32d3657e4336845279c0cbd64) by @sonofmagic

- 🐛 **修复 request globals 运行时共享产物默认输出为 `dist.js` 的命名问题，改为更语义化的 `request-globals-runtime.js`，让小程序构建产物和入口引用更容易理解与排查。** [`aaab8ba`](https://github.com/weapp-vite/weapp-vite/commit/aaab8baee0dbbc279f41403aed2eb2132eda2713) by @sonofmagic

- 🐛 **修复 `app.vue` 中使用 `weapp-vite/auto-routes` 时，构建阶段提取 `defineAppJson` 宏配置会错误解析 `auto-routes` 回退路径的问题。现在打包产物会优先命中 `dist` 同级的 `auto-routes.mjs`，避免 `app.vue` 被误判为缺少应用配置，恢复 GitHub issue 场景与相关小程序项目的正常构建。** [`2e0539a`](https://github.com/weapp-vite/weapp-vite/commit/2e0539ab3c3f3fc25cc310878c04566427355f09) by @sonofmagic

- 🐛 **新增 `@weapp-core/constants` 包，用于沉淀可同时被 Node 侧构建流程、小程序运行时代码以及测试复用的共享常量；同时将请求全局对象注入与 app prelude 相关的内部私有命名迁移到该包统一管理，缩短 guard key、共享字段和 helper 标识符，减少最终构建产物中的冗长内部字段名，同时保持原有运行时行为与兼容性不变。** [`db65791`](https://github.com/weapp-vite/weapp-vite/commit/db65791b4d042b3090d3f4eecae30d2cc6ca7da5) by @sonofmagic
- 📦 Updated 5 dependencies [`2fda07a`](https://github.com/weapp-vite/weapp-vite/commit/2fda07a604e64608b976a7782e7f1dbb4308aef4)
  <details><summary>Details</summary>

  `wevu@6.15.1`, `@wevu/web-apis@1.2.3`, `@weapp-core/constants@0.1.0`, `@weapp-vite/web@1.3.14`, `@weapp-vite/ast@6.15.1`

  </details>

## 6.15.0

### Minor Changes

- ✨ **调整 `weapp.npm` 的默认依赖分类策略：`dependencies` 与 `devDependencies` 现在都会优先进入 Vite 打包流程，只有明确的小程序包或显式命中的包才进入 npm 构建。新增 `weapp.npm.strategy` 用于在新默认的 `explicit` 模式与旧的 `legacy` 模式之间切换，并支持通过 `weapp.npm.include` 显式补充 npm 构建候选集。** [`06d0868`](https://github.com/weapp-vite/weapp-vite/commit/06d086834af172a3de9f7d1fb4c6e2d3456e0483) by @sonofmagic

- ✨ **为 `weapp.appPrelude` 新增 `mode: 'require'` 模式，按主包/分包作用域输出 `app.prelude.js` 并在对应 chunk 顶部注入静态 `require(...)`，以在保留前置执行时机的同时减少重复内联代码。** [#437](https://github.com/weapp-vite/weapp-vite/pull/437) by @sonofmagic

### Patch Changes

- 🐛 **修复原生 WXML 中 `import.meta` 整体对象替换到属性插值时的转义策略：当 `import.meta`、对象或数组字面量位于带引号属性的完整 mustache 表达式中时，产物现在会生成带内层字符串字面量且完成属性引号转义的安全形式，避免输出未转义的 JSON 双引号，导致微信开发者工具在编译 `wxml` 时出现语法错误。** [`fbe876e`](https://github.com/weapp-vite/weapp-vite/commit/fbe876e6ecb99caa461466510792cd1b7a8e96fb) by @sonofmagic

- 🐛 **修复 `injectRequestGlobals` 场景下 `axios` fetch adapter 的运行时注入，构建产物会自动为 axios chunk 补齐 `Request`、`Response`、`fetch` 所需环境，不再需要业务代码手动修改 `axios.defaults.adapter` 或 `axios.defaults.env`。** [`f652edb`](https://github.com/weapp-vite/weapp-vite/commit/f652edb5ba6c90e1e8c477af69300929d38c4010) by @sonofmagic

- 🐛 **为 Vue 模板编译新增 HTML 标签到 WXML 内置标签的映射能力：`.vue` 模板中的常见 HTML 标签现在会默认转换为对应的小程序标签，并支持通过 `vue.template.htmlTagToWxml` 自定义或关闭映射表。与此同时，`wevu` 的内置标签类型也补齐了这些 HTML 风格别名，避免在编辑器中为 `div`、`span`、`img`、`a` 等标签报出 `IntrinsicElements` 缺失错误，减少从 Web/Vue 项目迁移到 weapp-vite / wevu 时的模板改造成本。** [`87fcdd7`](https://github.com/weapp-vite/weapp-vite/commit/87fcdd78615b1d9b1ecdecda4946af4b75193bdd) by @sonofmagic

- 🐛 **修复小程序 npm 显式分类链路中的旧语义残留：miniprogram 构建的 external 判定与产物中的 npm 路径重写，统一改为基于 `npm.strategy = 'explicit'` 下的真实 npm 构建候选集，而不是继续把根 `dependencies` 当作默认运行时 npm 依赖。这样普通依赖无论写在 `dependencies` 还是 `devDependencies`，默认都会继续走 Vite 内联；只有小程序包或显式 `include` 的依赖才会进入 npm 构建与路径改写流程，同时 `legacy` 模式仍保持兼容。** [`5995b36`](https://github.com/weapp-vite/weapp-vite/commit/5995b367b647fc002c523168f3b1eba5e6aa8c0a) by @sonofmagic

- 🐛 **修复 `npm.strategy = 'explicit'` 模式下普通依赖仍被错误 external 到小程序运行时的问题，让 `dayjs` 这类普通 npm 包默认继续交给 Vite 内联打包。同时补齐共享 chunk 复制后的跨分包依赖本地化，避免复制产物继续引用其他分包 `common.js`，并去掉 wevu 路由示例中的重复路由注册 warning。** [`02992ca`](https://github.com/weapp-vite/weapp-vite/commit/02992cac683c814c10ec65c2d493ead64f61a058) by @sonofmagic

- 🐛 **修复纯原生小程序入口对 request globals 的局部绑定注入，确保 `app` 入口与原生页面一样能稳定拿到 `fetch`、`URL`、`XMLHttpRequest`、`WebSocket` 等能力，并补充纯原生 `axios`、`graphql-request`、`socket.io-client` 真实请求 e2e 示例。** [`c2cba40`](https://github.com/weapp-vite/weapp-vite/commit/c2cba403e799007cc6e18bea838bcc045cc01f41) by @sonofmagic

- 🐛 **压缩内联事件编译产物中的 dataset 属性名与 inline id：将 `data-wv-inline-id-*` / `data-wv-handler-*` / `data-wv-event-detail-*` 分别缩短为 `data-wi-*` / `data-wh-*` / `data-wd-*`，并把 `__wv_inline_*` 形式的内联表达式 id 缩短为更短的稳定 id。运行时同步支持新旧 dataset key 的兼容读取，以减少大型小程序项目的 WXML 包体积，同时避免历史产物在升级后直接失效。** [#442](https://github.com/weapp-vite/weapp-vite/pull/442) by @sonofmagic

- 🐛 **收紧原生 WXML 中 `import.meta` 的替换边界：仅保留 `import.meta.env.xxx`、`import.meta.url` 与 `import.meta.dirname` 这类标量值替换，不再支持 `import.meta.env` 或裸 `import.meta` 的对象级替换，避免为低收益场景引入额外注入链路与不稳定产物。** [`48c0ba1`](https://github.com/weapp-vite/weapp-vite/commit/48c0ba1e4393155f184a3c245aec9e070e0c9400) by @sonofmagic

- 🐛 **修复原生 WXML 中 `import.meta.url`、`import.meta.dirname` 与 `import.meta.env` 替换到属性插值时的生成规则：字符串值继续输出为带引号的字符串字面量；对象、数组、布尔值等完整 mustache 表达式现在统一输出为 `{{ { ... } }}` / `{{ true }}` 这类合法字面量形式，避免生成 `{{{` / `}}}` 或未转义引号后在微信开发者工具中编译失败。** [#442](https://github.com/weapp-vite/weapp-vite/pull/442) by @sonofmagic

- 🐛 **新增 `app.prelude` 约定文件支持，并提供 `weapp.appPrelude` 配置项。默认 `mode: 'inline'` 会把 `src/app.prelude.ts` 等脚本内联注入到每个 JS chunk 最前面执行；也支持 `mode: 'entry'` 只注入到 `app/page/component` 入口 chunk，用于在执行时机与产物体积之间做取舍。** [#437](https://github.com/weapp-vite/weapp-vite/pull/437) by @sonofmagic
- 📦 Updated 4 dependencies [`87fcdd7`](https://github.com/weapp-vite/weapp-vite/commit/87fcdd78615b1d9b1ecdecda4946af4b75193bdd)
  <details><summary>Details</summary>

  `wevu@6.15.0`, `rolldown-require@2.0.13`, `@weapp-vite/web@1.3.13`, `@weapp-vite/ast@6.15.0`

  </details>

## 6.14.3

### Patch Changes

- 🐛 **优化 `weapp-vite dev -o` / `weapp-vite open` 在目标项目已被微信开发者工具打开时的交互提示。现在会明确提示可按 `r` 关闭当前已打开项目并重新拉起，避免只能被动跳过重复打开；同时修复登录失效重试流程对按键结果判断不准确的问题，确保取消或超时不会被误判为继续重试。** [`b5aaabc`](https://github.com/weapp-vite/weapp-vite/commit/b5aaabc93a592eec4776a8510375b94c01c7ecca) by @sonofmagic

- 🐛 **修复未显式配置 `autoImportComponents` 的 wevu 项目默认不会生成 `.weapp-vite/components.d.ts`、`typed-components.d.ts` 与 `mini-program.html-data.json` 的问题。现在 wevu 应用在默认配置下也会自动产出组件类型支持文件，补齐 Vue SFC 全局组件的模板智能提示基础能力。** [`2117be3`](https://github.com/weapp-vite/weapp-vite/commit/2117be3768a4762a543bd3114fce3eb73e2d73a1) by @sonofmagic

- 🐛 **修复 `wxml` 中 `import.meta.env` 字符串替换的引号生成策略。现在会根据属性外层引号自动选择相反的内层引号，避免在 `src="{{...}}"` 等场景下产出重复双引号导致模板语法报错，同时保留对象字面量等非字符串替换值的原有行为。** [`98d16f8`](https://github.com/weapp-vite/weapp-vite/commit/98d16f8a88bf718566faa4d5e621832333e6be0e) by @sonofmagic
- 📦 Updated 5 dependencies [`b9a3e5b`](https://github.com/weapp-vite/weapp-vite/commit/b9a3e5b8fc6259ae5d77eba359aca3632d083b75)
  <details><summary>Details</summary>

  `@weapp-vite/ast@6.14.3`, `@weapp-vite/mcp@1.2.1`, `@weapp-vite/web@1.3.12`, `@wevu/web-apis@1.2.2`, `wevu@6.14.3`

  </details>

## 6.14.2

### Patch Changes

- 🐛 **修复 `autoImportComponents.globs = []` 会被默认扫描规则覆盖的问题。现在可以只保留 `autoImportComponents.resolvers`，同时通过手写 `import XXX from 'xxx.vue'` 明确控制组件导入，不再强制启用基于 `components/**` 的自动扫描。** [`5ff2517`](https://github.com/weapp-vite/weapp-vite/commit/5ff25172a4040f05d75c2f294ed083b05d1fb190) by @sonofmagic

- 🐛 **修复原生小程序 `autoImportComponents` 遇到与微信内置组件同名的本地组件时缺少明确反馈的问题。现在像 `list-view` 这类与宿主内置标签重名的组件，会在扫描阶段输出明确 warning；自动导入仍会优先使用本地组件，同时提示用户该命名会遮蔽同名内置组件，并建议参考微信官方组件文档重新命名。** [#430](https://github.com/weapp-vite/weapp-vite/pull/430) by @sonofmagic

- 🐛 **优化 auto-import 在大量组件场景下的解析与支持文件同步性能。为内置 resolver 增加静态组件索引命中，减少重复的运行时 resolver 扫描；同时在 support files 与 manifest 内容未变化时跳过版本递增、重复写盘和联动输出重建，降低大项目中的构建与补全生成开销。** [#433](https://github.com/weapp-vite/weapp-vite/pull/433) by @sonofmagic

- 🐛 **修复手动调用 `installRequestGlobals()` / `installAbortGlobals()` 时的请求全局兼容链路。现在 `weapp-vite` 会为这类显式安装场景补充被动本地绑定，`@wevu/web-apis` 也会同步更新内部实际全局映射，使同模块里的 `fetch`、`URL`、`AbortController` 等自由变量在小程序产物中能够正确读取到已安装的 polyfill，而不会再出现手动安装后仍为 `undefined` 的情况。** [`feb5eaf`](https://github.com/weapp-vite/weapp-vite/commit/feb5eaf2dbbb232359b59fb4625bf626e047e415) by @sonofmagic

- 🐛 **修复 `weapp-vite dev` 里按 `s` 默认截图仍写入 `.tmp` 的路径约定不一致问题；现在会统一保存到项目根目录的 `.weapp-vite/dev-screenshots`，与仓库已有的本地支持文件和内部缓存目录保持一致。** [#433](https://github.com/weapp-vite/weapp-vite/pull/433) by @sonofmagic

- 🐛 **修复小程序运行时中 `socket.io-client` 的 `polling` 与 `websocket` 两种传输模式兼容性。现在构建产物会提前把请求相关全局对象的惰性占位符暴露到 `globalThis`，并在真实运行时安装阶段正确替换这些占位符，避免第三方库在模块初始化阶段读取 `WebSocket` 等全局对象时失效或形成递归调用。** [`d89b50b`](https://github.com/weapp-vite/weapp-vite/commit/d89b50b573e461b91bf92e6febd279b72da95fed) by @sonofmagic

- 🐛 **修复小程序产物里 `import.meta` 相关静态值没有被展开的问题。现在原生 `.wxml` 模板与源码脚本中的 `import.meta.env`、`import.meta.url`、`import.meta.dirname`，以及裸 `import.meta`，都会在输出阶段按当前模块的静态上下文展开，避免把这些表达式原样透传到最终产物。** [#432](https://github.com/weapp-vite/weapp-vite/pull/432) by @sonofmagic

- 🐛 **修复生产构建默认生成 `.weapp-vite` 自动导入支持文件带来的额外开销；现在 `build` 默认跳过这些内部产物，仅在显式配置输出路径时继续生成。** [#430](https://github.com/weapp-vite/weapp-vite/pull/430) by @sonofmagic

- 🐛 **默认将 wevu 配置缓存写入项目内的 `.weapp-vite/wevu-config`，并同步忽略该内部目录，避免临时文件再次参与监听、路由扫描与源码排除逻辑。** [#430](https://github.com/weapp-vite/weapp-vite/pull/430) by @sonofmagic

- 🐛 **修复开发态 watch 在编辑器 rename-save/原子保存场景下把短暂的 `delete` 事件当成真实删除处理的问题。现在同路径文件在短时间内重新出现时会按 `update` 归一化处理，避免热更新基于暂时缺失或半写入的源码生成不完整的页面 chunk / `common.js`，从而减少原生小程序保存后偶发丢代码与共享导出错位。** [#428](https://github.com/weapp-vite/weapp-vite/pull/428) by @sonofmagic

- 🐛 **修复两处 CI 回归相关问题：一是同步 `github-issues` 中 request globals 构建产物断言到新的被动绑定注入形式；二是移除 `auto-routes` 生成类型里分包项 `root/pages` 的 `readonly` 限制，避免 `routes.subPackages` 直接传给 `defineAppJson()` 时在 `vue-tsc` 下出现类型不兼容。** [#430](https://github.com/weapp-vite/weapp-vite/pull/430) by @sonofmagic

- 🐛 **修复独立分包构建时 `import.meta.env` 分包内联定义未正确参与静态替换的问题，避免子包页面产物把预期常量编译成 `undefined`。同时修正相关 fixture 测试工程的工作区包链接方式，确保 `pnpm test` 可以稳定加载 `weapp-vite` 配置并通过回归测试。** [#433](https://github.com/weapp-vite/weapp-vite/pull/433) by @sonofmagic
- 📦 **Dependencies** [`a7f2fa2`](https://github.com/weapp-vite/weapp-vite/commit/a7f2fa290ae48aa4719be64fd6b07c99e87795cb)
  → `wevu@6.14.2`, `@wevu/web-apis@1.2.1`, `@weapp-vite/ast@6.14.2`

## 6.14.1

### Patch Changes

- 🐛 **修复 `weapp-vite` 在开发模式热更新时重复 emit 资源的问题，避免模板项目在修改 `.wxml` 等文件后出现大量 `[FILE_NAME_CONFLICT]` warning，并同步更新 `create-weapp-vite` 的版本联动发布。** [#417](https://github.com/weapp-vite/weapp-vite/pull/417) by @sonofmagic

- 🐛 **修复 `weapp-vite` 对 `src/assets` 下已被 `import` 等模块链路处理的图片重复执行静态资源扫描复制的问题，避免同一张图片同时输出原路径文件和哈希文件，并同步更新 `create-weapp-vite` 的版本联动发布。** [`5bfe9fb`](https://github.com/weapp-vite/weapp-vite/commit/5bfe9fb0096b94cd59a62e0be795ba95ebbe3308) by @sonofmagic

- 🐛 **修复原生 WXML 模板通过 `<import>` 与 `<include>` 引入共享 template 时的自动组件导入行为。现在自动导入会基于模板依赖闭包聚合组件标签，并在共享 template 变更时按引用链增量失效缓存，避免遗漏 `usingComponents` 注册且保持较高性能。** [#414](https://github.com/weapp-vite/weapp-vite/pull/414) by @sonofmagic

- 🐛 **为 `weapp-vite` MCP 增加面向 Codex、Claude Code 与 Cursor 的接入引导能力，支持通过 `wv mcp init`、`wv mcp print`、`wv mcp doctor` 预览、写入和检查客户端配置；同时在 dev/MCP HTTP 服务启动后直接输出可执行的接入命令，降低首次使用门槛。** [#416](https://github.com/weapp-vite/weapp-vite/pull/416) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在开发模式下处理 `.html` 模板热更新时未正确标记入口失效的问题，避免页面与 layout 的模板修改漏掉重编译，并保持 `#415` 的 `FILE_NAME_CONFLICT` 根因修复在更多 HMR 场景下稳定生效。** [#417](https://github.com/weapp-vite/weapp-vite/pull/417) by @sonofmagic

- 🐛 **为 `weapp-vite` 的 request globals 自动注入链路补充 `WebSocket` 支持，并将 `socket.io-client` / `engine.io-client` 纳入默认依赖检测。现在小程序项目在依赖这些实时通信库时，构建产物会自动注入并绑定 `WebSocket`，降低 `socket.io-client` 在 shared chunk 与页面初始化阶段因缺失全局对象而启动失败的概率。** [#422](https://github.com/weapp-vite/weapp-vite/pull/422) by @sonofmagic

- 🐛 **同步升级构建链路与模板目录中的部分依赖版本，包括 `rolldown`、`vite`、`rolldown-plugin-dts`、`@inquirer/prompts` 及相关 lint 配置，并更新 `create-weapp-vite` 内置模板 catalog 的对应版本映射。** [`8bb15f2`](https://github.com/weapp-vite/weapp-vite/commit/8bb15f2f5db775bb2cec4b1d90e6c6ac746e50aa) by @sonofmagic
- 📦 Updated 4 dependencies [`bde6c23`](https://github.com/weapp-vite/weapp-vite/commit/bde6c239f5a31980a6db1b1500cd257ded6bba4c)
  <details><summary>Details</summary>

  `@wevu/web-apis@1.2.0`, `wevu@6.14.1`, `weapp-ide-cli@5.2.2`, `@weapp-vite/ast@6.14.1`

  </details>

## 6.14.0

### Minor Changes

- ✨ **为 `weapp-vite dev` 增加终端快捷键能力，开发态启动后会在命令行里提示可用热键。现在支持按 `s` 直接截取当前小程序页面截图并保存到本地 `.tmp/weapp-vite-dev-screenshots` 目录，同时输出执行日志与结果路径；也支持按 `m` 开关开发态内置的 MCP `streamable-http` 服务，让调试阶段可以在同一终端里直接控制 MCP 会话，而不再依赖命令执行前的自动后台启动。** [`2544e7a`](https://github.com/weapp-vite/weapp-vite/commit/2544e7a097226a80632cc78714690d3e4dd68b56) by @sonofmagic

### Patch Changes

- 🐛 **修复 `wv dev` 在未启用 UI 分析面板时提前结束命令主流程的问题。此前开发态热键会话会在首屏提示后立即被关闭，只剩下构建 watcher 持续运行，导致 `h`、`q` 等快捷键看起来存在但实际无效。现在 `serve` 会持续等待退出信号，并在退出时再统一清理热键与 watcher。** [`731109e`](https://github.com/weapp-vite/weapp-vite/commit/731109e6ee2d8fc6875daba1b3859cece7d37c4f) by @sonofmagic

- 🐛 **优化 `weapp-vite dev` 的开发态终端样式，使热键区域更接近交互式工具的分层布局。默认提示现在会展示 `DEV` 会话头、当前状态、MCP 状态与最近操作；按 `h` 时则输出完整的 `Dev Usage` 命令面板，提升开发态终端可读性与一致性。** [`48ebe1f`](https://github.com/weapp-vite/weapp-vite/commit/48ebe1f76dcdbe6855d28d60a6edd4c52f6ccdb0) by @sonofmagic

- 🐛 **修复 dev 模式下自动导入新增 Vue 组件时的入口解析兜底逻辑。当解析器暂时无法返回新建组件的 resolved id，但组件文件已经实际落盘时，`weapp-vite` 现在会回退到该绝对路径继续发射组件产物，避免 `usingComponents` 已更新但组件 `wxml/json` 迟迟不生成，提升 macOS 等环境下新增 SFC 的热更新稳定性。** [#412](https://github.com/weapp-vite/weapp-vite/pull/412) by @sonofmagic

- 🐛 **修复 `weapp-vite dev` 开发态热键面板的多个可用性问题：热键监听改为更稳的终端输入数据流处理，解决 `h`、`s` 等单键在部分环境下无响应的问题；面板会避免重复输出相同内容；同时会话头中的版本号改为真实包版本，避免显示 `__VERSION__` 占位值。** [`9fc295e`](https://github.com/weapp-vite/weapp-vite/commit/9fc295ed7fe15a54b04426e280c3798f69b89d24) by @sonofmagic

- 🐛 **修复 `wv dev` 开发快捷键在部分终端与 `pnpm` TTY 代理场景下按键无响应的问题。现在会同时监听 `keypress` 与原始 `data` 输入，并对同一按键的重复事件做最小范围去重，使 `h`、`s`、`m`、`q` 及 `Ctrl+C` / `Ctrl+Z` 在更多终端环境下都能稳定生效。** [`03d83b6`](https://github.com/weapp-vite/weapp-vite/commit/03d83b6a5570bc5769af990c3b20bb206dbada42) by @sonofmagic

- 🐛 **修复 `weapp-vite dev` 交互热键模式对终端默认控制的兼容性，在接管 TTY 后支持 `Ctrl+Z` 暂时挂起当前进程并恢复终端控制，且在前台恢复后重新启用快捷键提示，避免 dev 模式吞掉常见的 shell 挂起行为。** [`746d24f`](https://github.com/weapp-vite/weapp-vite/commit/746d24ff422b2333c17a2118ad18423ff5f1b5fa) by @sonofmagic

- 🐛 **继续优化 `weapp-vite dev` 的开发态终端布局。默认热键提示现在会显示更接近交互式工具的 footer 结构，例如 `READY  waiting for actions...` 与 `press h to show help, press q to quit`，使开发态会话的状态感与操作提示更清晰。** [`3f18483`](https://github.com/weapp-vite/weapp-vite/commit/3f18483b5d4f4742c5bca97a55afebf021669ce2) by @sonofmagic

- 🐛 **修复 `weapp-vite dev` 在初次构建完成后开发态快捷键可能失效的问题。现在会在开发服务就绪时重新接管终端输入，恢复 `h` 帮助、`s` 截图、`m` 开关 MCP 与 `q` 退出等热键响应，避免构建过程临时改写终端状态后导致快捷键无效。** [`6390416`](https://github.com/weapp-vite/weapp-vite/commit/6390416696ff2767dc462bfc40fa4946fd4d9b99) by @sonofmagic

- 🐛 **继续修复 `weapp-vite dev` 热键终端体验问题。现在按 `h` 展开的帮助面板会更短，不再重复输出整块状态头；重复按 `h` 也会重新打印帮助；同时在打印帮助或状态后会再次确认终端处于可交互状态，减少单键输入被直接回显到终端、后续热键失效的问题。** [`3bac0fd`](https://github.com/weapp-vite/weapp-vite/commit/3bac0fd075bef5ebd23d1a6977c9427387b37d1a) by @sonofmagic

- 🐛 **修复 `wv open` 在同一小程序项目已经由微信开发者工具打开时仍重复关闭并重新打开窗口的问题。现在会优先复用当前可连接的项目会话，仅输出提示并跳过重复打开，避免打断正在进行的开发调试流程。** [`6a95296`](https://github.com/weapp-vite/weapp-vite/commit/6a952962698030dfda7c80c6b6c14bd2c0aef4c4) by @sonofmagic

- 🐛 **在 `weapp-ide-cli` 底层新增按 `projectPath` 复用的共享 automator 会话能力，并将 `weapp-vite dev` 的截图热键切换为通过该共享会话执行。这样后续更多 DevTools 操作都可以基于底层统一的会话复用机制扩展，而不是继续在上层命令里各自维护连接状态。** [`257b037`](https://github.com/weapp-vite/weapp-vite/commit/257b0372857734a2ae5180862ab0a33aef974e4b) by @sonofmagic

- 🐛 **调整 `weapp-vite dev` 的开发态热键提示输出顺序。现在启动时会先输出开发服务就绪、IDE 导入说明等提示，再显示 `按 h 查看帮助` 等交互热键信息，让终端文案顺序更符合“服务提示在前、快捷操作提示在后”的阅读习惯。** [`d876d0e`](https://github.com/weapp-vite/weapp-vite/commit/d876d0ed8b8057df06746c47f638ca6ca256057a) by @sonofmagic

- 🐛 **修复 `weapp-vite dev -o` 开发态截图热键每次都重新连接 DevTools 的问题。现在开发态会优先复用已建立的 automator 会话来执行截图，并默认生成整页长截图，减少重复连接导致的超时与卡顿；底层 `weapp-ide-cli` 截图命令也新增了复用现有 `miniProgram` 会话的能力。** [`2e1f557`](https://github.com/weapp-vite/weapp-vite/commit/2e1f557e2d09027116d807ad50f68e213f85fb87) by @sonofmagic

- 🐛 **将 `weapp-vite dev` 开发态热键面板中的英文提示统一调整为中文表达，同时保留终端布局层次。默认 footer、帮助分组标题与交互提示现在都以中文输出，避免 CLI 中英文混用。** [`fe091dd`](https://github.com/weapp-vite/weapp-vite/commit/fe091dd4c2a3d4497a562f51d205642c8d682e08) by @sonofmagic

- 🐛 **优化 `weapp-vite dev` 的热键帮助面板分组结构。按 `h` 展开的完整帮助现在使用更接近交互式工具的 `Watch Usage`、`Process`、`Help` 分组展示方式，让命令分类更清晰，终端样式更统一。** [`d143314`](https://github.com/weapp-vite/weapp-vite/commit/d143314edbbf3577fb770a740cb0687e01238075) by @sonofmagic

- 🐛 **修复 `weapp-vite dev -o` 在打开 IDE 后开发态快捷键可能失效的问题。现在会在 `open` 流程结束后重新接管终端输入，恢复 `h` 帮助、截图等热键提示与交互能力，避免终端被第三方打开流程临时改写后无法继续响应。** [`5a055bf`](https://github.com/weapp-vite/weapp-vite/commit/5a055bf7197bb9800831aeb38f151d07bda071e4) by @sonofmagic

- 🐛 **修复小程序截图链路在微信开发者工具无响应或自动化会话异常时的诊断行为，并为 `weapp-vite screenshot` / `wv screenshot` / `weapp-ide-cli screenshot` 新增 `--full-page` 整页长截图能力。现在截图命令会正确等待异步命令完成；当 DevTools websocket 连接失败、截图请求长时间不返回，或清理会话时 `App.exit` / `Tool.close` 无响应时，会显式抛出可排查的错误提示，而不再静默退出或表现为“成功但没有产物”；同时 `--page pages/...` 这类常见写法也会自动归一化为小程序路由所需的前导 `/`。** [`2a5882b`](https://github.com/weapp-vite/weapp-vite/commit/2a5882b016a6018ae5e5e73d48db11a3e0456676) by @sonofmagic

- 🐛 **继续优化 `weapp-vite dev` 的热键终端体验。默认提示现在简化为单行“开发快捷键已就绪”提示，不再重复输出状态块；同时新增对全角字母热键的兼容处理，在中文输入法参与时也能更稳地识别 `ｈ`、`ｓ` 等输入；按 `h` 展开的帮助会保留短版命令面板，减少终端刷屏。** [`709544a`](https://github.com/weapp-vite/weapp-vite/commit/709544a817b4eea2e402bc2d561cfa42aa651b84) by @sonofmagic
- 📦 Updated 6 dependencies [`f112199`](https://github.com/weapp-vite/weapp-vite/commit/f1121993ab02ed64862a43328ee1997c7d391ec5)
  <details><summary>Details</summary>

  `wevu@6.14.0`, `@wevu/api@0.2.3`, `@weapp-vite/miniprogram-automator@1.0.2`, `weapp-ide-cli@5.2.1`, `@wevu/web-apis@1.1.1`, `@weapp-vite/ast@6.14.0`

  </details>

## 6.13.4

### Patch Changes

- 🐛 **增强 `weapp-vite` 打开微信开发者工具项目时的默认行为：对微信小程序平台的 `open` / `dev -o` / `build -o` / `ide logs --open` 默认透传 `--trust-project`，减少每次打开新项目时都要手动确认“信任代码”的重复操作。同时保留 `--no-trust-project` 作为显式回退开关，便于在需要时关闭该默认行为。** [`d4e7992`](https://github.com/weapp-vite/weapp-vite/commit/d4e7992df32220bd1d723a7fa03aaee5a81dc0d3) by @sonofmagic

- 🐛 **修复原生 layout 模板引入共享 `template`、`include` 与 `wxs`/`sjs` 文件时的热更新传播。现在当 layout 自身或其依赖的共享模板脚本模块保存后，所有使用该 layout 的原生页面都能正确重新生成，并覆盖真实 IDE 运行态下的回归场景。** [`0d5ac7d`](https://github.com/weapp-vite/weapp-vite/commit/0d5ac7d0bb94173c4f9326389ec5d9316ecebbd8) by @sonofmagic

- 🐛 **修复 Windows 环境下的路径分隔符兼容问题。现在 `create-weapp-vite` 的模板文件校验会统一使用 POSIX 相对路径，`weapp-vite` 在分包 `miniprogram_npm` 复制阶段也会正确处理 Windows 原生路径，避免出现 CI 断言误报以及分包 npm 产物缺失的问题。** [`5bfa92e`](https://github.com/weapp-vite/weapp-vite/commit/5bfa92e52936b559deb7388cfc4db7100fc958a8) by @sonofmagic

- 🐛 **修复小程序独立模板与脚本模块文件的热更新依赖传播。现在当被多个 WXML 或 Vue 页面通过 `import`、`include`、`wxs` 等方式引用的共享 `.wxml`、`.html`、`.wxs`、`.sjs` 文件发生保存时，所有引用方都会被正确标记并重新生成，避免共享模板持续演进后热更新失效。** [`2d6aa2d`](https://github.com/weapp-vite/weapp-vite/commit/2d6aa2dc4743980c6d51e4d1bbb9a17935125095) by @sonofmagic

- 🐛 **将多个源码包中直接使用的 `fs-extra` 调用统一迁移到 `@weapp-core/shared` 提供的原生 `node:fs` / `node:fs/promises` 兼容层，减少重复文件系统封装，并清理相关直接依赖与测试 mock。** [`09b2383`](https://github.com/weapp-vite/weapp-vite/commit/09b2383906143adebb7717d59fe274d34a7b9a97) by @sonofmagic

- 🐛 **增强 weapp-vite 的 AI 亲和性：为 MCP 新增显式的截图与截图对比工具，补充随包文档和网站中的 AI 意图映射说明，并让 create-weapp-vite 生成的项目级 AGENTS 指引默认把截图与截图对比请求路由到 weapp-vite 的原生命令能力。** [`933826c`](https://github.com/weapp-vite/weapp-vite/commit/933826cbd52e0de267069c4b67d0e6b8a669afdb) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在处理 `<wxs src="./foo.wxs.ts">` 等脚本模块依赖时，会把 `.wxs/.sjs` 文件错误加入模板发射队列的问题。现在构建产物不再生成内容为脚本却后缀为 `.wxml` 的异常文件，例如 `index.wxs.wxml`、`bbc.wxml`、`esm.wxml`。** [`0ee43e5`](https://github.com/weapp-vite/weapp-vite/commit/0ee43e526ac13ce6bae494b13fb14b4edd70b847) by @sonofmagic

- 🐛 **整合公开 AI skills，收敛为更稳定的主技能集合，并同步更新触发映射、脚手架 AI 指引与网站技能说明。** [`9ea287d`](https://github.com/weapp-vite/weapp-vite/commit/9ea287d821a5983e746d302898e8b3a0335736e6) by @sonofmagic

- 🐛 **修复 `weapp-vite` CLI 在 `dev` 与 `build` 初始阶段未在终端输出构建耗时的问题。现在小程序首次构建、生产构建，以及 Web 构建或开发服务启动完成后，都会直接打印毫秒级耗时，便于在不启用 analyze UI 的情况下快速判断启动与构建性能。** [`edca3ee`](https://github.com/weapp-vite/weapp-vite/commit/edca3eec78db7967f79ef6c29729ee094d8023a0) by @sonofmagic
- 📦 Updated 7 dependencies [`d43b232`](https://github.com/weapp-vite/weapp-vite/commit/d43b2320b0cb38b69d8993d00d41930eb65d0fbc)
  <details><summary>Details</summary>

  `weapp-ide-cli@5.2.0`, `@weapp-core/init@6.0.6`, `@weapp-core/shared@3.0.3`, `@weapp-vite/web@1.3.11`, `@weapp-vite/mcp@1.2.0`, `wevu@6.13.4`, `@weapp-vite/ast@6.13.4`

  </details>

## 6.13.3

### Patch Changes

- 🐛 **修复 `autoImportComponents` 使用对象配置时未自动继承支持文件默认输出的问题。现在像 `VantResolver()` 这类 resolver 场景，即使只配置 `resolvers`，也会默认生成 `.weapp-vite/typed-components.d.ts`、`components.d.ts` 与 `mini-program.html-data.json`，补齐模板项目中的组件智能提示与类型声明。** [`7c361a4`](https://github.com/weapp-vite/weapp-vite/commit/7c361a45a72b1e096001a4fca05ae591e6aea3d8) by @sonofmagic

- 🐛 **增强 `autoImportComponents` 的 resolver 支持文件生成策略。现在 resolver 可以声明 `.weapp-vite` 支持文件采用“按需”还是“全量”收集；内置第三方 resolver 默认会在 `prepare` / 支持文件同步阶段为其静态组件全集生成 `auto-import-components.json`、`typed-components.d.ts`、`components.d.ts` 与 `mini-program.html-data.json`，从而补齐未在模板中直接使用的组件智能提示，同时保持运行时自动导入仍按实际命中工作。** [`74bb317`](https://github.com/weapp-vite/weapp-vite/commit/74bb31722ccbc14c89f355495d7302d06e43bdb2) by @sonofmagic
- 📦 **Dependencies** [`0f5af43`](https://github.com/weapp-vite/weapp-vite/commit/0f5af43b2a699c341a47236ee6d7f3303298bf1f)
  → `wevu@6.13.3`, `@weapp-vite/ast@6.13.3`

## 6.13.2

### Patch Changes

- 🐛 **修复 `autoRoutes` 在无 `pages/` 目录的分包根目录下误把共享脚本模块识别为页面的问题。现在像 `subpackages/item/issue-340-shared.ts` 这类仅供其他页面复用的裸脚本文件，不会再被写入 `dist/app.json` 或自动路由类型定义，从而避免 `pnpm dev:open` / 首次编译时微信开发者工具因为找不到对应 `.wxml` 页面文件而报错。** [#402](https://github.com/weapp-vite/weapp-vite/pull/402) by @sonofmagic

- 🐛 **修复 `autoImportComponents` 在搭配 `VantResolver` 等大型 resolver 时默认全量产出 resolver 组件支持文件的问题。现在仅会为模板里实际命中的 resolver 组件生成 manifest、typed components 与 Vue 编辑器声明，同时 `prepare`/支持文件同步阶段也会扫描 `.vue`、`.wxml` 模板以补齐真实使用到的组件，减少大型组件库带来的编译与支持文件生成开销。** [#401](https://github.com/weapp-vite/weapp-vite/pull/401) by @sonofmagic

- 🐛 **修复 `weapp-vite --ui` / `weapp-vite build --ui` / `weapp-vite dev --ui` 在消费端项目中优先启动 `@weapp-vite/dashboard` 源码工程的问题。现在 UI 模式统一服务 dashboard 已编译的 `dist` 静态资源，避免用户项目里的 Tailwind / PostCSS 配置继续参与 dashboard 样式编译，从而消除与 Tailwind 3、Tailwind 4 或自定义 PostCSS 流水线的冲突。** [`23230bd`](https://github.com/weapp-vite/weapp-vite/commit/23230bdd26888ecc6c854b84c2af2448f2c9142c) by @sonofmagic
- 📦 **Dependencies** [`48695e3`](https://github.com/weapp-vite/weapp-vite/commit/48695e342bcf0959b20ccb58636ac125ca09f2b5)
  → `wevu@6.13.2`, `@weapp-vite/ast@6.13.2`

## 6.13.1

### Patch Changes

- 🐛 **同步升级 workspace catalog 与 `create-weapp-vite` 模板 catalog 中的 Vue 相关依赖版本，统一到 `3.5.32`，并刷新 `@types/node`、`@tanstack/vue-query` 及锁文件，确保工作区内发布包、示例应用与脚手架生成结果使用一致的依赖基线。** [`d2ea11e`](https://github.com/weapp-vite/weapp-vite/commit/d2ea11efc6b2248a9a5ee6e5e692646c0562a211) by @sonofmagic

- 🐛 **修复 `wevu`、`wevu/*` 与 `vue-demi` 在工作区构建中的默认别名解析，避免因包入口解析失败导致 `pnpm build` 在 `weapp-vite` 相关 e2e 应用构建阶段报错。** [`9244f1a`](https://github.com/weapp-vite/weapp-vite/commit/9244f1a8017aa12545d189cbaaa74924c8ba9410) by @sonofmagic

- 🐛 **修复 request globals 在小程序运行时里遇到残缺构造器时的注入与绑定链路，确保 `axios`、`graphql-request` 等依赖 `URL`、`XMLHttpRequest` 的请求库在 WeChat DevTools 真实环境下可以正常工作，并补充对应的运行时与 IDE 回归测试。** [#394](https://github.com/weapp-vite/weapp-vite/pull/394) by @sonofmagic

- 🐛 **修复原生 `Page()` 通过 `weapp-vite/runtime` 调用 `setPageLayout()` 时的运行时导出链路，避免仅为原生 layout 切换而额外命中 `wevu` 的 page-layout 运行时代码；同时补充 `github-issues` 的 issue #389 复现页与定向回归测试。** [`b9322fb`](https://github.com/weapp-vite/weapp-vite/commit/b9322fb99c7d7ff3a00060867b7ae076390b8782) by @sonofmagic

- 🐛 **修复开发态 watch 场景下主包多个入口共享模块的增量重建回归。现在当直接编辑其中一个共享入口时，`weapp-vite` 会同步发射同一 shared chunk 的其他 importer，避免原本应继续落在 `common.js` 的共享代码被错误内联进当前页面；同时补充 `github-issues` 的 issue #391 复现页与定向 watch 回归测试。** [#396](https://github.com/weapp-vite/weapp-vite/pull/396) by @sonofmagic

- 🐛 **修复 `chunks.sharedMode: 'path'` 命中 npm devDependency 共享模块时会把 chunk 输出到 `dist/node_modules/**`的问题。现在 path 模式会把`node_modules`依赖改写为包相对路径（例如`debounce/index.js`），同时补充 `github-issues` 的 issue #393 复现页与构建回归测试。\*\* [#395](https://github.com/weapp-vite/weapp-vite/pull/395) by @sonofmagic

- 🐛 **修复开发态 HMR 在页面编辑后可能遗漏 layout 和组件 shared chunk importer 的增量重建问题。现在当页面改动触发共享 chunk 重新生成时，`weapp-vite` 会一并重新发射同一 shared chunk 的 layout/component importer，避免 `onMounted` 等共享导出别名变化后仍被旧组件 chunk 继续引用，导致热更新后页面在 attached 阶段崩溃；同时补充 `github-issues` 的 issue #398 最小复现页与定向 watch 回归测试。** [#399](https://github.com/weapp-vite/weapp-vite/pull/399) by @sonofmagic
- 📦 **Dependencies** [`d2ea11e`](https://github.com/weapp-vite/weapp-vite/commit/d2ea11efc6b2248a9a5ee6e5e692646c0562a211)
  → `wevu@6.13.1`, `weapp-ide-cli@5.1.5`, `@weapp-vite/ast@6.13.1`

## 6.13.0

### Minor Changes

- ✨ **新增 `@wevu/web-apis` 包，用于承载小程序运行时中的 Web API 垫片与全局注入能力。`weapp-vite` 现在直接复用该包提供 `weapp-vite/web-apis` 入口，后续可以在独立包中持续扩展 `fetch`、`URL`、`Blob`、`FormData` 以及更多 Web 对象的维护与注入逻辑。** [`1b5a4f8`](https://github.com/weapp-vite/weapp-vite/commit/1b5a4f81e4035d00ce430214b9365ea0a7c2de32) by @sonofmagic

### Patch Changes

- 🐛 **修复 `injectRequestGlobals` 在 `.vue` 入口上的脚本注入方式：当 SFC 同时存在 `<script setup>` 与普通 `<script>` 时，`weapp-vite` 现在会把请求全局安装代码注入到现有脚本块内部，而不是额外拼接新的 `<script>`，从而避免触发 Vue 的 `Single file component can contain only one <script> element` 解析错误。与此同时补充回归测试，并让 `request-clients-real` 的 `app.vue` 以双脚本形态稳定通过构建与 IDE runtime e2e。** [`7a42c5e`](https://github.com/weapp-vite/weapp-vite/commit/7a42c5edb01d6d305f4b97f7f840a6df73d50005) by @sonofmagic

- 🐛 **修复小程序产物对 `fetch`、`graphql-request`、`axios` 等请求库的编译期 request globals 注入，在公共 chunk 与页面 chunk 中同时补齐 `fetch`、`AbortController`、`XMLHttpRequest` 及相关 Web 构造器绑定，避免微信开发者工具中因缺失全局对象导致请求永久 pending 或运行时报错。** [`e54adcf`](https://github.com/weapp-vite/weapp-vite/commit/e54adcf44e7dd9cc5d1412eb1d27a2ecc6d0e68e) by @sonofmagic

- 🐛 **修复 `app.vue` 中 `defineAppSetup()` 需要手动从 `wevu` 导入的问题。现在 `defineAppSetup` 会像其他 SFC 宏一样自动注入运行时导入，并同步补齐全局类型声明与编译测试，允许在 `<script setup lang="ts">` 中直接编写 `defineAppSetup((app) => app.use(...))`。** [`0bfdded`](https://github.com/weapp-vite/weapp-vite/commit/0bfdded627071e594f6b37d84d2e2f84103c5642) by @sonofmagic

- 🐛 **修复 `weapp-vite` request globals 在小程序多作用域运行时下的第三方请求兼容：请求相关全局对象现在会同时注入到 `App` 与页面入口，并补齐 `graphql-request` 所需的 `URL` / `URLSearchParams` 能力，同时增强 `fetch` 兼容以支持 `axios` 的 fetch adapter 在 GET/HEAD 场景下正常工作。** [`d5d7323`](https://github.com/weapp-vite/weapp-vite/commit/d5d732388e7c163fd6e448458c960396e84ebfcc) by @sonofmagic

- 🐛 **修复原生小程序页面在默认 layout 已经生效的情况下再次调用 `setPageLayout('default')` 仍会触发额外 layout 状态更新的问题，避免页面内容区域被重复挂载并导致子组件 `attached` 生命周期执行两次。** [#387](https://github.com/weapp-vite/weapp-vite/pull/387) by @sonofmagic

- 🐛 **将 `weapp-vite` 内置的 web API 注入入口正式调整为 `weapp-vite/web-apis`，并移除旧的 `weapp-vite/requestGlobals` 子路径导出。** [`7d67f0a`](https://github.com/weapp-vite/weapp-vite/commit/7d67f0a1af4fc2899869e86ec574c7b9a03ca8c8) by @sonofmagic

- 🐛 **为 `weapp-vite` 增加请求相关全局对象自动注入能力：当项目检测到 `axios`、`graphql-request` 等依赖时，会在小程序入口按需补齐 `fetch`、`Headers`、`Request`、`Response`、`AbortController`、`AbortSignal` 与 `XMLHttpRequest`，同时支持通过 `weapp.injectRequestGlobals` 显式开启、关闭或裁剪注入目标。** [`98fa0dd`](https://github.com/weapp-vite/weapp-vite/commit/98fa0dddca9897337dcd9689fe6e2aa18d0e62cf) by @sonofmagic

- 🐛 **新增 `wevu/vue-demi` 兼容入口，并让 `weapp-vite` 默认将 `vue-demi` 解析到该入口，降低 `@tanstack/vue-query` 等 Vue 生态库在小程序项目中的接入成本。** [`7e5680e`](https://github.com/weapp-vite/weapp-vite/commit/7e5680e146ab3cd3df6262f87a23ace97415d8ad) by @sonofmagic

- 🐛 **修复小程序请求兼容主路径：优先通过 `weapp-vite` 编译期按需向入口产物注入 `AbortController` / `AbortSignal`，并把 `wevu` 中原本默认执行的 runtime 中止控制器安装降级为显式 fallback。同时让 `weapp-vite` 的 request globals runtime 直接桥接小程序原生 `request`，使 `fetch` / `XMLHttpRequest` 兼容不再依赖 `wevu/fetch` 才能工作。** [`d2f406f`](https://github.com/weapp-vite/weapp-vite/commit/d2f406f25e88b9e7f787452978ece1f5d99a597f) by @sonofmagic

- 🐛 **修复 `injectRequestGlobals` 在 Vue 页面入口上的缺口：当页面在 `entriesMap` 建立前先进入编译链路时，`weapp-vite` 现在会基于已加载入口补齐请求全局对象注入，并为 Vue SFC 入口生成可编译的本地绑定代码。同时避免在产物后处理阶段对已带本地绑定的 chunk 重复注入，保证 `axios`、`graphql-request`、`fetch` 与 `@tanstack/vue-query` 在小程序运行时的请求兼容链路稳定生效。** [`e27f11a`](https://github.com/weapp-vite/weapp-vite/commit/e27f11ac273431224581d55b2d8493ad5ce9cf50) by @sonofmagic

- 🐛 **调整 `weapp-vite` 的 Web API 注入子路径导出，统一使用 `weapp-vite/web-apis` 入口，避免运行时注入模块解析与命名长期分叉。** [`9209aa2`](https://github.com/weapp-vite/weapp-vite/commit/9209aa2701113bac4ef526d856b2b15426ba053f) by @sonofmagic

- 🐛 **修复 `weapp-vite mcp` 在普通安装项目中的路径解析问题。现在 MCP 服务会优先识别 monorepo 布局，在用户项目里则回退到 `node_modules` 下已安装的 `weapp-vite` / `wevu` / `@wevu/compiler` 包路径，不再错误假设存在 `packages/weapp-vite/package.json`。同时补充安装态 CLI 入口与本地随包文档的回归覆盖，避免 `npx weapp-vite mcp` 启动时因 `ENOENT` 直接失败。** [#386](https://github.com/weapp-vite/weapp-vite/pull/386) by @sonofmagic

- 🐛 **修复 `app.json.ts` 中从 `weapp-vite/auto-routes` 使用具名导入时 `pages` 与 `subPackages` 未正确内联的问题。** [`05b584a`](https://github.com/weapp-vite/weapp-vite/commit/05b584a62233da5c1b5c3ec0c19e729d6a621b0c) by @sonofmagic

- 🐛 **修复 `app.vue` 中 `defineAppJson()` 在双 `<script>` 场景下对普通 `<script>` 绑定的读取缺陷。现在当普通 `<script>` 与 `<script setup>` 同时存在时，JSON 宏求值与 `auto-routes` 内联会一并覆盖普通 `<script>` 的顶层导入/声明，允许把 `import routes from 'weapp-vite/auto-routes'`、`import { pages, subPackages } from 'weapp-vite/auto-routes'` 这类写法放在普通 `<script lang="ts">` 中，再由 `<script setup lang="ts">` 里的 `defineAppJson()` 直接使用。** [`a9896b4`](https://github.com/weapp-vite/weapp-vite/commit/a9896b47e365ea94e9379936c50111d8b962ab78) by @sonofmagic
- 📦 Updated 4 dependencies [`140efee`](https://github.com/weapp-vite/weapp-vite/commit/140efeea1fa7b274bbe697962774d55c2b92bdec)
  <details><summary>Details</summary>

  `wevu@6.13.0`, `@wevu/web-apis@1.1.0`, `@weapp-vite/mcp@1.1.2`, `@weapp-vite/ast@6.13.0`

  </details>

## 6.12.4

### Patch Changes

- 🐛 **修复 `custom-tab-bar` 与 `app-bar` 被错误按页面入口处理的问题。现在它们会始终按组件入口参与构建，不会再命中 `layouts/default` 这类页面布局包裹逻辑；同时补充 `github-issues` 的 issue #380 构建回归用例，覆盖默认布局存在时的自定义 tab bar 场景。** [#381](https://github.com/weapp-vite/weapp-vite/pull/381) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.12.4`, `wevu@6.12.4`

## 6.12.3

### Patch Changes

- 🐛 **修复 `weapp.autoImportComponents: true` 的默认展开行为。现在该布尔开关除了启用组件目录扫描外，还会默认开启 `auto-import-components.json`、`typed-components.d.ts`、`mini-program.html-data.json` 和 `vueComponents` 等辅助产物输出，避免模板项目只写 `true` 时缺少 IDE 补全与清单文件。** [#378](https://github.com/weapp-vite/weapp-vite/pull/378) by @sonofmagic
- 📦 **Dependencies** [`b7c8bbf`](https://github.com/weapp-vite/weapp-vite/commit/b7c8bbfcc1784ed17d7623c5dfb44b3928d5ae9a)
  → `wevu@6.12.3`, `@weapp-vite/ast@6.12.3`

## 6.12.2

### Patch Changes

- 🐛 **修复 `weapp-vite` CLI 在读取 `vite.config.ts` / `weapp-vite.config.ts` 时因 Vite `bundle` 配置加载器误走 `require` 而无法解析纯 ESM `weapp-vite` 入口的问题，避免 `apps/plugin-demo` 这类示例项目在执行 `pnpm dev` 时出现配置加载失败。同时为 `plugin-demo` 示例补充 `"type": "module"` 声明，减少 Vite 8 下的模块类型歧义。** [`2b8bc78`](https://github.com/weapp-vite/weapp-vite/commit/2b8bc78215979c125916794f18c195d60ec0b909) by @sonofmagic
- 📦 **Dependencies**
  → `weapp-ide-cli@5.1.4`, `@weapp-vite/ast@6.12.2`, `wevu@6.12.2`

## 6.12.1

### Patch Changes

- 🐛 **增强 `weapp-vite` 随包发布的 `dist/docs` 文档包，新增面向 AI 与离线开发的本地文档入口，覆盖 CLI 快速开始、AI 工作流、项目结构、`weapp` 配置、wevu 编写约束、Vue SFC 约束与常见排障说明。** [`3a54e73`](https://github.com/weapp-vite/weapp-vite/commit/3a54e733aac632d96a00d75fb334c52f75572bb3) by @sonofmagic

- 🐛 **修复 `weapp-vite` 配置加载与测试夹具清理行为。现在 `loadViteConfigFile` 与 CLI 默认使用 Vite 的 `bundle` 配置加载器，以提升 `vite.config.*` / `weapp-vite.config.*` 在不同 ESM/CJS 场景下的兼容性；同时调整仓库级 Vitest 全局清理逻辑，只清理真实临时输出，避免在执行 `pnpm test` 时误删已跟踪的 fixture `dist-*` 快照产物，并为夹具目录补充局部 `.gitignore` 来消除未跟踪测试生成物噪音。** [`4a683ed`](https://github.com/weapp-vite/weapp-vite/commit/4a683edd0b218b8c7061414129ca63fc32ae7c2d) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在复杂测试并发场景下读取 `vite.config.*` / `weapp-vite.config.*` 时，对 `weapp-vite/config` 与 `weapp-vite/auto-import-components/resolvers` 的解析不稳定问题。现在会在加载配置时生成进程级临时 shim，避免依赖易被并发测试清理的 `dist` 产物，并统一覆盖显式配置路径与自动发现配置路径，确保 `pnpm test` 与真实 CLI / 运行时配置加载都能稳定工作。** [`26895f0`](https://github.com/weapp-vite/weapp-vite/commit/26895f09c5f15c8039c4bcf4574627b3ed11602f) by @sonofmagic

- 🐛 **修复 monorepo 并行构建时 npm 依赖共享缓存目录的竞争问题。此前部分 workspace fixture 会把 `node_modules/weapp-vite/.cache/npm-source` 解析到同一个 `packages/weapp-vite` 实体目录，导致不同项目同时构建时互相覆盖缓存。现在共享 npm source cache 改为写入各项目自己的 `.weapp-vite/npm-source` 目录，避免跨项目串扰，并补充对应单测覆盖新的缓存路径解析。** [#372](https://github.com/weapp-vite/weapp-vite/pull/372) by @Sun79

- 🐛 **移除 `loadViteConfigFile` 中把 `weapp-vite/*` 子路径导入重写到当前仓库 `packages/weapp-vite/dist/*` 的内部耦合逻辑，避免源码实现绑定 monorepo 目录结构。现在配置加载不再依赖仓库内绝对路径，行为更接近已发布包的真实解析方式。** [`ef0bb34`](https://github.com/weapp-vite/weapp-vite/commit/ef0bb3483bd2ec8ea36317938ea9ac25afa83d51) by @sonofmagic

- 🐛 **修复配置加载与仓库构建稳定性问题。`weapp-vite` 现在默认使用原生 ESM 方式加载 `vite.config.ts` / `weapp-vite.config.ts`，避免在配置阶段错误走到 `require` 链路；同时仓库内示例、模板与测试夹具统一改为从 `weapp-vite` 根入口导入 `defineConfig` 等导出。另一个修复是为测试夹具补齐唯一的 workspace 名称，避免 `turbo` 在 monorepo 构建时因重复包名直接中断。** [`270e7e4`](https://github.com/weapp-vite/weapp-vite/commit/270e7e4a2dd929182b6fc3392fd98b7a7e35591e) by @sonofmagic
- 📦 **Dependencies** [`d497011`](https://github.com/weapp-vite/weapp-vite/commit/d497011547136850c80f6d34492e75ede165bf9e)
  → `wevu@6.12.1`, `weapp-ide-cli@5.1.3`, `@weapp-vite/ast@6.12.1`

## 6.12.0

### Patch Changes

- 🐛 **修复 Windows 环境下的路径与包元数据兼容问题。`weapp-vite` 现在会将 watch file 路径统一规范化为 POSIX 形式，避免布局与依赖监听在 Windows 上产出反斜杠路径；`rolldown-require` 现在会在读取 `package.json` 时自动去除 UTF-8 BOM，避免部分环境下解析版本信息时报 JSON 语法错误。** [#367](https://github.com/weapp-vite/weapp-vite/pull/367) by @sonofmagic

- 🐛 **增强 `@weapp-vite/dashboard` 的应用壳子，新增工作台、活动流、设计令牌等页面骨架，并将现有 analyze 面板迁移为独立路由页面。现在 dashboard 具备统一导航、全局主题切换和可持续扩展的页面结构，后续接入真实 CLI 事件与诊断数据会更稳定。** [#368](https://github.com/weapp-vite/weapp-vite/pull/368) by @sonofmagic

- 🐛 **统一小程序全局 API 名称与路由运行时的跨平台能力映射。`weapp-vite/auto-routes` 及其内部生成代码现在会覆盖 `swan`、`jd`、`xhs` 等运行时全局对象回退，同时把平台到全局 API 名称的映射抽到共享 helper，减少重复判断并为后续多平台扩展提供一致入口。** [`931293e`](https://github.com/weapp-vite/weapp-vite/commit/931293ebfa0f5e6f884af24778e938e5fc41853b) by @sonofmagic

- 🐛 **修复托管 `.weapp-vite/tsconfig.app.json` 在未配置 `weapp.web` 时仍默认注入 `vite/client` 的问题。现在仅在显式启用 `weapp.web` 时才会加入该类型声明，避免 `create-weapp-vite` 生成的默认模板在 `pnpm install` 后因为未直接依赖 `vite` 而出现 TypeScript 类型报错。** [#370](https://github.com/weapp-vite/weapp-vite/pull/370) by @sonofmagic

- 🐛 **修复 `app.json.ts` 中直接 `import 'weapp-vite/auto-routes'` 时的构建失败问题。现在会在执行脚本化 app 配置前内联当前的自动路由快照，并兼容 `rolldown-require` 返回非 `default` 导出的结果，确保 `pages` 与 `subPackages` 可正常写入最终 `app.json`。** [`e593d55`](https://github.com/weapp-vite/weapp-vite/commit/e593d550f29d9b2c2956c2ccadaee4e8110f3a89) by @sonofmagic
- 📦 Updated 4 dependencies [`c46de52`](https://github.com/weapp-vite/weapp-vite/commit/c46de52e65ed10146784ab583580600daa4320bf)
  <details><summary>Details</summary>

  `@weapp-vite/ast@6.12.0`, `rolldown-require@2.0.12`, `@weapp-vite/web@1.3.10`, `wevu@6.12.0`

  </details>

## 6.11.9

### Patch Changes

- 🐛 **修复新建项目在使用 Yarn 安装依赖时的 `rolldown` peer dependency 警告。`weapp-vite` 现将 `rolldown-plugin-dts` 回退到与 `rolldown@1.0.0-rc.11` 兼容的 `0.22.5`，并同步重新发布 `rolldown-require` 与 `create-weapp-vite`，确保脚手架默认生成项目的依赖版本保持一致，减少安装期的误导性告警。** [`60487a4`](https://github.com/weapp-vite/weapp-vite/commit/60487a4e9ea8057c4b3b6952870ab94355a20cc8) by @sonofmagic
- 📦 Updated 4 dependencies [`0066308`](https://github.com/weapp-vite/weapp-vite/commit/0066308e1af282e9bc204143e685c54edd490f41)
  <details><summary>Details</summary>

  `rolldown-require@2.0.11`, `@weapp-vite/web@1.3.9`, `wevu@6.11.9`, `@weapp-vite/ast@6.11.9`

  </details>

## 6.11.8

### Patch Changes

- 🐛 **将 Vite 回退到 `8.0.2`，恢复其默认依赖的 `rolldown@1.0.0-rc.11`，临时规避小程序 `dev/watch` 模式下二次增量构建触发的 `[FILE_NAME_CONFLICT]` 告警。** [`56adc6b`](https://github.com/weapp-vite/weapp-vite/commit/56adc6b31fcc104b0f62be7a6c112e33232e7077) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.8`, `wevu@6.11.8`

## 6.11.7

### Patch Changes

- 🐛 **回退 Rolldown 到 `1.0.0-rc.11`，临时规避 `weapp-vite@6.11.6` 在小程序 `dev/watch` 模式下二次增量构建触发的 `[FILE_NAME_CONFLICT]` 告警，并同步模板 catalog 依赖版本。** [`60cb50f`](https://github.com/weapp-vite/weapp-vite/commit/60cb50ff0b0fd2973247efbd1db46e708fccb2bf) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.7`, `wevu@6.11.7`

## 6.11.6

### Patch Changes

- 🐛 **同步升级脚手架模板与构建链路使用的 catalog 依赖版本，包括 `weapp-tailwindcss`、`tdesign-miniprogram`、`rolldown` 与 `vite`，减少模板生成结果和仓库实际依赖之间的版本漂移。同时增强 `createProject` 的 `.gitignore` 相关测试，避免模板依赖版本正常升级后因为硬编码断言而产生误报。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic

- 🐛 **为 CLI 新增 `--platform all` 双目标运行模式，允许同时启动小程序构建链路与 Web 运行时；并同步完善模板应用的调试脚本，便于一边查看 UI 分析面板一边启动 Web 侧预览。** [`45fb197`](https://github.com/weapp-vite/weapp-vite/commit/45fb197281199dc9672437b109321e1f868c315d) by @sonofmagic

- 🐛 **修复 `wevu` Vue SFC 页面在 `<script setup>` 中通过默认 `@/` 别名导入组件时，自动生成的 `usingComponents` 路径被错误拼成页面相对路径的问题，避免构建时出现找不到组件入口文件的告警。** [`2545727`](https://github.com/weapp-vite/weapp-vite/commit/2545727d502a3d83fb7085e6dfd7c9372f493ea1) by @sonofmagic

- 🐛 **为 `weapp-vite` 新增 `--ui` 调试入口并保留 `--analyze` 兼容别名，同时将 dashboard 升级为单页多面板分析 UI，集中展示包体、分包、产物文件与跨包模块复用细节。** [`f278c9f`](https://github.com/weapp-vite/weapp-vite/commit/f278c9f04bb4b17138cbb3bb21f2f969585d08d3) by @sonofmagic

- 🐛 **同步升级 `weapp-vite` 与 `rolldown-require` 对 `rolldown@1.0.0-rc.11` 的依赖约束，并更新部分 Vue 3.5.31、`tsdown` 等构建链路依赖版本，减少脚手架与实际构建环境之间的版本漂移。** [`3094be8`](https://github.com/weapp-vite/weapp-vite/commit/3094be81a5c569237425602388b7a7a579cdbce0) by @sonofmagic
- 📦 Updated 4 dependencies [`3094be8`](https://github.com/weapp-vite/weapp-vite/commit/3094be81a5c569237425602388b7a7a579cdbce0)
  <details><summary>Details</summary>

  `rolldown-require@2.0.10`, `@weapp-vite/web@1.3.8`, `wevu@6.11.6`, `@weapp-vite/ast@6.11.6`

  </details>

## 6.11.5

### Patch Changes

- 🐛 **修复开发态增量构建里跨主包与分包共享 chunk 的入口补发策略。当 direct update 命中这种跨包共享模块时，HMR 现在会把同组入口一起重编，避免 shared chunk 落点漂移后出现 `node_modules/wevu/dist/index.js` 未定义、分包 runtime 失配等运行时报错。** [#353](https://github.com/weapp-vite/weapp-vite/pull/353) by @sonofmagic

- 🐛 **迁移 TypeScript 6 相关的 tsconfig 默认配置与受管生成逻辑。初始化模板和 `.weapp-vite/tsconfig.app.json` 不再生成已弃用的 `baseUrl` 与冗余的 `DOM.Iterable`，同时把别名路径统一改成对当前文件位置生效的显式相对路径，避免 `vue-tsc` / `tsc` 在 TypeScript 6 下因旧配置报错。** [`575f087`](https://github.com/weapp-vite/weapp-vite/commit/575f087e8f4e852736e7e0aafed1123e5371834e) by @sonofmagic

- 🐛 **新增 `weapp.forwardConsole` 开发态日志转发能力：在微信开发者工具连接成功后，可将小程序 `console` 日志与未捕获异常桥接到终端输出。默认在检测到 AI 终端时自动开启，并支持通过配置控制启用状态、日志级别与异常转发行为。** [`22897df`](https://github.com/weapp-vite/weapp-vite/commit/22897df1dbe8a460955bb41fa9147fbc33e0f81e) by @sonofmagic
- 📦 Updated 4 dependencies [`575f087`](https://github.com/weapp-vite/weapp-vite/commit/575f087e8f4e852736e7e0aafed1123e5371834e)
  <details><summary>Details</summary>

  `@weapp-core/init@6.0.5`, `weapp-ide-cli@5.1.2`, `@weapp-vite/ast@6.11.5`, `wevu@6.11.5`

  </details>

## 6.11.4

### Patch Changes

- 🐛 **优化 `weapp-vite` 的页面级 Vue transform 后处理：当页面脚本中不包含任何页面生命周期 hook 提示时，不再进入 `injectWevuPageFeaturesInJsWithViteResolver()` 的 AST 与模块依赖分析流程。这样可以减少普通页面在热更新与构建阶段的无效页面特性注入开销，同时保持真正使用页面 hook 的场景行为不变。** [`9ae1594`](https://github.com/weapp-vite/weapp-vite/commit/9ae1594d10f748d32ba3e11533f992e9c5f5b010) by @sonofmagic

- 🐛 **将 `weapp-vite` 构建输出清理逻辑中的 `rimraf` 替换为 Node 原生 `fs/promises` 实现。现在输出目录和外部插件产物目录的清理统一使用 `readdir` + `rm`，保留原有的 `miniprogram_npm` 目录保护与外部插件产物整理语义，同时移除 `rimraf` 的直接依赖并更新相关测试。** [`5362bd0`](https://github.com/weapp-vite/weapp-vite/commit/5362bd0f4795ca2917dece5efe4a2d56a592f9cc) by @sonofmagic

- 🐛 **优化 `weapp-vite` 的页面滚动性能诊断路径：当页面脚本中不包含 `onPageScroll` 提示时，不再进入 `collectOnPageScrollPerformanceWarnings()` 的 AST 分析流程。这样可以减少普通页面在热更新与构建阶段的无效性能诊断开销，同时保留真正使用 `onPageScroll` 场景下的诊断行为。** [`304adf6`](https://github.com/weapp-vite/weapp-vite/commit/304adf65f6472919d3537684b520ee358cd40959) by @sonofmagic

- 🐛 **优化 `weapp-vite` 在开发模式下的 `autoImportComponents` 热更新路径。此前 `autoImport` 插件在 dev 的后续 `buildStart` 中会重复全量扫描组件 globs；现在改为在首次扫描后通过 sidecar watcher 增量处理新增/删除组件文件，避免每次热更新都重新遍历整个组件目录，从而减少 `autoImportComponents` 对热更新耗时的影响。** [`7a8cc24`](https://github.com/weapp-vite/weapp-vite/commit/7a8cc244b04a489b8b64ae41f5c52bfb5a6f0f8d) by @sonofmagic

- 🐛 **优化 `weapp-vite` 在开发模式下 `autoImportComponents` 的 sidecar watcher 监听范围。现在当 globs 已能推导出明确基础目录时，sidecar watcher 不再额外监听整个 `src` 根目录，而是仅监听实际需要的组件目录，从而减少监听器覆盖面与潜在的文件监听压力。** [`32bef2d`](https://github.com/weapp-vite/weapp-vite/commit/32bef2d0f81810a60c5f6d701c1c6242c68b9b7a) by @sonofmagic

- 🐛 **优化 `weapp-vite` 的页面布局规划解析：当页面源码中既不包含 `definePageMeta()` 也不包含 `setPageLayout()` 提示时，`resolvePageLayoutPlan()` 不再额外做源码 AST 解析，而是直接进入默认 layout / routeRules 分支。这可以减少大量普通页面在热更新与构建阶段的布局元信息解析开销，同时保持默认布局行为不变。** [`afb08ec`](https://github.com/weapp-vite/weapp-vite/commit/afb08ec47c938b1f9a518711718c0ce3804a4614) by @sonofmagic

- 🐛 **收窄 `weapp-vite` 中 `autoRoutes` 在开发模式下的热更新重扫触发条件。此前位于 `src/pages/**` 下的普通文件更新也可能触发一次路由全量重扫；现在仅在结构性变化（如新增、删除）时才对未命中的 pages 路径触发重扫，而真正的路由入口文件更新仍保持增量处理，从而减少无关文件变更对热更新速度的影响。** [`43c552d`](https://github.com/weapp-vite/weapp-vite/commit/43c552d10ec7f50a246b974778d6df40d0b03b3a) by @sonofmagic

- 🐛 **为 `weapp-vite` 新增 `weapp.debug.vueTransformTiming` 调试回调，用于输出 Vue 文件在 transform 阶段的分段耗时。启用后可观察单次编译中 `readSource`、`preParseSfc`、`compile`、页面后处理等步骤的耗时分布，便于继续分析和优化热更新与构建性能。** [`4439fa7`](https://github.com/weapp-vite/weapp-vite/commit/4439fa7e9f963998935f025b29d09d6d2f5a19ac) by @sonofmagic

- 🐛 **修复动态页面布局模板在重复应用 layout transform 时可能被再次包裹的问题。此前同一个页面在经过多轮 transform / 构建后，`wx:if` 动态 layout 分支会整体再嵌套一层，导致切换到 `admin` 布局时出现重复的 `layouts/admin.vue` 页面壳。现在动态 layout 包裹逻辑已保持幂等，并补充对应测试，确保同一页面模板不会被重复注入 layout 分支。** [`1a5da11`](https://github.com/weapp-vite/weapp-vite/commit/1a5da1142ddae8362f9f46cc691a4f186cfa7811) by @sonofmagic

- 🐛 **为 `layout-host` 增加通用的编译期声明与运行时实例解析机制：layout 内组件可直接用 `layout-host="..."` 暴露宿主，`wevu` 会优先从运行时已解析的宿主实例读取能力，减少页面/组件侧对 `selector`、`id`、`useTemplateRef()` 和手动注册 bridge 的依赖。同步修复 `weapp-vite` 在 layout 构建时错误输出 scriptless stub 的问题，并更新 TDesign wevu 模板与 DevTools e2e，用例覆盖首页 toast、layout-feedback 页面 alert/confirm 以及无 `未找到组件` 警告的场景。** [`e52f7b1`](https://github.com/weapp-vite/weapp-vite/commit/e52f7b1f00b9007bd4a25b2414bc52f5a30890aa) by @sonofmagic

- 🐛 **为 `weapp-vite` 增加开发态输出目录清理开关 `weapp.cleanOutputsInDev`，并将开发态默认行为调整为“不在 `dev` / `dev -o` 启动前全量清空小程序输出目录”。这样模板和项目在默认配置下即可减少开发模式的磁盘清理开销；如果需要恢复旧行为，可显式设置 `cleanOutputsInDev: true`。** [`0dbdb30`](https://github.com/weapp-vite/weapp-vite/commit/0dbdb304cd3db1df579d0e828ae17beb29194bb2) by @sonofmagic

- 🐛 **修复 layout 文件热更新导致共享 `common.js` 被错误裁剪的问题。现在当 `src/layouts/**` 发生更新时，`weapp-vite`会对当前已解析入口执行更完整的失效传播，避免只重编译 layout 入口而产出残缺`common.js`。同时调整 wevu 的临时配置执行目录策略，避免在热更新期间因临时目录竞争导致编译失败，最终修复微信开发者工具里 `require_common.defineStore is not a function` 这一类报错。** [`8f66a85`](https://github.com/weapp-vite/weapp-vite/commit/8f66a85fd7dc4021409ff3fff26f8723d0bf967d) by @sonofmagic

- 🐛 **优化 `weapp-vite` 在入口装载阶段对 Vue layout 的 scriptless 判定。现在同一个 layout 文件在多页面共享时，会复用首次读取与 `parseSfc` 的判定结果，而不再为每个页面重复读取和解析该 layout，从而减少 `weapp-vite:pre` 阶段的重复工作。** [`3ef0a19`](https://github.com/weapp-vite/weapp-vite/commit/3ef0a19e2e27554459629f824ea6dc369c893eb5) by @sonofmagic

- 🐛 **恢复 `weapp-vite` 在开发模式下默认会先清空输出目录的行为，同时保留 `weapp.cleanOutputsInDev` 作为显式开关。现在只有当项目明确设置 `cleanOutputsInDev: false` 时，`dev` / `dev -o` 才会跳过启动前的输出目录清理，以兼顾既有语义与可选优化能力。** [`753a347`](https://github.com/weapp-vite/weapp-vite/commit/753a347023f24e31f67e9bef3351f421a21650d2) by @sonofmagic

- 🐛 **优化 `weapp-vite` 的页面布局解析路径：对 `src/layouts` 的扫描结果增加缓存，并在 layout 文件变更时自动失效。这样多页面项目在热更新与构建阶段不再为每个页面重复遍历布局目录，同时保持 layout 变更后的刷新行为正确。** [`70d8bd1`](https://github.com/weapp-vite/weapp-vite/commit/70d8bd180f96fffc1a289b0467f48a9822b4172b) by @sonofmagic

- 🐛 **优化 `weapp-vite` 的 Vue transform 路径：对于不包含 `<style>` 的 `.vue` 文件，不再额外做一次 SFC 预解析来收集样式块。这样可以减少无样式组件和页面在开发热更新与构建阶段的重复解析开销，同时保留带样式 SFC 的既有行为。** [`9cc1a87`](https://github.com/weapp-vite/weapp-vite/commit/9cc1a87e60089f034ee2c092c54d5808f0c04fef) by @sonofmagic
- 📦 Updated 4 dependencies [`3ca1671`](https://github.com/weapp-vite/weapp-vite/commit/3ca1671ba853cf859e8cbbb81e93c5ad186ee8aa)
  <details><summary>Details</summary>

  `wevu@6.11.4`, `rolldown-require@2.0.9`, `@weapp-vite/web@1.3.7`, `@weapp-vite/ast@6.11.4`

  </details>

## 6.11.3

### Patch Changes

- 🐛 **修复 native layout 构建回归测试对预构建产物的隐式依赖：测试临时项目现在会将 `weapp-vite/runtime` 显式映射到源码入口，避免在干净 CI 环境中因缺少 `dist/runtime.mjs` 而解析失败，从而稳定 release 流程中的 `layoutBuild.native.test.ts`。** [`adec1fc`](https://github.com/weapp-vite/weapp-vite/commit/adec1fc243e43c9603563148b70303c2a612a2ae) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.3`, `wevu@6.11.3`

## 6.11.2

### Patch Changes

- 🐛 **修复 `.weapp-vite` 托管 tsconfig 的 bootstrap 覆盖问题：当项目已经生成过带有实际 `vite.config.ts` 配置的支持文件时，启动 `weapp-vite dev` 不会再被轻量 bootstrap 回退成通用版本，也不会因此在每次启动时都误报“支持文件缺失或已过期”。** [`2d9338c`](https://github.com/weapp-vite/weapp-vite/commit/2d9338cd98d7203feac247b7828339e213bff9e4) by @sonofmagic

- 🐛 **修复 Vue layout 页面注入导致的运行时注册时机错误：页面布局转换不再为 Vue layout 额外注入副作用 import，避免 layout 组件被提前打进 `common.js` 并在应用初始化之后才调用构造函数；同时补充源码单测、模板构建集成测试与微信开发者工具运行时 e2e，覆盖 layout 资源产物与无错误启动场景。** [`35e49b3`](https://github.com/weapp-vite/weapp-vite/commit/35e49b33897e47af0847efe06164a2718168d9cd) by @sonofmagic

- 🐛 **修复 `.weapp-vite` 支持文件未及时更新时的体验问题：在运行时检测到受管 tsconfig 等支持文件缺失或过期后，会先输出 warning，再自动执行一次与 `weapp-vite prepare` 等价的同步流程，减少模板项目因忘记 prepare 导致的类型异常。** [`76ddfce`](https://github.com/weapp-vite/weapp-vite/commit/76ddfced53ebca3f841eebf5d7631c1c6568ed0c) by @sonofmagic

- 🐛 **修复 `.weapp-vite/tsconfig.app.json` 的默认类型与别名生成：现在会自动注入 `weapp-vite/client`，并让 `@/*` 跟随 `weapp.srcRoot`。同时清理 templates 中仍残留在根目录和 `src/` 下的旧支持文件，统一改由 `.weapp-vite` 托管生成。** [`94320d3`](https://github.com/weapp-vite/weapp-vite/commit/94320d3ec92e3803054e4d8f7dd8e60d7c1f7e12) by @sonofmagic

- 🐛 **修复默认 autoRoutes 对分包根目录的误扫描：当分包内已经存在 `pages/` 目录时，不再把分包入口脚本误识别为页面并写回 `subPackage.pages`；同时去重独立分包 `entry` 与 plugin export 重叠时生成的重复 entries，并补充对应回归测试。** [`cdfd282`](https://github.com/weapp-vite/weapp-vite/commit/cdfd282af1f52b8788a4bef8f113d61ac5633b00) by @sonofmagic
- 📦 **Dependencies** [`aef4a30`](https://github.com/weapp-vite/weapp-vite/commit/aef4a30c974c566dc181cc7152e04c96d0f6e41e)
  → `wevu@6.11.2`, `@weapp-vite/volar@2.0.8`, `@weapp-vite/ast@6.11.2`

## 6.11.1

### Patch Changes

- 🐛 **修复程序化调用 `createCompilerContext` 时在干净工作区中加载 `vite.config.ts` 可能因为缺少 `.weapp-vite/tsconfig.*.json` 而失败的问题。现在在传入 `cwd` 创建编译上下文前会先补齐托管 tsconfig 引导文件，并补充 Web 配置加载的回归测试，避免 CI 或新检出环境下出现 `Tsconfig not found`。** [`6088c6c`](https://github.com/weapp-vite/weapp-vite/commit/6088c6ca8c8f146472de06bded3ec6b66b970734) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.11.1`, `wevu@6.11.1`

## 6.11.0

### Minor Changes

- ✨ **为 `weapp-vite` 新增了接近 Nuxt `app/layouts` 的页面布局能力：支持在 `src/layouts` 目录中约定 `default` 或命名布局，并通过 `definePageMeta({ layout })` 为页面声明使用的布局，同时支持 `layout: false` 显式关闭默认布局。布局组件既可以使用 Vue SFC，也可以使用原生小程序组件；编译阶段会自动包裹页面模板、注入布局组件的 `usingComponents` 配置，并让页面内容通过布局内的 `<slot></slot>` 渲染，同时提供对应的宏类型声明。** [`35a6ee0`](https://github.com/weapp-vite/weapp-vite/commit/35a6ee06d7b8fa56435684011cc706ea5bf9f432) by @sonofmagic
  - 此外，`definePageMeta` 现已支持对象写法的布局配置，例如 `layout: { name: 'panel', props: { sidebar: true, title: 'Dashboard' } }`。当前会将静态字面量 `props` 编译为布局标签属性，并同时覆盖 Vue 布局与原生小程序布局场景。
  - 同时，`weapp-vite` 现在会将默认生成的 `components.d.ts`、`typed-components.d.ts`、`typed-router.d.ts`、`auto-import-components.json` 等支持文件统一输出到项目根目录下的 `.weapp-vite/` 中，并建议通过 `.gitignore` 忽略该目录，减少源码目录中的生成噪音。CLI 新增了 `weapp-vite prepare` 命令，可在开发、构建或类型检查前预先生成这批文件；相关模板与示例项目的 `tsconfig` 和脚本也已同步调整到新的输出目录。仓库模板与 `apps/*` 现在默认在 `postinstall` 阶段执行 `weapp-vite prepare`，Tailwind 场景会在 `weapp-tw patch` 之后继续生成 `.weapp-vite` 支持文件，行为上更接近 Nuxt 的 `nuxt prepare`；`e2e-apps/*` 仍保持轻量，不默认加入这一步以避免放大测试夹具安装成本。

### Patch Changes

- 🐛 **升级 `htmlparser2` 到 `^11.0.0`，同步刷新工作区锁文件与相关包的依赖解析结果，确保 `weapp-vite` 与 `@weapp-vite/web` 在后续发布时携带一致的解析器版本。由于本次发布包含 `weapp-vite`，按仓库发布约定同时补充 `create-weapp-vite` 的版本变更。** [`526c0db`](https://github.com/weapp-vite/weapp-vite/commit/526c0dbc3e415095a87b661fb26d9624ef6b4b5d) by @sonofmagic

- 🐛 **为 `weapp-vite` 增加了由 `.weapp-vite/tsconfig.app.json`、`.weapp-vite/tsconfig.server.json`、`.weapp-vite/tsconfig.node.json` 与 `.weapp-vite/tsconfig.shared.json` 组成的托管 TypeScript 配置输出。`weapp-vite prepare` 现在会同步生成这些文件，CLI 在加载 `vite.config.ts` 之前也会先做一次轻量 bootstrap，避免根 `tsconfig.json` 仅保留 references 后出现配置加载失败。** [`05784e8`](https://github.com/weapp-vite/weapp-vite/commit/05784e8e3b2c4848efa6de63624b1b90a979a1e5) by @sonofmagic
  - 同时，`create-weapp-vite` 模板与 `@weapp-core/init` 生成的根 `tsconfig.json` 现已统一收敛为 Nuxt 风格的轻量入口，只保留对 `.weapp-vite/*` 的 references；相关示例项目与模板的 `typecheck` 脚本也改为直接指向 `.weapp-vite/tsconfig.app.json`，从而将主要 TypeScript 配置的维护职责收拢到 `weapp-vite`。对于仍保留项目根目录 `tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.server.json` / `tsconfig.shared.json` 的旧项目，`weapp-vite` 也会在生成 `.weapp-vite` 托管产物时自动合并这些手写配置，便于渐进迁移。模板中预置了 `tdesign-miniprogram` 与 `@vant/weapp` 等常见小程序 UI 库时，也会同步在托管的 app tsconfig 中带上对应 `paths` 别名，方便直接获取库内的 TypeScript/JavaScript 声明与实现入口。

- 🐛 **修复原生 Page 使用原生 `layouts/*` 时仅注入 `usingComponents` 但未同步发射布局产物的问题，确保模板与业务项目在构建后都能正确生成 `dist/layouts/**` 组件文件，避免开发者工具报出布局组件缺失错误。** [`e0cb064`](https://github.com/weapp-vite/weapp-vite/commit/e0cb064584838a1ec7c7ee04fcf0060caf91ffa3) by @sonofmagic

- 🐛 **升级 `htmlparser2` 到 `^12.0.0`，同步刷新 workspace catalog、脚手架生成 catalog 与锁文件，确保 `weapp-vite` 和 `@weapp-vite/web` 后续发布时解析器版本保持一致。考虑到 `create-weapp-vite` 会下发同一份 catalog 版本，本次也一并补充脚手架包的补丁版本变更。** [`84c227a`](https://github.com/weapp-vite/weapp-vite/commit/84c227a0b537a2f12bc512686970a0f63916366a) by @sonofmagic

- 🐛 **修复插件独立构建场景下的 npm 产物输出与依赖重写逻辑。现在 `weapp-vite build` 在存在 `pluginRoot` 时会同时为插件产物构建 `miniprogram_npm`，并将插件 chunk / JSON 中的 npm 引用改写到插件本地输出目录，避免插件构建后只有 npm 目录而运行时代码仍保留裸包名引用的问题。同时补充 `apps/plugin-demo` 的 dayjs 演示，以及对应的单元测试与构建 e2e 覆盖。** [`1539f2c`](https://github.com/weapp-vite/weapp-vite/commit/1539f2cecbe31bc0c8fcd861ccab76e2c4a9f6ab) by @sonofmagic

- 🐛 **修复原生 layout 目录下 `index.ts` 脚本不会被发射为输出 `js` 资源的问题。现在原生 layout 脚本支持以 TypeScript 编写，构建时会自动去除类型并生成对应的 `.js` 文件，避免出现跳过脚本发射的告警。** [`a6d9516`](https://github.com/weapp-vite/weapp-vite/commit/a6d95163b6f2f1765cb90f6d7004364a9cd28926) by @sonofmagic

- 🐛 **修复 Vue layout 在小程序构建输出中的脚本兜底与页面依赖发射逻辑，避免 `usingComponents` 指向的布局组件缺少 `.js` 产物时导致运行时空白。同时同步更新相关模板 e2e 快照与断言，覆盖默认布局包裹、布局页面入口和子包模板产物变化。** [`4a0966a`](https://github.com/weapp-vite/weapp-vite/commit/4a0966a978e8ef5565477923d8d575d640ef8fa2) by @sonofmagic

- 🐛 **增强了 `weapp-vite prepare` 在安装阶段的容错能力：现在会兼容 `pnpm exec` / `postinstall` 场景下可能出现的异常位置参数解析，显式传入 `weapp-vite prepare .` 也不会再被误判为未使用参数。即使 `packages/weapp-vite` 的 `dist/cli.mjs` 尚未构建，或项目配置、自动生成流程内部出现异常，`prepare` 也会统一降级为警告并跳过预生成，不再打断 `pnpm install`、`postinstall` 或其他串联命令。** [`bf447ae`](https://github.com/weapp-vite/weapp-vite/commit/bf447aef95f8def01c0fc10fc18f2f3da75c553b) by @sonofmagic

- 🐛 **修复安装链路中的稳定性问题：当前仓库在无交互环境下执行 `pnpm install` 可能因 `node_modules` 清理确认而直接中断，同时 `weapp-vite prepare` 在 `postinstall` 场景下遇到异常时不应打断用户的安装命令。现在仓库自身通过 `confirm-modules-purge=false` 规避无 TTY 中断，且 `prepare` 在 bin/CLI 两层都会降级为 warning 或强制保持成功退出，不再让 `pnpm i` 因该命令失败。** [`85e1af1`](https://github.com/weapp-vite/weapp-vite/commit/85e1af15b142669a1400d7349cafa08f4f7e8f12) by @sonofmagic

- 🐛 **修复原生 layout script 在 Vue 打包收尾阶段错误发射 chunk 导致的构建失败问题。现在会在允许的构建钩子中预注册 layout 脚本 chunk，并保留 generateBundle 阶段只处理布局 sidecar 资源，同时补充对应的 transform、fallback 与 bundle 回归测试。** [`cdb419d`](https://github.com/weapp-vite/weapp-vite/commit/cdb419d0e60a8def76330f88c046a8e28ac75c72) by @sonofmagic

- 🐛 **修复原生页面通过 `usingComponents` 引入组件时的入口类型传播错误。现在 `weapp-vite` 会将这类下游入口显式标记为组件，避免在构建阶段误按页面处理并套用默认 layout，从而消除首页嵌套组件重复渲染 layout 外壳的问题，并补充对应的回归测试覆盖。** [`a15b558`](https://github.com/weapp-vite/weapp-vite/commit/a15b5589cf2a55c93922923c718475ad4185d8dc) by @sonofmagic

- 🐛 **修复原生 layouts 相关文件在开发模式下的热更新链路，建立 `layout` 及其 `json/wxml/wxss/ts` sidecar 到页面入口的反向依赖追踪，确保布局脚本与配置变更能够正确触发关联页面重新发射。同时补充 `layouts` 的 HMR 用例矩阵，覆盖页面、default layout、admin layout 三组资源的 `wxml/wxss/ts/json` 场景。** [`929b814`](https://github.com/weapp-vite/weapp-vite/commit/929b814c5928f268423c2212852ec685e96b3a6a) by @sonofmagic

- 🐛 **修复了一组由类型产物路径迁移与 `defineOptions` 临时求值模块带来的回归问题。`auto-routes` 与模板相关 e2e 现已统一校准到 `.weapp-vite` 下的 `typed-router.d.ts`、`components.d.ts`、`typed-components.d.ts` 等托管产物路径，子包构建断言也改为基于稳定语义而不是压缩后的局部变量名，避免因为产物重命名导致误报。** [`36de3a6`](https://github.com/weapp-vite/weapp-vite/commit/36de3a69c5eab302bac1ea31b5cf974c4f14fa98) by @sonofmagic
  - 同时，`@wevu/compiler` 生成的 `defineOptions` 临时模块不再混用 default export 与 named export，消除了构建阶段的 `MIXED_EXPORTS` 警告；仓库根 `tsconfig.json` 里的 Volar 插件声明也改为使用 `weapp-vite/volar` 包名，避免子项目继承根配置后执行 `vue-tsc` 时出现插件相对路径错位告警。这些修复会同步改善 `weapp-vite` 模板与脚手架生成项目的类型检查体验，因此一并补充 `create-weapp-vite` 的版本变更。

- 🐛 **调整 `weapp-vite-lib-template` 的默认发布配置，使组件库模板更适合发布到 npm 并由宿主自行安装 `wevu`。现在模板会将 `wevu` 同时声明到 `peerDependencies` 与 `devDependencies`（模板源使用 `workspace:*`，脚手架生成项目时会落成具体版本），并在 lib 模式构建里将 `wevu` 及其子路径（如 `wevu/router`、`wevu/api`）统一 external，避免运行时包被打进组件库产物。** [`99ab5d5`](https://github.com/weapp-vite/weapp-vite/commit/99ab5d5e5b7cb89e14563d6e5ce294c5b003ca6e) by @sonofmagic

- 🐛 **修复在 macOS 临时目录等真实路径与符号链接路径不一致时，布局解析与输出路径计算可能失效的问题。现在会对 `srcRoot`、`layouts` 目录与布局入口路径做更稳健的 realpath 归一化，避免 `app.vue`、Vue layout 与 native layout 在构建阶段出现布局找不到或产物路径错位。** [`8048eef`](https://github.com/weapp-vite/weapp-vite/commit/8048eef419c05e3220117d204146c50ed28c8a51) by @sonofmagic

- 🐛 **为原生 `Page()` 页面补充 layout 运行时切换能力，并将 `setPageLayout` 从 `weapp-vite` 直接导出。`weapp-vite-lib-template` 现在也内置 `src/layouts` 与原生布局演示页，可在不使用 wevu 页面写法的前提下体验 default/admin/关闭布局三种模式。** [`072998a`](https://github.com/weapp-vite/weapp-vite/commit/072998acfe2a913fb2ecae2702cd3c0c0db4a8b9) by @sonofmagic

- 🐛 **修复 lib 模式下的声明生成回归。`weapp-vite` 现在在调用 `rolldown-plugin-dts` 时会自动识别带有 `references` 的 `tsconfig`，并切换到 build mode，避免 `templates/weapp-vite-lib-template` 执行 `pnpm build:lib` 时因 project references 直接失败；同时 `wevu` 补充导出 `defineComponent` 类型 props 重载相关的公开类型，避免 Vue SFC 声明生成时泄漏到不可命名的内部类型，导致组件库 dts 产物构建报错。** [`8e78ad0`](https://github.com/weapp-vite/weapp-vite/commit/8e78ad02dee3a36ec411fbcf2fa143bf9a3766df) by @sonofmagic

- 🐛 **修复 `prepare` 引导阶段对 `process.exitCode` 的守卫失效问题，避免支持文件预生成流程在可忽略场景下遗留非零退出码；同时补齐根 Vitest 覆盖率临时目录初始化，并同步更新 `import-umd` 测试快照，使 `pnpm test` 恢复稳定通过。** [`564eb93`](https://github.com/weapp-vite/weapp-vite/commit/564eb938d2d78352b18076b18fcd6aab988703f4) by @sonofmagic
- 📦 Updated 4 dependencies [`526c0db`](https://github.com/weapp-vite/weapp-vite/commit/526c0dbc3e415095a87b661fb26d9624ef6b4b5d)
  <details><summary>Details</summary>

  `@weapp-vite/web@1.3.6`, `@weapp-core/init@6.0.4`, `wevu@6.11.0`, `@weapp-vite/ast@6.11.0`

  </details>

## 6.10.2

### Patch Changes

- 🐛 **完善 plugin-demo 对小程序插件混合能力的演示，补充插件内 Vue SFC、TypeScript、SCSS、原生页面与公开组件组合示例；同时修复插件构建时插件内 `usingComponents` 绝对路径按主包根目录解析导致的误报告警，并补充对应构建回归测试。** [`3dc4ac2`](https://github.com/weapp-vite/weapp-vite/commit/3dc4ac25178678b85492ce235e9176dd7b635b23) by @sonofmagic
- 📦 **Dependencies** [`602143a`](https://github.com/weapp-vite/weapp-vite/commit/602143a906e2cdb04534cd9238ba7bcb438282c6)
  → `wevu@6.10.2`, `@weapp-vite/ast@6.10.2`

## 6.10.1

### Patch Changes

- 🐛 **优化 `weapp-vite` 在 `hmr.sharedChunks = 'auto'` 下的增量更新策略。现在直接编辑页面、组件、样式与模板时，会优先保持增量 emit，不再因为共享 chunk importer 信息暂时不完整就退化成全量重发；当共享依赖变更触发受影响 entry 失效时，再按已知 shared importer 关系扩散，并在局部构建后增量刷新 importer 映射。这样可以显著降低模板项目等多入口场景下的开发态热更新耗时，同时保留 `auto` 模式对共享 chunk 变更的安全兜底。** [`a5cc310`](https://github.com/weapp-vite/weapp-vite/commit/a5cc3105dd13c993b7905e65152c324c4d903d20) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.10.1`, `wevu@6.10.1`

## 6.10.0

### Minor Changes

- ✨ **将 `weapp-vite analyze` 的仪表盘资源从主包中拆分为独立的可选安装包 `@weapp-vite/dashboard`。未安装该包时，CLI 会提示对应的安装命令并自动降级为仅输出分析结果，不再要求主包默认携带大体积 dashboard 静态资源。** [`be412dd`](https://github.com/weapp-vite/weapp-vite/commit/be412dda3507e7c29cb25be0e90d5e5374f18fde) by @sonofmagic

### Patch Changes

- 🐛 **修复跨分包复制共享 chunk 时的 runtime 本地化遗漏问题。当子包 A 的 chunk 因被子包 B 引用而复制到子包 B 的 `weapp-shared` 目录后，构建流程现在会继续为子包 B 发出对应的 `rolldown-runtime.js`，避免运行时出现 `module 'subpackages/user/rolldown-runtime.js' is not defined` 一类错误。** [#342](https://github.com/weapp-vite/weapp-vite/pull/342) by @sonofmagic

- 🐛 **修复 `plugin-demo` 这类同时构建主小程序与插件的场景里，`app` 构建错误地把 `plugin.json` 里的插件入口纳入同一编译图、以及插件主入口导出在独立构建中被错误裁剪的问题。现在插件入口仅会在 `plugin` target 下单独解析与产出，`project.config.json` 指定的 `dist/` 与 `dist-plugin/` 会各自独立 emit 正确产物，不再共享不必要的 JS chunk，并且 `requirePlugin()` 可以正确拿到插件导出。** [`5a11167`](https://github.com/weapp-vite/weapp-vite/commit/5a111674cf4a19ca466e9453f8363a7eebe1c449) by @sonofmagic
- 📦 **Dependencies**
  → `@weapp-vite/ast@6.10.0`, `wevu@6.10.0`

## 6.9.1

### Patch Changes

- 🐛 **修复 `packages-runtime/web` 与仓库级构建中的声明打包 warning，减少 `pnpm build` 时的噪音日志，并为包含 Vue SFC 的 e2e 工程补齐 `wevu` 依赖声明，避免构建阶段出现误报警告。** [`2a6d379`](https://github.com/weapp-vite/weapp-vite/commit/2a6d3790d88224f17a26bfe1e0bc28532d0c6380) by @sonofmagic

- 🐛 **优化 `weapp-vite`、`@weapp-vite/mcp`、`@weapp-vite/web`、`@wevu/api` 与 `@weapp-core/schematics` 的构建产物体积与依赖边界：将可复用的 Node 侧运行时依赖改为走 `dependencies`，把 MCP SDK 相关实现和 transport 启动逻辑集中收敛到 `@weapp-vite/mcp`，让 `weapp-vite` 通过包内桥接复用 MCP 能力，同时继续抽取共享 chunk、移除重复声明产物，减少发布包中不必要的内联与重复代码。** [`43a68e2`](https://github.com/weapp-vite/weapp-vite/commit/43a68e28e7ffcc9c6e40fa033d2f346452157140) by @sonofmagic
- 📦 Updated 8 dependencies [`2a6d379`](https://github.com/weapp-vite/weapp-vite/commit/2a6d3790d88224f17a26bfe1e0bc28532d0c6380)
  <details><summary>Details</summary>

  `@weapp-core/init@6.0.3`, `@weapp-vite/web@1.3.5`, `@weapp-core/schematics@6.0.4`, `@weapp-vite/mcp@1.1.1`, `@wevu/api@0.2.2`, `@weapp-vite/volar@2.0.7`, `wevu@6.9.1`, `@weapp-vite/ast@6.9.1`

  </details>

## 6.9.0

### Minor Changes

- ✨ **为 `weapp-vite` 与 `@wevu/compiler` 新增统一的 AST 抽象层，默认继续使用 Babel，并允许在多条纯分析链路中通过配置切换到 Oxc。此次调整同时把组件 props 提取、`usingComponents` 推导、JSX 自动组件分析、`setData.pick` 模板 key 收集、re-export 解析、页面特性分析与部分 emit 阶段快判等能力逐步下沉到可复用的 `ast/operations`，并补充高层配置透传测试，确保 `weapp.ast.engine = 'oxc'` 能从真实插件入口传到对应分析逻辑。** [`3836235`](https://github.com/weapp-vite/weapp-vite/commit/3836235d8784ce0e5e1bd4c920f33a82d4c28844) by @sonofmagic

### Patch Changes

- 🐛 **将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8) by @sonofmagic

- 🐛 **新增 `@weapp-vite/ast` 共享 AST 分析包，统一封装 Babel/Oxc 解析能力以及平台 API、require、`<script setup>` 导入分析等通用操作，并让 `weapp-vite` 与 `@wevu/compiler` 复用这套内核，降低后续编译分析工具的维护分叉成本。** [`7bc7ecc`](https://github.com/weapp-vite/weapp-vite/commit/7bc7ecca2aef913b0751d18f9c0f586bd582dc01) by @sonofmagic

- 🐛 **修复 Windows 环境下 HMR 对侧车文件 `rename` 保存模式的识别问题。现在对于模板、样式、页面配置等文件的原子重命名保存以及连续快速修改，会在短暂 settle 后按已知文件状态正确判定为更新或删除，避免热更新丢失；同时补充了对应的 rename-save 与连续修改 CI 用例。** [#336](https://github.com/weapp-vite/weapp-vite/pull/336) by @sonofmagic

- 🐛 **修复 npm 依赖构建在 `exports.import`、`module` 与 `main` 并存时错误回退到 CommonJS 入口的问题。现在会优先选择 ESM 入口，避免把已经转译成 `_defineProperty` helper 的 CJS 产物错误带入小程序构建结果。** [#336](https://github.com/weapp-vite/weapp-vite/pull/336) by @sonofmagic
- 📦 Updated 10 dependencies [`3021847`](https://github.com/weapp-vite/weapp-vite/commit/302184760fc7680d7f57ec3ecd50664311652808)
  <details><summary>Details</summary>

  `@weapp-vite/ast@6.9.0`, `@weapp-core/schematics@6.0.3`, `@weapp-core/shared@3.0.2`, `@weapp-core/logger@3.1.1`, `@weapp-core/init@6.0.2`, `rolldown-require@2.0.8`, `weapp-ide-cli@5.1.1`, `@weapp-vite/web@1.3.4`, `@weapp-vite/volar@2.0.6`, `wevu@6.9.0`

  </details>

## 6.8.0

### Patch Changes

- 🐛 **修复 `autoRoutes` 在生产构建中的两个问题：普通 `build` 模式下不再错误注册 watch 目标，避免构建结束后进程无法退出；同时修复 `app.vue` 中通过 `defineAppJson` 引用 `weapp-vite/auto-routes` 时的递归解析问题，避免包含自动路由的项目在构建阶段卡死。** [`2ed7d3f`](https://github.com/weapp-vite/weapp-vite/commit/2ed7d3f01ac4fc6096351013a02e5f0d65cb8630) by @sonofmagic

- 🐛 **修复 `weapp.autoImportComponents: true` 在含有 `wevu` 依赖的项目里未自动扫描 `src/components/**/\*.vue`的问题。现在 wevu 项目会默认补上主包和分包下的 Vue SFC 组件扫描规则，生成的`auto-import-components.json`、`typed-components.d.ts`与`components.d.ts`能正确包含这些组件，而`typed-router.d.ts` 仍只负责页面路由类型。** [`934fb62`](https://github.com/weapp-vite/weapp-vite/commit/934fb62102dc39a7b9511426719db9bb07f71476) by @sonofmagic

- 🐛 **修复 `auto-routes` 在 dev watch 模式下的 sidecar watcher 启动时机，避免仅在虚拟模块加载后才开始监听，导致使用 `defineAppJson` 或运行时代码引用 auto-routes 时新增页面文件无法触发 typed-router、`app.json` 和 `app.js` 的 HMR 更新。** [`5433b5a`](https://github.com/weapp-vite/weapp-vite/commit/5433b5a8412d2c10f4ad4b148c08a2f0a23b0c2c) by @sonofmagic

- 🐛 **扩展 `weapp.autoRoutes.persistentCache` 配置，除了 `boolean` 之外也支持传入字符串来自定义自动路由缓存文件位置，并保持默认关闭持久化缓存。** [`ae76f35`](https://github.com/weapp-vite/weapp-vite/commit/ae76f3567dba591d98b804fa55fc1f88797767c6) by @sonofmagic

- 🐛 **将 `weapp` 平台默认 `build.target` 提升到 `es2020`，避免 `?.` / `??` 进入 Rolldown 的可选链降级分支；同时将历史上的 `weapp.es5` / `@swc/core` ES5 降级方案标记为已废弃，并统一将仓库内示例与 e2e 小程序的 `project.config.json` 打开 ES6 支持，配合开发者工具中的「将 JS 编译成 ES5」功能使用。** [`319ed39`](https://github.com/weapp-vite/weapp-vite/commit/319ed39e0312bec9ade9008a65d79877c83108a0) by @sonofmagic

- 🐛 **扩展 `weapp.autoImportComponents` 配置，支持直接写成 `true` 来启用增强默认值：自动使用默认组件扫描规则，并额外开启 `typedComponents`、`vueComponents`，在检测到 `wevu` 依赖时还会自动补上 `vueComponentsModule: 'wevu'`，从而简化 wevu 模板和常见项目配置。** [`f6ea730`](https://github.com/weapp-vite/weapp-vite/commit/f6ea7302ba247682600a532f20d3b094616a9dfc) by @sonofmagic

- 🐛 **将 `typed-router.d.ts`、`typed-components.d.ts` 与 `components.d.ts` 的默认生成位置统一调整到 `weapp.srcRoot` 下，减少模板与示例项目在 `tsconfig` 中对根目录生成文件的额外 `include` 与引用配置。** [`2eaebbb`](https://github.com/weapp-vite/weapp-vite/commit/2eaebbbd6e10ebcc0e29bb0a808cc38d90cf0bbb) by @sonofmagic

- 🐛 **修复 `autoRoutes` 对显式分包根目录的默认扫描回归，补齐源码 CLI 在 Node 22 下的 `createRequire` 绝对路径处理，并将 `tsconfig paths` 解析提升为 `weapp-vite` 默认行为。同步更新 wevu 模板与相关 e2e 断言，确保模板构建、分包输出和自动导入类型产物保持一致。** [`77aac93`](https://github.com/weapp-vite/weapp-vite/commit/77aac9340bcc1505aaecc3cd0ac1d569949e50fb) by @sonofmagic

- 🐛 **补充 `autoRoutes` 对 `app.json`/`defineAppJson` 中分包信息的读取，并同步更新 typed declaration 输出位置、配置类型提示与相关测试用例，确保自动路由、类型生成与配置智能提示行为保持一致。** [`d6e072a`](https://github.com/weapp-vite/weapp-vite/commit/d6e072af004daf9988255015e203f38a632ee089) by @sonofmagic

- 🐛 **修复 `weapp-vite` 在生成 DTS 时对 `@weapp-vite/web` 类型导出的解析问题：为 `@weapp-vite/web` 增加稳定的 `./plugin` 子路径导出，并让配置类型改为从该子路径引用 `WeappWebPluginOptions`，避免构建类型声明时出现缺失导出报错。** [`4b17371`](https://github.com/weapp-vite/weapp-vite/commit/4b17371069a13272d0e227c682a7d6cabaca9627) by @sonofmagic

- 🐛 **扩展 `weapp.autoRoutes.include` 配置，支持使用多个 glob 或正则来自定义页面扫描目录与深度，并允许配合 `weapp.subPackages` 识别非 `pages/**` 结构下的分包页面。** [`1dd8f07`](https://github.com/weapp-vite/weapp-vite/commit/1dd8f07b389af15d3b8536891b1b72bf0516b0d9) by @sonofmagic

- 🐛 **将 `weapp.autoRoutes` 的默认值恢复为关闭，避免项目在未显式声明时自动启用路由扫描；同时保留 `true` 和对象配置两种开启方式，方便在需要时再按需启用并细化控制。** [`d6ad5e1`](https://github.com/weapp-vite/weapp-vite/commit/d6ad5e1601161fd721e26730ef69e6bfe254f1f4) by @sonofmagic

- 🐛 **修正自动路由默认扫描规则，不再把任意 `**/pages/**`目录视为页面目录，而是只默认扫描主包`pages/**`与已声明分包 root 下的`pages/**`，避免误匹配 `components/pages/**` 等非页面目录。** [`db9befb`](https://github.com/weapp-vite/weapp-vite/commit/db9befbe8865c2583f39c26449636c8cbe010749) by @sonofmagic

- 🐛 **优化 `weapp.tsconfigPaths` 在 Vite 8 下的默认行为：自动探测或显式传入 `true` 时，改为优先启用原生 `resolve.tsconfigPaths`，不再默认注入 `vite-tsconfig-paths` 插件，从而避免构建时出现对应的提示信息。仅当传入对象形式的高级选项时，才继续回退到 `vite-tsconfig-paths` 以兼容多 `tsconfig`、`exclude` 等定制能力。** [`8d008fb`](https://github.com/weapp-vite/weapp-vite/commit/8d008fb07c25b638c03659517f3efc5a9efacb47) by @sonofmagic

- 🐛 **扩展 `weapp.autoRoutes` 配置，除了继续支持 `boolean` 快速开关外，也支持传入对象进行细粒度控制，可分别配置 `enabled`、`typedRouter`、`persistentCache` 和 `watch`，以便按项目需要调整自动路由的类型输出、持久缓存与开发期监听行为。** [`25cfee0`](https://github.com/weapp-vite/weapp-vite/commit/25cfee0384a1049d4cfb236deed90446199510e6) by @sonofmagic

- 🐛 **将 `weapp.autoRoutes.persistentCache` 的默认值调整为关闭。显式开启 `autoRoutes: true` 或对象配置后，不再默认生成 `.weapp-vite/auto-routes.cache.json`；只有在明确设置 `persistentCache: true` 时才会写入持久化缓存文件，减少仓库和示例应用中的本地状态产物。** [`871fba6`](https://github.com/weapp-vite/weapp-vite/commit/871fba60c48df171bb597294abd65ab58af6b3c8) by @sonofmagic

- 🐛 **默认开启 `weapp.autoRoutes`，并同步优化自动路由的初始化与增量扫描性能：仅在真正加载自动路由模块时才触发扫描与监听，优先遍历 `pages` 目录收集候选页面，同时增加基于文件时间戳的持久化缓存，减少冷启动和无变更场景下的重复全量扫描开销。** [`5c90833`](https://github.com/weapp-vite/weapp-vite/commit/5c90833970fe25c03efa254df31afa62b48e73d9) by @sonofmagic
- 📦 **Dependencies** [`319ed39`](https://github.com/weapp-vite/weapp-vite/commit/319ed39e0312bec9ade9008a65d79877c83108a0)
  → `wevu@6.8.0`, `@wevu/api@0.2.1`, `@weapp-vite/web@1.3.3`

## 6.7.7

### Patch Changes

- 🐛 **将 `rolldown-require` 的 `rolldown` peer 依赖最低版本提升到 `1.0.0-rc.9`，并为 `weapp-vite` 增加安装时的真实 rolldown 版本检查与运行时版本判断修复，避免工作区继续解析旧的 `1.0.0-rc.3`，同时同步 `create-weapp-vite` 的模板依赖目录版本。** [`88b2d31`](https://github.com/weapp-vite/weapp-vite/commit/88b2d316fe1238ea928abf7d63d0cb63ae29e1e8) by @sonofmagic

- 🐛 **为 `weapp-vite build` 增加主包与分包体积报告，并支持在包体积超过默认 2 MB 阈值时输出告警，便于在构建结束后直接发现包体积风险。** [`96f8e8e`](https://github.com/weapp-vite/weapp-vite/commit/96f8e8e0976eb6546025ad16162dccdbccd0e50a) by @sonofmagic
- 📦 **Dependencies** [`88b2d31`](https://github.com/weapp-vite/weapp-vite/commit/88b2d316fe1238ea928abf7d63d0cb63ae29e1e8)
  → `rolldown-require@2.0.7`, `@weapp-vite/web@1.3.2`, `wevu@6.7.7`

## 6.7.6

### Patch Changes

- 🐛 **修复分包 npm 依赖配置在构建阶段污染 `app.json` 的问题。现在 `weapp.npm.subPackages.<root>.dependencies` 与分包 `inlineConfig` 只会保留在内部构建元数据里，不会再被写回最终产物的 `subPackages` / `subpackages` 节点，从而避免生成包含无效字段的 `app.json`；同时补充单测与构建回归断言，继续覆盖 issue #327 相关的分包 npm 输出场景。** [`f141121`](https://github.com/weapp-vite/weapp-vite/commit/f141121d63b9c02172f551ffcfb5ca6e55ce7d80) by @sonofmagic
- 📦 **Dependencies** [`f9d685f`](https://github.com/weapp-vite/weapp-vite/commit/f9d685f58a6747b39e18da98a20de46e07e04f25)
  → `@weapp-vite/volar@2.0.5`, `wevu@6.7.6`

## 6.7.5

### Patch Changes

- 🐛 **修复自动路由 HMR 监听：新增 chokidar 文件监听补偿 Rolldown watcher 不触发新建文件的 watchChange 事件，同时在 `updateCandidateFromFile` 中对 `create` 和 `delete` 事件触发全量重扫，确保路由文件增删后 typed-router 和 app.json 能正确同步更新。** [`b127b5e`](https://github.com/weapp-vite/weapp-vite/commit/b127b5e0e54f223f6e019ece85c99a09e6862cab) by @sonofmagic

- 🐛 **修复 issue #327：补齐 `weapp.npm.mainPackage.dependencies` 与 `weapp.npm.subPackages.<root>.dependencies` 在分包场景下的依赖分配能力。现在可以显式让主包不输出 `miniprogram_npm`，再按分包根目录分别声明应落入各自分包的 npm 依赖，避免依赖串包或主包残留产物；同时补上主包禁用 npm 输出时的缓存兜底逻辑，即使缓存标记未失效但缓存目录已经不存在，也会自动重新构建分包依赖，避免构建阶段因为缺失缓存目录而直接报错。此次改动同步补充了对应单测与 `github-issues` e2e 回归用例。** [#329](https://github.com/weapp-vite/weapp-vite/pull/329) by @sonofmagic

- 🐛 **为 `weapp-vite` 的 npm 构建新增更直观的依赖范围配置：现在可以通过 `weapp.npm.mainPackage.dependencies` 明确控制主包 `miniprogram_npm` 的输出范围，再通过 `weapp.npm.subPackages.<root>.dependencies` 显式声明各分包自己的 npm 依赖集合，让主包和分包的 npm 构建目标一眼可见，也为后续扩展主包 npm 自定义配置预留出清晰结构。此次改动同时补齐了依赖范围变更时的缓存失效与输出目录清理，避免旧的主包或分包 `miniprogram_npm` 残留；普通分包的本地 npm 输出也不再依赖额外实验开关，只要声明 `weapp.npm.subPackages.<root>.dependencies`，就会生成对应分包的 `miniprogram_npm`，并把分包内的 JS `require` 与 JSON `usingComponents` 路径本地化到该分包目录。** [#329](https://github.com/weapp-vite/weapp-vite/pull/329) by @sonofmagic

- 🐛 **升级 `weapp-vite` 的构建链路依赖版本，包含 `rolldown`、`oxc-parser`、`@oxc-project/types` 与 `cac`，并同步更新 `create-weapp-vite` 模板 catalog 中的 `vite`、`vue`、`@vue/compiler-core`、`@types/node` 等依赖版本，使脚手架生成项目与当前工具链版本保持一致。** [`46c34e3`](https://github.com/weapp-vite/weapp-vite/commit/46c34e3ef3ff70f4162601b63825395d662cfec1) by @sonofmagic

- 🐛 **为 weapp-vite 创建的 Vite 实例注入 `config.weappVite` 宿主元信息，并提供配套的检测 helper。这样用户自定义的 Vite 插件可以在 `config` 与 `configResolved` 阶段可靠判断自己当前是运行在 weapp-vite 中，还是普通 Vite 中，同时还能区分 `miniprogram` 与 `web` 两种 weapp-vite 运行面。** [`ae7fb25`](https://github.com/weapp-vite/weapp-vite/commit/ae7fb25d0a557bbb15653ffff684f580c6a6feb4) by @sonofmagic
- 📦 **Dependencies** [`7dda40a`](https://github.com/weapp-vite/weapp-vite/commit/7dda40a4f4a9f0f5e76cfdd3a81bf2fbd5c3a163)
  → `wevu@6.7.5`

## 6.7.4

### Patch Changes

- 🐛 **整合仅影响 weapp-vite 与 create-weapp-vite 的 changeset。** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e) by @sonofmagic

  ## 变更摘要
  1. **late-clocks-promise.md**：新增 `weapp.wevu.autoSetDataPick` 编译期开关。开启后会从模板表达式自动提取渲染相关顶层 key，并注入到页面/组件的 `setData.pick`，用于减少非渲染字段参与快照与下发；同时兼容已有 `setData.pick` 配置并进行去重合并。
  2. **six-rivers-cheer.md**：为 weapp-vite 新增 `onPageScroll` 静态性能诊断：在页面脚本编译阶段自动扫描 `onPageScroll` 回调，针对空回调、`setData` 调用以及 `wx.*Sync` 同步 API 调用输出构建期告警，帮助在开发阶段提前发现滚动卡顿风险。 诊断同时接入 wevu 页面特性注入链路与 Vue/JSX transform 链路，并补充对应单测覆盖，确保告警行为稳定且不影响既有注入逻辑。

- 🐛 **整合同时影响 weapp-vite、wevu 与 create-weapp-vite 的 changeset。** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e) by @sonofmagic

  ## 变更摘要
  1. **eager-crews-cough.md**：为 `weapp-vite` 新增 `weapp.wevu.preset: 'performance'` 预设，并将 `autoSetDataPick` 与预设联动（可被显式布尔配置覆盖）；同时为 `wevu` 增加 `setData.highFrequencyWarning` 开发态高频调用告警能力（默认关闭，可按阈值开启与调优）。此外同步补充 website 配置与 runtime 文档，明确预设内容、覆盖规则与 FAQ。
  2. **odd-horns-repeat.md**：为 `wevu` 新增 `useUpdatePerformanceListener()` 组合式 API：可在 `setup()` 中注册 `setUpdatePerformanceListener`，并在 `onUnload/onDetached` 自动清理，返回 `stop` 句柄支持手动停止；同时补齐 `SetupContextNativeInstance` 的对应类型桥接与导出覆盖测试。 同时增强 `weapp-vite` 的 `weapp.wevu.preset: 'performance'` 默认值：在保留 `patch + suspendWhenHidden + highFrequencyWarning` 的基础上，默认追加 `diagnostics: 'fallback'`，便于开发态更快定位 `setData` 回退与体积问题，并补齐相关单测与配置注释。
  3. **quiet-donuts-wave.md**：修复 `wevu` 的 `props -> properties` 归一化能力缺口：新增对 `optionalTypes` 与 `observer` 的透传，数组类型会规范化为 `type + optionalTypes`，并在缺失 `type` 时回填 `null` 以贴近小程序 `properties` 语义。同时修复 `weapp-vite` 自动组件元数据提取逻辑，`json.properties` 现在会合并 `type` 与 `optionalTypes` 生成联合类型，避免 typed-components/html custom data 类型信息偏窄。
  4. **rich-foxes-walk.md**：为 `wevu` 新增 `useRouter()` 与 `usePageRouter()`：在 `setup()` 中可直接获取小程序 Router，并优先保持 `this.router / this.pageRouter` 的原生语义。针对基础库低于 `2.16.1` 或实例路由器缺失场景，运行时会自动回退到全局 `wx` 同名路由方法；同时补齐 `SetupContextNativeInstance` 的 `router/pageRouter` 类型声明，并引入可声明合并的 `WevuTypedRouterRouteMap`，支持按项目路由清单收窄 `url` 类型。 `weapp-vite` 的自动路由产物 `typed-router.d.ts` 现已自动注入对 `wevu` 的模块增强：当启用 `autoRoutes` 后，`useRouter()/usePageRouter()` 的 `navigateTo/redirectTo/reLaunch/switchTab` 会继承 `AutoRoutesEntries` 联合类型（并保留相对路径写法），降低路由字符串拼写错误风险。同时 `weapp-vite/auto-routes` 新增 `wxRouter` 导出，提供一组代理到全局路由 API 的类型化方法，便于在业务代码中直接获得路由参数约束。

- 🐛 **修复 `autoRoutes` 生成路由类型在 `defineAppJson` 场景下的 `subPackages` 类型兼容性问题：为 `AutoRoutesSubPackage` 增加字符串索引签名，并在 `typed-router.d.ts` 生成的分包对象字面量中同步注入 `[k: string]: unknown`。修复后，`routes.subPackages` 可直接用于 `defineAppJson({ subPackages })`，避免 `vue-tsc` 报告 TS2769 类型不匹配错误。** [#325](https://github.com/weapp-vite/weapp-vite/pull/325) by @sonofmagic

- 🐛 **修复 `autoRoutes` 生成的 `typed-router.d.ts` 在声明 `wevu/router` 时未先导入原模块的问题。此前 TypeScript 可能将其当作独立模块声明，导致 `useRouter` 等已导出成员在编辑器中被错误标记为不存在。现在生成文件会先 `import 'wevu/router'` 再做模块增强，确保路由类型扩展与原有导出可同时生效，并补充相应测试防回归。** [`0c5fec9`](https://github.com/weapp-vite/weapp-vite/commit/0c5fec972e3f659a19600610b35f31c5a9207f57) by @sonofmagic
- 📦 **Dependencies** [`3449921`](https://github.com/weapp-vite/weapp-vite/commit/3449921ee8d3ff327ccbbad114ad1984a858781e)
  → `@wevu/api@0.2.0`, `wevu@6.7.4`, `@weapp-vite/web@1.3.1`

## 6.7.3

### Patch Changes

- 🐛 **进一步优化小程序动态导入构建链路：在预处理阶段同时移除 `vite:build-import-analysis` 与 `native:import-analysis-build`，避免在小程序产物中注入 `__vitePreload` 包装逻辑。动态导入将直接输出为小程序可用的 `Promise.resolve().then(() => require(...))` 形式，减少运行时代码并规避浏览器预加载分支的潜在兼容性噪音。** [`98906c7`](https://github.com/weapp-vite/weapp-vite/commit/98906c7d418e4ae04173ad33e40bab07dac00ccb) by @sonofmagic

- 🐛 **修复小程序构建中动态导入预加载辅助代码导致的 `__VITE_IS_MODERN__ is not defined` 问题。现在在小程序配置合并阶段默认关闭 `build.modulePreload`，避免注入不适用于小程序运行时的预加载逻辑；若用户显式配置 `build.modulePreload`，仍保持用户配置优先。** [`2201c68`](https://github.com/weapp-vite/weapp-vite/commit/2201c689d263579bda25f5baefb2bfa25ed6c4cf) by @sonofmagic
- 📦 **Dependencies**
  → `wevu@6.7.3`

## 6.7.2

### Patch Changes

- 🐛 **修复 duplicate 分包共享 chunk 在 importer 识别阶段误判自身为主包引用的问题，避免错误回退到主包后出现 `common.js` 自引用与 `rolldown-runtime.js` 相对路径异常。同时补充 issue #317 的单元与 e2e 回归覆盖，确保双分包共享模块产物稳定落在各自分包目录。** [`4dde4fd`](https://github.com/weapp-vite/weapp-vite/commit/4dde4fdfff0a6416e07fef81348bbc30187500a2) by @sonofmagic

- 🐛 **为 `weapp.mcp.autoStart` 的自动启动日志补充了接近 Vite 风格的地址输出（`➜ URL`），便于在终端快速识别 MCP 服务入口；并将自动启动触发范围收敛到开发命令（`dev/serve` 与默认开发启动）。同时新增 `apps/mcp-demo` 的自动启动配置，使执行 `pnpm dev` 时可自动拉起 `http://127.0.0.1:3188/mcp`。** [`25e9cc2`](https://github.com/weapp-vite/weapp-vite/commit/25e9cc2b2c865e9a39f7515a24d8015abf5bba44) by @sonofmagic
- 📦 **Dependencies**
  → `wevu@6.7.2`

## 6.7.1

### Patch Changes

- 🐛 **本次变更主要修复了三类一致性与可维护性问题：一是 `wevu` 构建默认产物此前仅压缩且缺少 sourcemap，不利于排查线上问题，现调整为输出 sourcemap 以提升调试可观测性；二是 `weapp-vite` 侧 `oxc-parser` 与类型依赖升级到同一版本，降低 AST 解析与类型不匹配带来的潜在风险；三是同步更新 workspace catalog 与 `create-weapp-vite` 生成 catalog，避免模板初始化时依赖版本与仓库主线不一致。** [`17f30b1`](https://github.com/weapp-vite/weapp-vite/commit/17f30b169337d5bc015a46841807f964cc1e140f) by @sonofmagic

- 🐛 **修复 `weapp-vite` 包内多处 TypeScript 类型问题，并收敛包级 `tsc` 检查范围到发布源码：** [`3740446`](https://github.com/weapp-vite/weapp-vite/commit/3740446500162e10495ed087e8c6f5c89bbd0f85) by @sonofmagic
  - 修正 npm 打包器中 Babel 导出节点与支付宝 npm 模式的类型不匹配；
  - 修正路由监听事件分支、lib 入口类型回退、作用域插槽平台配置空值判断与共享构建输出回调参数类型；
  - 修正自动导入产物同步时 `outputPath` 缩窄后的可空类型告警；
  - `packages/weapp-vite/tsconfig.json` 排除 `*.test.ts` 与 `test/`，避免测试夹具类型噪音干扰包级 typecheck。

- 🐛 **调整 npm 构建默认压缩策略：`weapp-vite` 的 npm 打包产物默认不再压缩（`build.minify` 默认值从 `true` 改为 `false`），以便在小程序端更容易排查依赖代码问题。若有体积优化需求，仍可通过 `weapp.npm.buildOptions` 显式覆盖为 `minify: true`。** [`e621560`](https://github.com/weapp-vite/weapp-vite/commit/e6215606f17d67a8f6f524c963d35531f184d94e) by @sonofmagic

- 🐛 **修复 npm 重打包场景 sourcemap 错位问题：对于会被 `weapp-vite` 二次打包的普通依赖，不再复制上游入口自带的 sourcemap 到 `miniprogram_npm`，避免出现 `index.js` 与 `index.js.map` 映射不一致。若需要调试 map，应通过 `weapp.npm.buildOptions` 为最终产物显式开启 `build.sourcemap` 生成。** [`e065c65`](https://github.com/weapp-vite/weapp-vite/commit/e065c6579defdb89a81231b97847d2f09c02d0e1) by @sonofmagic
- 📦 **Dependencies** [`8b76120`](https://github.com/weapp-vite/weapp-vite/commit/8b761206940c4e99c1f65b3663898660f448714d)
  → `wevu@6.7.1`

## 6.7.0

### Minor Changes

- ✨ **在 `weapp-vite` 中集成 `@weapp-vite/mcp`：新增 `weapp-vite mcp` CLI 命令用于直接启动 MCP stdio 服务，新增 `weapp-vite/mcp` 程序化导出入口，并补充详细的 MCP 使用文档（启动方式、客户端接入、工具与资源说明、安全边界与排障）。** [`2530a6f`](https://github.com/weapp-vite/weapp-vite/commit/2530a6fb262d106cdfefdd9a36062e9030400f05) by @sonofmagic

- ✨ **为 `weapp-vite` 增加 MCP 自动启动能力并调整默认策略：新增 `weapp.mcp` 配置，默认不自动拉起 MCP 服务（可通过 `autoStart: true` 开启）；同时扩展 `weapp-vite mcp` 命令支持 `streamable-http` 启动参数（host/port/endpoint）。** [`d8050a9`](https://github.com/weapp-vite/weapp-vite/commit/d8050a967743cfa70b7c818ac6fb726a86697282) by @sonofmagic

### Patch Changes

- 🐛 **修复 `weapp-vite/auto-routes` 在页面运行时代码中被别名解析到源码入口时可能触发 Rolldown 崩溃的问题。现在无论通过包名还是别名路径导入，都会统一走 auto-routes 虚拟模块；同时补充相关单测与 `auto-routes-define-app-json` 运行时 e2e 覆盖，确保首页导航链接可稳定渲染。** [`4912425`](https://github.com/weapp-vite/weapp-vite/commit/491242587cd1c15c9fba68eb2b3ec6bcb34b6269) by @sonofmagic
- 📦 **Dependencies** [`a7768a3`](https://github.com/weapp-vite/weapp-vite/commit/a7768a31befe085638950e1dd54bb9da85f2ee50)
  → `@weapp-vite/mcp@1.1.0`, `wevu@6.7.0`

## 6.6.16

### Patch Changes

- 🐛 **修复 auto-routes 在开发模式下对新增页面与目录变更的热更新同步问题：补齐 pages 相关路径变更的兜底重扫逻辑，并修正全量重扫时的候选扫描范围，避免 typed-router 与构建产物在增删改场景下出现漏更新。同步新增并加固 auto-routes HMR 的 e2e 覆盖，验证新增、删除、修改、重建等核心路径。** [`f0dda62`](https://github.com/weapp-vite/weapp-vite/commit/f0dda629ebd785aba358483bae7eeab228102206) by @sonofmagic

- 🐛 **修复 `app.vue` 中 `<script setup>` 的 `defineOptions` 不能引用局部变量或导入变量的问题，并统一增强宏配置提取体验：** [`a1ae4a6`](https://github.com/weapp-vite/weapp-vite/commit/a1ae4a6abe0374644a32d0078085bd662faae641) by @sonofmagic
  - 新增 `defineOptions` 参数静态内联能力，支持引用本地声明与跨文件导入（包含 `weapp-vite/auto-routes` 顶部静态引入场景）。
  - `auto-routes-define-app-json` 示例改为单 `script setup`，同一份 `routes` 同时用于 `defineAppJson` 与运行时 `globalData`。
  - 补充单元测试与 e2e 测试，覆盖 JSON 宏和 `defineOptions` 对局部/导入变量的兼容性与热更新回归。
- 📦 **Dependencies**
  → `wevu@6.6.16`

## 6.6.15

### Patch Changes

- 🐛 **增强 `weapp-vite` CLI 对 `weapp-ide-cli` 的能力复用：现在可直接在 `weapp-vite` 中调用 `preview`、`upload`、`config`、automator 等命令，并新增 `weapp-vite ide <args...>` 命名空间透传入口，方便在脚本与 CI 中统一命令入口。** [`648e2ba`](https://github.com/weapp-vite/weapp-vite/commit/648e2ba893373dc04ac45cc627ca260cfaa9d9a6) by @sonofmagic

- 🐛 **在 `weapp-ide-cli` 中整理并导出了完整命令目录（官方 CLI、automator、config、minidev），新增 `isWeappIdeTopLevelCommand` 判断函数。`weapp-vite` 的 IDE 透传逻辑改为基于该目录判断，仅在命令未被 `weapp-vite` 自身注册且命中 `weapp-ide-cli` 命令目录时才透传执行。** [`83a3e18`](https://github.com/weapp-vite/weapp-vite/commit/83a3e18c07bf9780e1b012a106f217af51cd2123) by @sonofmagic
- 📦 **Dependencies** [`02dc3e8`](https://github.com/weapp-vite/weapp-vite/commit/02dc3e84674222e6769b975a96c8943dc33d4b52)
  → `weapp-ide-cli@5.1.0`, `wevu@6.6.15`

## 6.6.14

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.6.14`

## 6.6.13

### Patch Changes

- 🐛 **upgrade "vite": "8.0.0-beta.16" and "rolldown": "1.0.0-rc.6"** [`dfb47d7`](https://github.com/weapp-vite/weapp-vite/commit/dfb47d7c8b5699fe25c066803890e6611d8e6d68) by @sonofmagic
- 📦 **Dependencies** [`6742994`](https://github.com/weapp-vite/weapp-vite/commit/6742994ffd0a3c522d1e527e0d90e4863a2d853c)
  → `wevu@6.6.13`

## 6.6.12

### Patch Changes

- 📦 **Dependencies** [`788a4e0`](https://github.com/weapp-vite/weapp-vite/commit/788a4e080a95524207754bd29316a1504c26b195)
  → `wevu@6.6.12`

## 6.6.11

### Patch Changes

- 📦 **Dependencies** [`75121bd`](https://github.com/weapp-vite/weapp-vite/commit/75121bd3642c5b916d7f7e45094f365c7a834509)
  → `wevu@6.6.11`

## 6.6.10

### Patch Changes

- 🐛 **修复 `wevu` 运行时的多平台条件裁剪链路：统一通过 `import.meta.env.PLATFORM` 选择小程序全局对象（`tt/my/wx`），并将相关 runtime 入口（组件定义、App 注册、hooks、template refs、页面生命周期）改为走平台适配层，避免非目标平台分支进入最终产物。同时补充 `weapp-vite` npm 构建 define 透传与 e2e 覆盖，分别验证 `wevu` 位于 `devDependencies` 与 `dependencies` 时的构建行为与平台输出。** [`b248a4a`](https://github.com/weapp-vite/weapp-vite/commit/b248a4a6e04dc12dd190fa1b29b615191ed3be87) by @sonofmagic
- 📦 **Dependencies** [`b248a4a`](https://github.com/weapp-vite/weapp-vite/commit/b248a4a6e04dc12dd190fa1b29b615191ed3be87)
  → `wevu@6.6.10`

## 6.6.9

### Patch Changes

- 📦 **Dependencies**
  → `wevu@6.6.9`

## 6.6.8

### Patch Changes

- 🐛 **修复 `weapp-vite` 在 Vue SFC 模板中引用外部 `wxs` 文件时的产物缺失问题：调整 `wxs` 资源收集与发射时机，补充对 `generateBundle` 阶段 `wxml` 资产的依赖扫描，并兼容 `wxs` / `sjs` / `import-sjs` 标签，确保 `<wxs ... />` 与 `<wxs ...></wxs>` 两种写法均可自动输出到 `dist`。** [`8af1a5d`](https://github.com/weapp-vite/weapp-vite/commit/8af1a5defdb8fe0f662c0d203032867d4500eee0) by @sonofmagic
  - 同时移除 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 中的 `copy-wxs-sidecar` 构建兜底插件，改为完全依赖 `weapp-vite` 核心链路自动处理 `wxml` 引入的 `wxs` 文件，避免模板侧重复拷贝逻辑。
- 📦 **Dependencies** [`94a3deb`](https://github.com/weapp-vite/weapp-vite/commit/94a3deb91ab05006a54d7562b6262f0e4f7f67de)
  → `wevu@6.6.8`

## 6.6.7

### Patch Changes

- 🐛 **修复了 dev 模式下新增 SFC 组件可能无法被自动引入及时识别的问题，并补充自动引入与热更新的多平台集成测试覆盖（weapp、alipay、tt），确保页面首次引用新增组件时 `usingComponents` 能稳定更新。与此同时在 CI 中新增对应的平台矩阵任务，持续防止该类回归。** [`69bc2a2`](https://github.com/weapp-vite/weapp-vite/commit/69bc2a20a13a1752e245938d32c8cdd7040e2dbc) by @sonofmagic

- 🐛 **修复分包之间共享 chunk 的跨包引用问题：当分包 `common.js` 被其他分包引用时，构建阶段会在目标分包生成本地副本并重写 `rolldown-runtime.js` 与其他静态依赖路径，避免微信开发者工具运行时报出 `module is not defined`。** [`972cc30`](https://github.com/weapp-vite/weapp-vite/commit/972cc3006f35383d61e0df444c4890495a7fcef8) by @sonofmagic
  - 同时补充 `tdesign-miniprogram-starter-retail` 全页面可访问的 IDE E2E 用例，并增强分类侧栏组件在子组件解绑场景下的方法调用容错，确保默认配置下页面访问更稳定。

- 🐛 **修复分包页面在微信开发者工具中可能出现 `rolldown-runtime.js` 跨包引用失败的问题。构建时会为相关分包生成本地 runtime 并重写引用路径，避免出现“module is not defined”类报错，提升分包项目在真机与开发者工具中的运行稳定性。** [`d945975`](https://github.com/weapp-vite/weapp-vite/commit/d945975553c443054a2e5fae8881d7337705abd8) by @sonofmagic

- 🐛 **upgrade vite and rolldown** [`8c74c6f`](https://github.com/weapp-vite/weapp-vite/commit/8c74c6f44e0f9b22c89f7b067a1c6a37172b94e2) by @sonofmagic
- 📦 **Dependencies**
  → `wevu@6.6.7`

## 6.6.6

### Patch Changes

- 🐛 **修复 wevu 与 weapp-vite 在 `v-for` 场景下内联事件对象参数的响应式丢失问题：`@tap="updateQuantity(item, -1)"` 传入的 `item` 会恢复为源列表引用，方法内直接修改对象字段可正确触发视图更新。同时补齐 patch 模式下对 ref/reactive 子根变更的调度与回退映射，避免事件逻辑执行但 UI 不刷新的情况。** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903) by @sonofmagic
- 📦 **Dependencies** [`cfcb6b9`](https://github.com/weapp-vite/weapp-vite/commit/cfcb6b9e6a869f038033a2240e2d9a073fc0a903)
  → `wevu@6.6.6`

## 6.6.5

### Patch Changes

- 🐛 **修复 `auto-routes` 生成类型与 `defineAppJson` 的兼容性问题：`AutoRoutesPages`、`AutoRoutesEntries`、`AutoRoutesSubPackages` 改为非 `readonly` tuple，同时保持路由字面量推断精度，确保 `defineAppJson({ pages: routes.pages })` 在 TypeScript 下无需 `as string[]` 即可通过类型检查。** [`093a939`](https://github.com/weapp-vite/weapp-vite/commit/093a93932ff4424e30f4a8c4c100ccafba41aa09) by @sonofmagic
  补充对应回归测试：
  - 新增 `auto-routes` d.ts 生成器单元测试，覆盖 tuple 输出与 `readonly` 回归。
  - 新增 `tsd` 用例，覆盖默认导入与具名导入，并校验非法 `pages` 类型报错。
  - 新增 e2e fixture 与构建/类型检查用例，验证 `weapp-vite build`、`vue-tsc --noEmit` 及产物 `app.json` 路由内容。

- 🐛 **修复 issue #297：模板插值与部分指令中的函数调用表达式不再直接下放到 WXML，而是自动回退为 JS 运行时绑定计算，避免 `{{ sayHello() }}` 在小程序中渲染为空。** [`6f72327`](https://github.com/weapp-vite/weapp-vite/commit/6f72327548f3defdaee6ff6fd395a793ccb16a2d) by @sonofmagic
  - 同时补充单元、集成与 e2e 测试，覆盖插值、`v-text`、`v-bind`、`v-if`、`v-for` 等调用表达式场景，确保回归稳定。
- 📦 **Dependencies** [`67d333e`](https://github.com/weapp-vite/weapp-vite/commit/67d333e05fa999e9bc15595b30987859c4f10621)
  → `@weapp-vite/web@1.3.0`, `wevu@6.6.5`

## 6.6.4

### Patch Changes

- 🐛 **chore(依赖)：升级 rolldown 到 1.0.0-rc.4，升级 vite 到 8.0.0-beta.14。** [`5aae454`](https://github.com/weapp-vite/weapp-vite/commit/5aae454c219bbbb5f0ef206f63c9a7d6d42c8248) by @sonofmagic
- 📦 **Dependencies** [`8d2d7f7`](https://github.com/weapp-vite/weapp-vite/commit/8d2d7f7e72d3da5a10fa14e5b66370f739eaf752)
  → `wevu@6.6.4`, `weapp-ide-cli@5.0.4`

## 6.6.3

### Patch Changes

- 🐛 **修复 issue #294：当页面默认导出为 `Object.assign(...)` 形态时，`onShareAppMessage` / `onShareTimeline` 在编译阶段未正确注入页面 `features` 的问题。** [`d84b693`](https://github.com/weapp-vite/weapp-vite/commit/d84b6937e2fd8189070348733f198bf3cc20017a) by @sonofmagic
  本次修复统一了 Vue 脚本重写与页面特性扫描对 `Object.assign` 选项对象的识别逻辑，确保 share hooks 能稳定注入：
  - `enableOnShareAppMessage`
  - `enableOnShareTimeline`

  同时新增对应单元测试，并在 `e2e-apps/github-issues` 中增加 `issue-294` 页面与 e2e 断言，覆盖真实构建产物验证。

- 🐛 **新增 `vue.template.mustacheInterpolation` 配置项，用于统一控制模板 Mustache 输出风格：** [`12e45d5`](https://github.com/weapp-vite/weapp-vite/commit/12e45d5ed487fce4f28d727ed1618250129de5ab) by @sonofmagic
  - `compact`（默认）：输出 `{{expr}}`
  - `spaced`：输出 `{{ expr }}`

  该选项会作用于 Vue 模板编译与 JSX/TSX 模板编译中的主要 Mustache 产物位置（如插值文本、动态属性、`v-if`/`v-else-if`、`v-for`、slot 相关元属性等）。默认行为保持不变。

  同时保留并兼容 `vue.template.objectLiteralBindMode`：
  - `runtime`（默认）：对象字面量 `v-bind` 走运行时中间变量
  - `inline`：对象字面量直接内联输出

  在 `compact + inline` 下，对象字面量会输出为 `{{ { ... } }}`，用于规避 `{{{` 连续花括号在部分小程序编译链路下的兼容性问题。

- 🐛 **新增 `vue.template.objectLiteralBindMode` 配置项，用于控制对象字面量 `v-bind` 的产物模式：** [`dac5c9f`](https://github.com/weapp-vite/weapp-vite/commit/dac5c9fbd8dbc96e40619aab5f3c38287bf57699) by @sonofmagic
  - `runtime`（默认）：保持现有行为，使用运行时中间变量（如 `__wv_bind_0`）
  - `inline`：直接内联对象字面量，并输出为 `{{ { ... } }}`（插值两侧补空格，避免出现 `{{{`）

  这可以兼容旧项目在小程序端对连续三个花括号的编译限制，同时默认行为保持不变。

- 📦 **Dependencies** [`d84b693`](https://github.com/weapp-vite/weapp-vite/commit/d84b6937e2fd8189070348733f198bf3cc20017a)
  → `wevu@6.6.3`

## 6.6.2

### Patch Changes

- 📦 **Dependencies**
  → `wevu@2.1.11`

## 6.6.1

### Patch Changes

- 🐛 **fix class/style runtime stability for dynamic class expressions and scoped-slot v-for cases** [`2be2749`](https://github.com/weapp-vite/weapp-vite/commit/2be27498a498fb1e85c5533cc521eb42bdad2ba8) by @sonofmagic
  - 为 class/style 的 JS 运行时计算增加表达式异常保护，避免在 `v-if` 守卫与列表项暂不可用时中断渲染
  - 修复 scoped slot 虚拟模块在 class 计算代码中缺失 `unref` 导入的问题
  - 补充相关单元测试与 e2e 回归用例，覆盖 `v-for` 动态 class 与 `root.a` 这类场景
- 📦 **Dependencies**
  → `wevu@2.1.10`

## 6.6.0

### Minor Changes

- ✨ **将 Vue 模板 `:class` / `:style` 的默认运行时从 `auto` 调整为 `js`，减少“WXS 模式下表达式级回退到 JS”带来的行为分岔，提升不同表达式形态下的一致性与可预期性。** [`65f9f13`](https://github.com/weapp-vite/weapp-vite/commit/65f9f131549181dcb23ac3f2767970663bd6c3c7) by @sonofmagic
  同时保留 `auto` / `wxs` 可选策略：
  - `auto` 仍会在平台支持 WXS 时优先使用 WXS，否则回退 JS。
  - `wxs` 在平台不支持时仍会回退 JS 并输出告警。

  更新了对应的配置类型注释与文档示例，明确默认值为 `js`。

### Patch Changes

- 📦 **Dependencies**
  → `wevu@2.1.9`

## 6.5.4

### Patch Changes

- 🐛 **fix: weapp-vite open 场景在微信登录失效时增加友好提示与按键重试。** [`0e27865`](https://github.com/weapp-vite/weapp-vite/commit/0e2786529c0b3280d1682a0707d131c2ec65fb23) by @sonofmagic
  - `weapp-vite dev -o` / `weapp-vite open` 调用 IDE 时，命中 `code: 10` 或 `需要重新登录` 会给出明确提示。
  - 支持按 `r` 重试，按 `q`、`Esc` 或 `Ctrl+C` 取消。
  - 补充 `openIde` 与重试辅助函数单元测试，覆盖重试成功、取消和非登录错误分支。

- 🐛 **refactor: 提炼微信 IDE 登录失效重试逻辑，减少跨包重复实现。** [`ff78c39`](https://github.com/weapp-vite/weapp-vite/commit/ff78c394a29766497a7da57f46a2b394fbfc82d6) by @sonofmagic
  - `weapp-ide-cli` 对外导出登录失效识别与按键重试 helper。
  - `weapp-vite` 的 `open/dev -o` 逻辑改为复用 `weapp-ide-cli` helper，不再维护重复副本。
  - 清理 `weapp-vite` 本地重复重试模块，并更新单测 mock 到统一导出入口。

- 🐛 **feat: 统一 CLI 终端染色入口到 logger colors。** [`f7f936f`](https://github.com/weapp-vite/weapp-vite/commit/f7f936f1884cf0e588764132bf7f280d5d22bf41) by @sonofmagic
  - `@weapp-core/logger` 新增 `colors` 导出（基于 `picocolors`），作为统一终端染色能力。
  - 对齐 `packages/*/src/logger.ts` 适配层，统一通过本地 `logger` 入口透传 `colors`。
  - 后续 CLI 代码可统一使用 `from '../logger'`（或 `@weapp-core/logger`）进行染色，避免分散依赖与手写 ANSI。
  - 本次发布包含 `weapp-vite`，同步 bump `create-weapp-vite` 以保持脚手架依赖一致性。

- 🐛 **fix: 支持小程序事件修饰符 `.stop` 并完善修饰符校验与测试矩阵。** [`eef1eec`](https://github.com/weapp-vite/weapp-vite/commit/eef1eec1a5d73feaa8e82a74ebf4b5d7270159aa) by @sonofmagic
  - 模板编译器将 `@tap.stop` 视为阻止冒泡语义，输出 `catchtap`（含捕获组合输出 `capture-catch:tap`）。
  - WXML 扫描链路同步支持 `.stop`，与 `.catch/.capture/.mut` 前缀决策保持一致。
  - ESLint `vue/valid-v-on` 放行 weapp 场景常用修饰符，避免 `@tap.catch/@tap.mut/@tap.capture` 误报。
  - 补充编译与扫描单元测试矩阵，覆盖 `stop/catch/capture/mut` 及与 Vue 常见修饰符组合场景。

- 🐛 **chore: 统一 CLI 中优先级输出风格与终端染色。** [`51735d0`](https://github.com/weapp-vite/weapp-vite/commit/51735d05925951eb9dc99a5f88a555178f845021) by @sonofmagic
  - `weapp-ide-cli`：补齐 `colors` 相关测试 mock，确保配置解析与 `minidev` 安装提示在新增染色后行为稳定。
  - `weapp-vite`：对齐 `openIde` 重试提示日志级别（`error/warn/info`），并统一通过 `logger.colors` 做重点信息高亮。
  - `weapp-vite`：优化运行目标、构建完成、分析结果写入等高频输出，统一命令/路径/URL 的染色展示。
  - 包含 `weapp-vite` 变更，按仓库约定同步 bump `create-weapp-vite`。

- 🐛 **fix: 优化 CLI 高优先级输出一致性与机器可读性。** [`5bc7afb`](https://github.com/weapp-vite/weapp-vite/commit/5bc7afb8ad3a425334f3d348bd86162184bbdfcf) by @sonofmagic
  - `weapp-vite analyze --json` 在 JSON 输出模式下默认静默平台提示，避免污染标准输出。
  - `weapp-vite open` 登录失效重试提示改为复用 `weapp-ide-cli` 的统一格式化 helper。
  - `create-weapp-vite` CLI 错误输出改为统一 logger，并区分“取消创建”和“创建失败”。
- 📦 **Dependencies** [`ff78c39`](https://github.com/weapp-vite/weapp-vite/commit/ff78c394a29766497a7da57f46a2b394fbfc82d6)
  → `weapp-ide-cli@5.0.3`, `@weapp-core/logger@3.1.0`, `wevu@2.1.8`

## 6.5.3

### Patch Changes

- 🐛 **fix(alipay): 兼容 antd-mini 文档的 `antd-mini/es/*` 组件路径。** [`fcb33fb`](https://github.com/weapp-vite/weapp-vite/commit/fcb33fbfaea80fb590427a56e5111b3e67fe7112) by @sonofmagic
  - 支付宝 `node_modules` npm 模式下，miniprogram 包构建时会同步复制包内 `es/` 目录到产物，避免 `usingComponents` 指向 `antd-mini/es/*` 时找不到组件文件。
  - 修复支付宝 npm 缓存命中时的重建判定：当源包存在 `es/` 但缓存产物缺失时，会自动触发重建，避免继续复用旧产物。
  - `alipay-antd-mini-demo` 示例切换为 antd-mini 文档一致写法：`usingComponents` 使用 `antd-mini/es/Button/index`。

- 🐛 **fix: 修复多平台（尤其支付宝）编译兼容与 `wpi` 注入问题。** [`89acadd`](https://github.com/weapp-vite/weapp-vite/commit/89acadd1016f14b1df249a13989ae2791fa4e43e) by @sonofmagic
  - 模板转换增强：支付宝产物支持 `wx:* -> a:*`、`bind/catch` 事件映射到 `on*/catch*`，并将 PascalCase 组件标签与 `usingComponents` key 归一化为 kebab-case。
  - JS 目标兼容增强：支付宝在未显式配置 `build.target` 时默认降级到 `es2015`，避免可选链等语法在开发者工具中报错。
  - `injectWeapi` 注入增强：在显式开启 `replaceWx: true` 时，编译阶段自动把 `wx/my` API 调用重写为统一 `wpi` 访问，且运行时不再依赖 `globalThis`，兼容支付宝环境。
  - 默认行为保持不变：`injectWeapi.replaceWx` 仍默认关闭，需要在项目中显式开启。

- 🐛 **fix: 修复 class/style helper 在微信与支付宝脚本模块语法差异下的兼容回归。** [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6) by @sonofmagic
  - `@wevu/compiler` 的 class/style helper 改为按脚本扩展名分支生成：
    - `.wxs` 保持 `module.exports`、`Array.isArray` 与 `String.fromCharCode` 路径，恢复微信端行为。
    - `.sjs` 继续使用 `export default`，并避免 `Array` / `String.fromCharCode` 等在支付宝 SJS 下受限的标识符。
  - `weapp-vite` 补充对应单测断言，分别覆盖 `wxs` 与 `sjs` helper 输出约束。
  - 在 `e2e-apps/wevu-runtime-e2e` 新增 `pages/class-style/index.vue`，补充 class/style 多形态绑定示例，并同步 `weapp/alipay/tt` e2e 快照，防止后续回归。

- 🐛 **fix: `injectWeapi` 不再生成 `weapp-vite.weapi.d.ts`，并将 `wpi` 全局类型并入 `weapp-vite/client`，避免用户手动修改 `tsconfig` include。** [`685cd70`](https://github.com/weapp-vite/weapp-vite/commit/685cd70a59c05f6054ee61d81b814b7cdc57c48a) by @sonofmagic

- 🐛 **fix: 修复支付宝平台 npm 构建与 scoped slot 兼容问题。** [`2cf1f5c`](https://github.com/weapp-vite/weapp-vite/commit/2cf1f5c73a80c5d2f9c1c22aa396a1c47f599e02) by @sonofmagic
  - 支付宝平台下对小程序 npm 包增加稳定转换：模板后缀/语法映射、ESM 到 CJS 转换、嵌套依赖提升与缓存自修复，避免 `cannot resolve module`、`unknown is outside of the project` 等报错。
  - 支付宝平台下为 `componentGenerics` 自动补齐默认占位组件，并在构建产物中自动发出占位组件文件，修复 `componentGenerics ... 必须配置默认自定义组件`。
  - 优化 scoped slot 子组件 `usingComponents` 收敛逻辑，仅保留模板实际依赖，减少无效引用与平台差异问题。

- 🐛 **feat: 支持支付宝平台 npm 目录策略切换，并默认使用 `node_modules`。** [`28123ac`](https://github.com/weapp-vite/weapp-vite/commit/28123acad176ced6ea6ace113ac0161a2bf49115) by @sonofmagic
  - 新增 `weapp.npm.alipayNpmMode` 配置，支持 `node_modules` 与 `miniprogram_npm` 两种模式。
  - 默认策略切换为 `node_modules`，更贴近支付宝小程序 npm 管理语义。
  - 统一支付宝平台 `usingComponents` 与 JS `require` 的 npm 引用改写逻辑，确保与目录策略一致。
  - npm 构建与输出清理流程按策略保留对应目录，避免缓存与产物目录错配。

- 🐛 **fix(alipay): 按脚本扩展名生成 class/style helper 导出语法。** [`ba941e7`](https://github.com/weapp-vite/weapp-vite/commit/ba941e77e8dceaba9ba8acc9ecec0acc348604b1) by @sonofmagic
  - 当 helper 输出为 `.sjs` 时，使用 `export default` 导出，避免支付宝 SJS 对 `module` 标识符限制导致的编译错误。
  - 当 helper 输出为 `.wxs` 时，继续使用 `module.exports`，保持微信等平台兼容行为不变。
  - weapp-vite 在发出 class/style helper 时，改为显式传入当前脚本扩展名，确保不同平台走对应导出策略。

- 🐛 **feat: 支持支付宝平台一键打开 IDE，并优化 lib-mode 测试产物稳定性。** [`f46e69c`](https://github.com/weapp-vite/weapp-vite/commit/f46e69cbb7c6aef720d1ace6aa58916e0d28dc1a) by @sonofmagic
  - `weapp-ide-cli` 新增 `open --platform alipay` 分流能力，自动转发到 `minidev ide`。
  - `weapp-vite` 新增 `open --platform <platform>`，且在 `dev/build --open -p alipay` 场景自动走支付宝 IDE 打开链路。
  - `weapp-vite` 的 `injectWeapi` 在 app 注入阶段新增原生平台 API 兜底探测，避免支付宝环境下 `wpi` 未绑定原生 `my` 导致 `setClipboardData:fail method not supported`。
  - `weapp-vite` 在多平台模式下针对支付宝平台优化 npm 输出目录推导：若未手动配置 `packNpmRelationList`，会基于 `mini.project.json` 的 `miniprogramRoot` 计算 npm 输出目录，避免 npm 产物错误写入项目根目录。
  - `weapp-vite` 的 `lib-mode` 测试改为写入临时输出目录，避免每次单测改写 fixture 内的 `.d.ts` 文件。

- 🐛 **feat: 完善支付宝示例与模板脚本模块兼容。** [`b474b9a`](https://github.com/weapp-vite/weapp-vite/commit/b474b9ade95d3430c11256f41d665bc14e268875) by @sonofmagic
  - 在 `apps/alipay-antd-mini-demo` 新增 wevu SFC 页面示例，并补充首页跳转入口。
  - 修复支付宝模板脚本模块标签转换，统一输出 `import-sjs` 并映射 `from/name` 属性，避免开发者工具报 `<sjs>` 不存在。
  - 同步完善 wxml/nmp builder 相关测试，覆盖支付宝脚本模块转换链路。
- 📦 Updated 5 dependencies [`6e7c559`](https://github.com/weapp-vite/weapp-vite/commit/6e7c55998303f0c50857f439becae8e30e3615d6)

## 6.5.2

### Patch Changes

- 🐛 **支持在 App 入口可选注入 @wevu/api 的 wpi，且仅在启用时生成全局类型提示与可选 wx 替换配置（默认关闭，需显式开启）。** [`21e2d6f`](https://github.com/weapp-vite/weapp-vite/commit/21e2d6f2eec95502a0eb6e4f0d911a327e180478) by @sonofmagic

- 🐛 **lib 模式默认生成 dts，支持 .vue/wevu SFC，并修复 rolldown dts 输出命名冲突；新增 internal 模式生成 Vue SFC dts（vue-tsc 作为可选后备），同时导出 WevuComponentConstructor 以保障声明生成。** [`7ac4a68`](https://github.com/weapp-vite/weapp-vite/commit/7ac4a688e88e21192cf0806ca041db0773ac3506) by @sonofmagic
- 📦 Updated 4 dependencies [`caa9ca5`](https://github.com/weapp-vite/weapp-vite/commit/caa9ca54f2453357a56cf2a433404498bacbd206)

## 6.5.1

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 Updated 10 dependencies [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)

## 6.5.0

### Minor Changes

- ✨ **Miscellaneous improvements** [`c4d3abb`](https://github.com/weapp-vite/weapp-vite/commit/c4d3abb8e4642dc38fa9a47efc7ac26b41703db1) by @sonofmagic
  - 新增共享 chunk 的配置能力，并在构建阶段仅使用 rolldown（忽略 rollupOptions）。
  - web 插件在未扫描模板列表时也可直接转换 wxml。

- ✨ **Miscellaneous improvements** [`737cc22`](https://github.com/weapp-vite/weapp-vite/commit/737cc220cd44cd0cf1ec6597fc80d1efbf47b9a1) by @sonofmagic
  - 新增 weapp.lib 库模式，用于按入口打包组件/模块，并支持自动生成组件 JSON。

### Patch Changes

- 🐛 **升级多处依赖版本（Babel 7.29、oxc-parser 0.112、@vitejs/plugin-vue 6.0.4 等）。** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628) by @sonofmagic
  - 同步模板与示例的 tdesign-miniprogram、weapp-tailwindcss、autoprefixer 等版本，确保脚手架默认依赖一致。
- 📦 **Dependencies** [`8143b97`](https://github.com/weapp-vite/weapp-vite/commit/8143b978cc1bbc41457411ffab007ef20a01f628)
  → `@weapp-vite/web@1.2.1`, `rolldown-require@2.0.3`, `wevu@2.1.4`

## 6.4.7

### Patch Changes

- 🐛 **修复 Vue SFC `<style>` 中 `@import` 相对路径解析基准错误，确保按当前 SFC 目录解析。** [`2e218e6`](https://github.com/weapp-vite/weapp-vite/commit/2e218e69812a5795231b6e718daed585cd37f29f) by @sonofmagic

## 6.4.6

### Patch Changes

- 🐛 **修复 Windows 下 Vue `<style>` 请求带 `?query` 导致的路径读取错误，改用虚拟 ID 并在解析时还原真实路径。** [`eed307c`](https://github.com/weapp-vite/weapp-vite/commit/eed307c73c431809284a6515f1ee4fe977af2863) by @sonofmagic

## 6.4.5

### Patch Changes

- 🐛 **修复 Windows 下 .vue 样式虚拟请求解析导致的构建报错，并改进 /@fs 与路径分隔符处理（含 WXS/WXML 与缓存 key）以提升跨平台兼容性。** [`0d7f854`](https://github.com/weapp-vite/weapp-vite/commit/0d7f854d4bbcb544ada423137747a0a898e21308) by @sonofmagic
- 📦 **Dependencies** [`0f4dcbf`](https://github.com/weapp-vite/weapp-vite/commit/0f4dcbf91630b3c0222ac5602b148ee5d500dd17)
  → `rolldown-require@2.0.2`, `wevu@2.1.3`

## 6.4.4

### Patch Changes

- 🐛 **升级依赖版本：rolldown 至 1.0.0-rc.2、vite 至 8.0.0-beta.10。** [`aca8b62`](https://github.com/weapp-vite/weapp-vite/commit/aca8b62241f1e735bb159c13c26d925718e81a3f) by @sonofmagic

- 🐛 **将 Vue SFC 与 wevu 编译逻辑迁移到 `@wevu/compiler`，由 `wevu/compiler` 统一导出，`weapp-vite` 改为使用新编译器入口并清理重复实现。** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce) by @sonofmagic
- 📦 **Dependencies** [`5b1b6c3`](https://github.com/weapp-vite/weapp-vite/commit/5b1b6c33746417911cc4490ce47967fb510171ce)
  → `wevu@2.1.2`

## 6.4.3

### Patch Changes

- 🐛 **支持内联事件参数使用动态表达式，并兼容小程序侧数组参数传递。** [`8940c7f`](https://github.com/weapp-vite/weapp-vite/commit/8940c7fd87b6153137ca9b33b8d0925a4b592c4e) by @sonofmagic

- 🐛 **支持内联事件表达式在编译期生成执行器，保证复杂参数调用在小程序运行时可用。** [`9c90f7b`](https://github.com/weapp-vite/weapp-vite/commit/9c90f7b6777374aaf54ee4b5955a4b01209acc0f) by @sonofmagic

- 🐛 **修复作用域插槽生成规则与样式隔离默认值，更新 e2e 运行与展示配置并补齐小程序类型定义。** [`53c2b8a`](https://github.com/weapp-vite/weapp-vite/commit/53c2b8a5f25e59d621d6dac5018b56352aaa785f) by @sonofmagic
- 📦 **Dependencies** [`8940c7f`](https://github.com/weapp-vite/weapp-vite/commit/8940c7fd87b6153137ca9b33b8d0925a4b592c4e)
  → `wevu@2.1.1`

## 6.4.2

### Patch Changes

- 🐛 **scoped slot 组件生成的 JSON 现在会应用 json.defaults.component 并遵循 mergeStrategy，方便统一设置 styleIsolation。** [`a5b96ae`](https://github.com/weapp-vite/weapp-vite/commit/a5b96aef3fc7fa6ecc719ab6adc2e374f1f74e3a) by @sonofmagic

- 🐛 **仅在 v-slot 传递作用域参数时生成 scoped slot 组件，普通具名插槽回退为原生 slot；新增 weapp.vue.template.scopedSlotsRequireProps 配置以切换旧行为。** [`a97099c`](https://github.com/weapp-vite/weapp-vite/commit/a97099cdfa28362b13481758405cda8961858b39) by @sonofmagic

- 🐛 **新增组件选项 `setupLifecycle`（`created` / `attached`），并将默认执行时机改为 `attached`，以便 setup 拿到外部传入的 props；同时 weapp-vite 类型对齐该配置。** [`5c42bd3`](https://github.com/weapp-vite/weapp-vite/commit/5c42bd34cac020dc6d6bd094b6b45e78cdb6a53c) by @sonofmagic
- 📦 **Dependencies** [`5c42bd3`](https://github.com/weapp-vite/weapp-vite/commit/5c42bd34cac020dc6d6bd094b6b45e78cdb6a53c)
  → `wevu@2.1.0`

## 6.4.1

### Patch Changes

- 🐛 **修复路径规范化处理，增强 Windows/Linux/macOS 的兼容性。** [`ef8b0a6`](https://github.com/weapp-vite/weapp-vite/commit/ef8b0a6dfa934c43fb218b3479426070afac8acc) by @sonofmagic

- 🐛 **稳定模板 watch rebuild 测试，避免复制 node_modules 触发随机失败，并补齐测试类型定义。** [`556d45d`](https://github.com/weapp-vite/weapp-vite/commit/556d45dc74a646da65046ad8dae4043ff53a6f26) by @sonofmagic

- 🐛 **修复 Windows 下脚本改动不触发热更新的问题，并补充模板 watch rebuild 测试。** [`50cae1b`](https://github.com/weapp-vite/weapp-vite/commit/50cae1b62e63d24cf7cdb2babf185a283af81b29) by @sonofmagic
- 📦 **Dependencies** [`a6e3ba8`](https://github.com/weapp-vite/weapp-vite/commit/a6e3ba8be6c22dcfbf2edbfa9c977f8a39aef119)
  → `wevu@2.0.2`

## 6.4.0

### Minor Changes

- ✨ **multiPlatform 改为使用 `config/<platform>/project.config.json` 目录约定，禁用 `--project-config` 覆盖，并在构建时同步复制平台配置目录到产物根目录。** [`3c9113d`](https://github.com/weapp-vite/weapp-vite/commit/3c9113d2945c1ebbece9f85b5b914ca975d2e837) by @sonofmagic

- ✨ **新增 multiPlatform 多平台配置支持，允许按平台加载 `project.config` 并支持 `--project-config` 覆盖路径。** [`763e936`](https://github.com/weapp-vite/weapp-vite/commit/763e9366831f17042592230d7f0d09af9df53373) by @sonofmagic
  - 补充 `LoggerConfig`/`WeappWebConfig` 的 JSDoc 示例，提升 IDE 提示体验。 避免 rolldown-require 在配置 `codeSplitting` 时触发 `inlineDynamicImports` 的警告。

### Patch Changes

- 🐛 **支持按平台读取对应的项目配置文件名（如 `mini.project.json`、`project.swan.json`），并同步多平台示例配置目录结构。** [`e56da93`](https://github.com/weapp-vite/weapp-vite/commit/e56da9360230735055c513f1e6b5a8bd99ad892e) by @sonofmagic

- 🐛 **修复多平台构建时 `dist` 输出与 `project.config` 同步路径不一致的问题，统一将 `miniprogramRoot=dist` 映射为 `dist/<platform>/dist` 并自动复制平台 `project.config`。** [`9a99f4c`](https://github.com/weapp-vite/weapp-vite/commit/9a99f4c4b249c97bf76733027307028f9c5c5d68) by @sonofmagic
  - 显式禁用 `inlineDynamicImports` 以避免 `codeSplitting` 下的警告。

- 🐛 **开发态构建结束后可自动 touch `app.wxss` 以触发微信开发者工具热重载（检测 weapp-tailwindcss）。** [`f428178`](https://github.com/weapp-vite/weapp-vite/commit/f428178aa44a07e48f33f5aaa9f5e875440bd6db) by @sonofmagic

- 🐛 **调整 Web 默认输出目录为 `dist/web`，并确保 Web 构建 `outDir` 不被小程序构建配置覆盖。** [`742eb8f`](https://github.com/weapp-vite/weapp-vite/commit/742eb8f321aa02cadac4ec3b91753d7cf8d653ce) by @sonofmagic
- 📦 **Dependencies** [`763e936`](https://github.com/weapp-vite/weapp-vite/commit/763e9366831f17042592230d7f0d09af9df53373)
  → `@weapp-core/logger@3.0.2`, `rolldown-require@2.0.1`, `wevu@2.0.1`

## 6.3.6

### Patch Changes

- 🐛 **完善多平台模板与脚本模块的输出后缀适配，并同步 JSON 产物扩展名处理。** [`31e4d25`](https://github.com/weapp-vite/weapp-vite/commit/31e4d2520f89e57bc1e06561c57351aa18f635bb) by @sonofmagic

- 🐛 **chore: 升级 rolldown -> 1.0.0-rc.1, vite -> 8.0.0-beta.9** [`4b58db7`](https://github.com/weapp-vite/weapp-vite/commit/4b58db76983ca19a8aa232e7b35d88e6ef2896ce) by @sonofmagic

## 6.3.5

### Patch Changes

- 📦 **Dependencies** [`158306b`](https://github.com/weapp-vite/weapp-vite/commit/158306b75191040ecbdef846e66e9f6e49036d19)
  → `wevu@2.0.0`

## 6.3.4

### Patch Changes

- 📦 **Dependencies** [`ecf7436`](https://github.com/weapp-vite/weapp-vite/commit/ecf7436d8c22a4827cbb26410eb6153156cfc796)
  → `wevu@1.3.0`

## 6.3.3

### Patch Changes

- 📦 **Dependencies** [`775e89d`](https://github.com/weapp-vite/weapp-vite/commit/775e89d64484bc3052204c1ed73a9549d7359093)
  → `wevu@1.2.1`, `@weapp-vite/web@1.2.0`

## 6.3.2

### Patch Changes

- 📦 **Dependencies** [`e592907`](https://github.com/weapp-vite/weapp-vite/commit/e59290771ae1f152b421b10e5960d486023ccbb6)
  → `wevu@1.2.0`

## 6.3.1

### Patch Changes

- 📦 **Dependencies** [`ff5930b`](https://github.com/weapp-vite/weapp-vite/commit/ff5930b162f79436e74430f2820fa3b7e27a4eed)
  → `wevu@1.1.4`

## 6.3.0

### Minor Changes

- ✨ **新增 Web 模式的 --host CLI 参数，并增强 Web 编译期组件标签映射与属性绑定，提升 H5 运行时的交互兼容性。** [`f38965c`](https://github.com/weapp-vite/weapp-vite/commit/f38965c654802dfb5a415d7f85e88c079bdb85b9) by @sonofmagic

### Patch Changes

- 🐛 **新增日志配置能力：支持全局 `logger.level` 与按 tag 的 `logger.tags` 过滤，并在 weapp-vite 配置中暴露 `weapp.logger`（npm 日志改由 tag 控制）。** [`13703f5`](https://github.com/weapp-vite/weapp-vite/commit/13703f5ca6010df78f5d08a2a9d4dbed4c5ccea4) by @sonofmagic
- 📦 **Dependencies** [`13703f5`](https://github.com/weapp-vite/weapp-vite/commit/13703f5ca6010df78f5d08a2a9d4dbed4c5ccea4)
  → `@weapp-core/logger@3.0.1`, `@weapp-vite/web@1.1.0`, `wevu@1.1.3`

## 6.2.4

### Patch Changes

- 🐛 **完善 Node.js 版本要求的提示：文档明确支持 `^20.19.0 || >=22.12.0`，CLI 在低于该范围时给出警告。** [`a887b51`](https://github.com/weapp-vite/weapp-vite/commit/a887b516cd0b14f22cc39e9f46be2ab5934d53e4) by @sonofmagic

- 🐛 **chore(deps): upgrade** [`382c18f`](https://github.com/weapp-vite/weapp-vite/commit/382c18f98b6b015b0f4daedc3f44d235685669dd) by @sonofmagic
- 📦 **Dependencies** [`dd2b69d`](https://github.com/weapp-vite/weapp-vite/commit/dd2b69d81b8b0aa530654b349be304c6081b8500)
  → `@weapp-vite/web@1.0.1`

## 6.2.3

### Patch Changes

- 🐛 **修复 vue-tsc 加载 weapp-vite/volar 的 CJS 兼容问题，并补充 schematics 的 CJS 产物。** [`d6bd490`](https://github.com/weapp-vite/weapp-vite/commit/d6bd490eb22cbc97614e7f0343c520b288ddc27c) by @sonofmagic
- 📦 **Dependencies** [`d6bd490`](https://github.com/weapp-vite/weapp-vite/commit/d6bd490eb22cbc97614e7f0343c520b288ddc27c)
  → `@weapp-core/schematics@6.0.1`, `@weapp-vite/volar@2.0.3`

## 6.2.2

### Patch Changes

- 🐛 **修复组件模板 ref 返回值，优先返回 expose/公开实例并自动识别组件 ref。** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f) by @sonofmagic

- 🐛 **新增 useTemplateRef 支持并同步模板 ref 更新逻辑。** [`5eed670`](https://github.com/weapp-vite/weapp-vite/commit/5eed670c559d9d8fd5a5a3f3c963a3e08be75559) by @sonofmagic

- 🐛 **修复 script transform 未剥离 TypeScript satisfies 表达式，导致构建时报错的问题。** [`208cf31`](https://github.com/weapp-vite/weapp-vite/commit/208cf3195aa09d92ad198d3b45623d0dd78ac1a8) by @sonofmagic
- 📦 **Dependencies** [`9d32d9b`](https://github.com/weapp-vite/weapp-vite/commit/9d32d9b1996b750917a1baf7478373f1463d207f)
  → `wevu@1.1.2`, `@weapp-vite/volar@2.0.2`

## 6.2.1

### Patch Changes

- 🐛 **新增：SFC 的 <template>/<script>/<script setup>/<style> 支持 src 引用路径（含 alias/绝对路径与扩展名推断）。** [`504bc67`](https://github.com/weapp-vite/weapp-vite/commit/504bc67af9444ed36d5b5bd62fedaa33ac72d874) by @sonofmagic

- 🐛 **新增 Vue SFC 模板 ref 支持，编译期注入 ref 元数据与标记，运行时通过 selectorQuery 绑定与更新。** [`60f19f8`](https://github.com/weapp-vite/weapp-vite/commit/60f19f8bceff0ffdd8668e54b00f6864999e4c5a) by @sonofmagic

- 🐛 **补充 volar 插件的 CJS 产物与 require 导出，修复 vue-tsc 解析 weapp-vite/volar 的报错。** [`8ff60aa`](https://github.com/weapp-vite/weapp-vite/commit/8ff60aab1097a28c7218b8b18624ac9deca9206d) by @sonofmagic

- 🐛 **修复：调整 SFC src 与打包产物相关的测试断言，避免误判。** [`8e4a739`](https://github.com/weapp-vite/weapp-vite/commit/8e4a73904061f9a774955342a8566ae56b9eb7ce) by @sonofmagic
- 📦 **Dependencies** [`60f19f8`](https://github.com/weapp-vite/weapp-vite/commit/60f19f8bceff0ffdd8668e54b00f6864999e4c5a)
  → `wevu@1.1.1`, `@weapp-vite/volar@2.0.1`

## 6.2.0

### Minor Changes

- ✨ **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

### Patch Changes

- 🐛 **优化 dev 热更新：** [`93df41a`](https://github.com/weapp-vite/weapp-vite/commit/93df41acb8db2848c7cea1e6264281530254e0f0) by @sonofmagic
  - 默认启用 hmr.sharedChunks=auto，减少全量发射。
  - 缓存 JSON 宏配置与依赖，避免重复 bundleRequire。
  - 缓存 app 入口/共享 chunk 命名，减少重复解析与计算。
  - 为 app 配置引入 auto-routes 签名缓存，并减少无关页面更新时的 app 入口解析。

- 🐛 **chore(deps): upgrade** [`bd978cb`](https://github.com/weapp-vite/weapp-vite/commit/bd978cbbc9438eab0040f1a12ac1a6fd976f5200) by @sonofmagic
- 📦 Updated 10 dependencies [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda)

## 6.1.11

### Patch Changes

- 🐛 **在 `client.d.ts` 中统一引入 wevu 类型，并移除 apps/templates 中冗余的 wevu 引用。** [`89de9c6`](https://github.com/weapp-vite/weapp-vite/commit/89de9c6e5a28e14dc45607db7f9bdf8839532666) by @sonofmagic
- 📦 **Dependencies** [`be9cdec`](https://github.com/weapp-vite/weapp-vite/commit/be9cdece9b680178b8f1e57d0b945251c9c4fe82)
  → `wevu@1.0.7`

## 6.1.10

### Patch Changes

- 🐛 **统一 weapp-vite 内用户可见的警告、错误与注释为中文。** [`4f571bb`](https://github.com/weapp-vite/weapp-vite/commit/4f571bbab6707905497c7d370c0b562eb0e51af1) by @sonofmagic
- 📦 **Dependencies** [`dc9fcc0`](https://github.com/weapp-vite/weapp-vite/commit/dc9fcc044af51c4d39439064717864f51a1f7aad)
  → `wevu@1.0.6`

## 6.1.9

### Patch Changes

- 🐛 **补齐 class/style 绑定对象/数组在小程序中的 WXS/JS 运行时支持，JS 侧改为编译期 AST 注入以避免 eval/with，并新增相关单测覆盖。** [`4d53674`](https://github.com/weapp-vite/weapp-vite/commit/4d536749f1dfb6c4d54093df78f643057c4deb74) by @sonofmagic

- 🐛 **新增 `vue.template.classStyleWxsShared` 配置，用于控制 class/style WXS 运行时是否按包根复用（默认开启），降低重复产物。** [`c0297d2`](https://github.com/weapp-vite/weapp-vite/commit/c0297d2c0d4bafc9f17d22cd61e47e6a366aa43f) by @sonofmagic

- 🐛 **修复 dev 下模板/样式/配置侧车文件变更未触发热更新的问题，补齐 wxml/wxss/scss/json/js/ts 的增量构建单测覆盖。** [`69d6483`](https://github.com/weapp-vite/weapp-vite/commit/69d6483a236769a4b22ffce117f0a8e63139b6e7) by @sonofmagic
- 📦 **Dependencies** [`4d53674`](https://github.com/weapp-vite/weapp-vite/commit/4d536749f1dfb6c4d54093df78f643057c4deb74)
  → `wevu@1.0.5`

## 6.1.8

### Patch Changes

- 🐛 **chore(deps): upgrade** [`b6d5f0e`](https://github.com/weapp-vite/weapp-vite/commit/b6d5f0e6e26c76b78462d0a335d4da7341b8d969) by @sonofmagic

- 🐛 **修复 autoImportComponents 生成的导航路径优先指向 `.d.ts`，避免组件类型在 Volar 中退化为 `any`。** [`fe23c0e`](https://github.com/weapp-vite/weapp-vite/commit/fe23c0e2f191f3b7b2043cd3e30afe07c0b7df69) by @sonofmagic
  - 补充 wevu 宏指令的中文说明与示例，完善类型提示使用说明。 调整 wevu `jsx-runtime` 的 `IntrinsicElements` 以继承 `GlobalComponents`，让小程序组件标签能正确推断属性类型。

- 🐛 **chore: 升级 rolldown 和 vite 的版本** [`2d01415`](https://github.com/weapp-vite/weapp-vite/commit/2d014157b409d3a854d89957602fa5a541736077) by @sonofmagic
- 📦 **Dependencies** [`fcb8d6a`](https://github.com/weapp-vite/weapp-vite/commit/fcb8d6a13e501880cc976409f372518002f3229e)
  → `wevu@1.0.4`

## 6.1.7

### Patch Changes

- 🐛 **优化 dev/watch 构建性能：** [`6a098f7`](https://github.com/weapp-vite/weapp-vite/commit/6a098f74307a2da524599c22fe29fcbad0e72058) by @sonofmagic
  - dev 默认关闭 `sourcemap`（需要时可在 `vite.config.ts` 显式开启）
  - 缓存 Vue SFC 解析结果，减少热更新时重复解析
  - `pathExists` 查询加入 TTL 缓存，并在文件 create/delete 时失效，提升 sidecar 样式处理效率
  - dev watch 时收到文件变更事件会主动失效文件读取缓存，避免极端情况下 mtime/size 未变化导致的“变更不生效”
  - 无 `baseUrl/paths` 时默认不注入 `vite-tsconfig-paths`（或可 `weapp.tsconfigPaths=false` 强制关闭）
  - watch 场景下避免每次 rebuild 主动 `load` 所有入口模块（仅首次预热），减少全量重编译倾向
- 📦 **Dependencies** [`4f5b4d4`](https://github.com/weapp-vite/weapp-vite/commit/4f5b4d43b0a604f901b27eb143b2a63ed7049f11)
  → `wevu@1.0.3`

## 6.1.6

### Patch Changes

- 🐛 **chore(deps): upgrade** [`9260af8`](https://github.com/weapp-vite/weapp-vite/commit/9260af8561ad47b55f2b6084be7f2b039c5d523c) by @sonofmagic

- 🐛 **修复：支持在 Vue 模板中使用 PascalCase（如 `TButton`）触发小程序组件 `usingComponents` 自动导入。** [`40e51e4`](https://github.com/weapp-vite/weapp-vite/commit/40e51e401be28c0057c8fe23a334b0546d2c8151) by @sonofmagic
- 📦 **Dependencies** [`29d8996`](https://github.com/weapp-vite/weapp-vite/commit/29d899694f0166ffce5d93b8c278ab53d86ced1e)
  → `wevu@1.0.2`

## 6.1.5

### Patch Changes

- 📦 **Dependencies** [`e1e1db3`](https://github.com/weapp-vite/weapp-vite/commit/e1e1db36bcbd7f450473825a999a5976bc8015b8)
  → `@weapp-core/init@5.0.1`

## 6.1.4

### Patch Changes

- 🐛 **## 变更说明** [`efa28eb`](https://github.com/weapp-vite/weapp-vite/commit/efa28ebddba79c054f98f594181b5844a0042eaa) by @sonofmagic
  - `weapp-vite` CLI 移除 `create` 命令；新项目创建请使用 `create-weapp-vite`（例如 `pnpm create weapp-vite`）。
  - `@weapp-core/init` 仅保留“初始化配置文件”相关能力（如 `initConfig`），不再包含模板项目创建能力。
  - 模板同步与模板创建逻辑迁移到 `create-weapp-vite`，并对外导出 `createProject` / `TemplateName`。
- 📦 **Dependencies** [`efa28eb`](https://github.com/weapp-vite/weapp-vite/commit/efa28ebddba79c054f98f594181b5844a0042eaa)
  → `@weapp-core/init@5.0.0`

## 6.1.3

### Patch Changes

- 🐛 **修复 Vue SFC 模板中 kebab-case 组件标签（如 `t-cell-group`/`t-cell`）未能通过 `autoImportComponents` 自动写入 `usingComponents` 的问题；同时修复模板表达式生成时中文被转为 `\\uXXXX` 导致 WXML 直接显示转义序列的问题。** [`75a9e1f`](https://github.com/weapp-vite/weapp-vite/commit/75a9e1fc14234bc2f0df265e1a1ed822c74170d8) by @sonofmagic
- 📦 **Dependencies** [`c02b412`](https://github.com/weapp-vite/weapp-vite/commit/c02b41283cb4862891e85750b72c9937a339f4fe)
  → `@weapp-core/init@4.1.1`

## 6.1.2

### Patch Changes

- 🐛 **修复 Vue SFC 的 `<style lang="scss">` 等样式块未交给 Vite CSS 流水线处理的问题：现在会正确走 Sass 预处理与 PostCSS（含 Tailwind）等插件链，并输出对应 `.wxss`。** [`0350a93`](https://github.com/weapp-vite/weapp-vite/commit/0350a936481e9f3a743b3366c1f5b433f37ecd3e) by @sonofmagic
- 📦 **Dependencies** [`802a189`](https://github.com/weapp-vite/weapp-vite/commit/802a1891a555b95d0efc4f0e6393758d536aad76)
  → `@weapp-core/init@4.1.0`

## 6.1.1

### Patch Changes

- 🐛 **优化 `autoImportComponents` 生成的 `components.d.ts`：支持在 VSCode 中对第三方组件（如 `@vant/weapp`、`tdesign-miniprogram`）`Cmd/Ctrl+Click` 直接跳转到源码，同时保留 props 智能提示。** [`8205860`](https://github.com/weapp-vite/weapp-vite/commit/8205860fe29e2dd7bb8f7bad8c4fc7a31aca751b) by @sonofmagic

## 6.1.0

### Minor Changes

- ✨ **### weapp-vite** [`78e8ab8`](https://github.com/weapp-vite/weapp-vite/commit/78e8ab8c4f923a138c4216933186853fd8b81f63) by @sonofmagic
  - `autoImportComponents.resolvers` 新增支持 **对象写法**（推荐），同时保持对历史 **函数写法** 的兼容。
  - 内置 `VantResolver` / `TDesignResolver` / `WeuiResolver` 已切换为对象 resolver：优先走 `resolve()` / `components`，再回退到函数 resolver。
  - 第三方组件库 props 元数据解析从硬编码迁移为 resolver 自描述（`resolveExternalMetadataCandidates`），并加入候选路径的启发式兜底。

  > 注意：如果你此前在业务代码里直接调用内置 resolver（例如 `VantResolver()('van-button', ...)`），现在应改为交给 weapp-vite 处理，或自行调用 `resolver.resolve(...)`。

  ### @weapp-core/init
  - 修复单测依赖：在测试启动阶段同步生成 `templates/`，并加入锁防止并发同步导致的偶发失败。

### Patch Changes

- 🐛 **### weapp-vite** [`4bce0d4`](https://github.com/weapp-vite/weapp-vite/commit/4bce0d4374b1419bd05b710428db968898a6cae9) by @sonofmagic
  - dev 模式默认排除 `.wevu-config`，避免临时文件触发无意义的重编译。
  - `.wevu-config` 临时文件改为写入 `node_modules/.cache/weapp-vite/wevu-config`（可用 `WEAPP_VITE_WEVU_CONFIG_DIR` 覆盖），减少源码目录噪音。
  - 入口依赖的 `resolve()` 结果做跨次构建缓存，并在 create/delete 事件时自动失效，加快热更新耗时。
- 📦 **Dependencies** [`78e8ab8`](https://github.com/weapp-vite/weapp-vite/commit/78e8ab8c4f923a138c4216933186853fd8b81f63)
  → `@weapp-core/init@4.0.1`

## 6.0.1

### Patch Changes

- 📦 **Dependencies** [`6f1c4ca`](https://github.com/weapp-vite/weapp-vite/commit/6f1c4cabb30a03f0dc51b11c3aff6fdcbf0e09c9)
  → `wevu@1.0.1`

## 6.0.0

### Major Changes

- 🚀 **## disable-auto-routes-when-off** [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7) by @sonofmagic
  修复在未开启 `weapp.autoRoutes` 时仍注册 auto-routes 插件导致的性能占比统计，并补充示例页的 `<json>` JS 写法使编译通过。

  ## ensure-build-exits

  修复构建完成后进程仍然驻留的问题：显式关闭编译上下文的 watcher，并在退出时终止遗留的 sass-embedded 子进程，避免 pnpm build 卡住。

  ## fix-define-expose-transform

  修复 `<script setup>` 中 `defineExpose` 的编译产物处理：不再错误移除 `__expose({ ... })`，并将其对齐为 wevu `setup(_, { expose })` 的 `expose(...)` 调用，确保公开成员可被正确暴露。

  ## fix-setup-ref-ui-update

  修复小程序端 `script setup` 返回 `ref` 时更新不触发 UI 的问题：
  - wevu：运行时更新追踪补齐对 `setup` 返回 `ref/computedRef` 的依赖收集，`ref.value` 变化会触发 diff + `setData` 更新。
  - wevu：`ref/customRef` 默认 `markRaw`，避免被 `reactive()` 代理后影响内部依赖集合。
  - weapp-vite：npm 依赖缓存逻辑增强（非小程序包时对比入口文件时间戳），避免本地 workspace 包变更后仍复用旧的 `miniprogram_npm` 产物。

  ## fix-vmodel-and-props-sync-zh

  修复 weapp-vite + wevu 在微信小程序中的两类常见问题：
  - `v-model`：不再生成 `bind:input="message = $event.detail.value"` 这类非法方法名，改为通过运行时方法 `__weapp_vite_model` 完成双向绑定。
  - `props`：补齐小程序 `properties` → `setup(props)` 绑定的同步与更新触发，避免模板里出现 `props.xxx` 为 `undefined`（尤其在 observer 回调时 `this.properties` 尚未更新的场景）。

  ## fix-vue-json-macro-hmr-zh

  修复 Vue SFC `<script setup>` JSON 宏（`definePageJson/defineComponentJson/defineAppJson`）在 dev 下热更新不稳定、以及把配置从 `xxx1` 改回 `xxx` 时产物 `.json` 字段偶发丢失的问题：
  - 避免直接修改 `@vue/compiler-sfc` 的 `descriptor`（其内部存在 `parseCache`），防止缓存对象被污染导致宏被“永久剥离”。
  - 让宏内容变化能够稳定影响最终 JS 产物，从而触发增量构建与微信开发者工具刷新。

  ## remove-plugin-wevu

  ## 重构 Vue 支持架构

  将 Vue SFC 支持完全集成到 `weapp-vite` 内部。

  ### 主要变更
  - ✅ **删除外置的 Vue 编译插件包**
    - 核心功能已完全迁移到 weapp-vite
    - 不再需要单独的 Vue 插件

  - ✅ **weapp-vite 内置 Vue 支持**
    - 自动处理 `.vue` 文件
    - 支持完整的 Vue SFC 编译
    - 支持 JS/TS 配置块
    - 更健壮的 Babel AST 转换

  - ✅ **Runtime API 导出**
    - `createWevuComponent` 可从 `weapp-vite` 和 `weapp-vite/runtime` 导入
    - 完整的 TypeScript 类型支持

  ### 迁移指南

  **之前（使用外置插件）：**

  ```typescript
  export default defineConfig({
    plugins: [
      /* 旧 Vue 插件 */
    ],
  });
  ```

  **现在（内置支持）：**

  ```typescript
  import { defineConfig } from "weapp-vite/config";

  export default defineConfig({
    weapp: {
      srcRoot: "src",
    },
    // Vue 文件自动处理，无需额外配置
  });
  ```

  ### Breaking Changes
  - 移除了外置 Vue 编译插件
  - demo 项目不再需要 pre 脚本来构建依赖
  - 依赖简化：`demo → weapp-vite → wevu`

  ### 测试

  所有 81 个测试通过 ✅

  ## remove-take-query-plugin

  移除未使用的 `weapp-vite:pre:take-query` 插件（及 `take:` 前缀解析）以降低构建插件开销，并同步示例特性文案。

  ## six-eyes-tan

  chore: 升级 rolldown -> 1.0.0-beta.57 , vite -> 8.0.0-beta.5

  ## support-script-setup-model-slots

  补齐 Vue `<script setup>` 宏与运行时兼容能力：
  - 支持 `defineModel()` / `defineSlots()`（将 Vue 编译产物中的 `useModel/mergeModels/useSlots/useAttrs` 迁移到 `wevu`）。
  - wevu 新增并导出 `useModel` / `mergeModels` / `useSlots` / `useAttrs` 兼容 API（用于承接 Vue SFC 编译产物）。
  - 模板事件绑定支持带 `:` 的事件名（如 `update:modelValue` 生成 `bind:update:modelValue`），确保 `defineModel` 的更新事件可在小程序端正常派发/监听。

  ## unify-json-schema-source

  统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

  ### weapp-vite
  - Vue SFC `<json>` 块编译时自动移除 `$schema` 字段
  - `$schema` 字段仅用于编辑器智能提示，不应出现在编译产物中
  - 修复 TypeScript `as` 类型断言移除逻辑
  - 修复正则表达式错误删除属性值的问题
  - 修复运行时模块解析问题：将 `createWevuComponent` 代码内联到每个页面文件

  ## volar-config-enhancements

  增强 Volar 插件配置块支持，完整实现 JSONC/JS/TS 配置模式

  ### weapp-vite
  - **集成 volar 插件**：通过 `weapp-vite/volar` 重新导出 volar 插件，无需单独安装
  - **自动依赖管理**：安装 weapp-vite 时自动获取 volar 智能提示功能
  - **构建时执行**：使用 rolldown-require 执行 JS/TS 配置块，支持异步函数

  ### 配置模式对比

  | 模式           | 语法        | 智能提示       | 异步支持 | 适用场景                   |
  | -------------- | ----------- | -------------- | -------- | -------------------------- |
  | `lang="json"`  | JSON        | ✅ Schema      | ❌       | 简单静态配置               |
  | `lang="jsonc"` | JSON + 注释 | ✅ Schema      | ❌       | 带注释的静态配置           |
  | `lang="js"`    | JavaScript  | ✅ 类型        | ✅       | 动态配置、简单逻辑         |
  | `lang="ts"`    | TypeScript  | ✅ 类型 + 检查 | ✅       | 复杂动态配置、需要类型检查 |
  | 无 lang        | TypeScript  | ✅ 类型 + 检查 | ✅       | 默认模式，完整类型检查     |

  ## vue-key-fix-and-volar-enhance

  修复 Vue 模板编译与 Volar 配置提示
  - 修正 v-for 场景下 :key 生成逻辑：当 :key 绑定循环项对象属性（如 item.id）时输出 `wx:key="id"`，当 :key 绑定 item 或 key 别名时输出 `wx:key="*this"`，避免小程序端 key 语义错误
  - 为 Vue 配置块（<json>）补充完整 TS/JS 智能提示：解析 default export 并注入带类型的辅助函数，规范语言解析（含 json/jsonc 降级），提升写配置时的补全与类型检查体验
  - 更新综合示例及构建输出，确保 demo 使用最新编译/提示行为

  ## vue-sfc-support

  完整的 Vue SFC 单文件组件支持
  - 模板编译：使用 Vue compiler-core 替代正则表达式解析，支持完整的 Vue 3 模板语法
  - v-model 增强：支持所有输入类型（text、checkbox、radio、textarea、select、switch、slider、picker）
  - 样式处理：实现 CSS 到 WXSS 的转换，支持 Scoped CSS 和 CSS Modules
  - 插槽系统：支持默认插槽、具名插槽、作用域插槽和 fallback 内容
  - 高级特性：支持动态组件 `<component :is>`、过渡动画 `<transition>`、KeepAlive
  - 测试覆盖：新增 73 个测试用例，代码覆盖率达到 85%

  ## vue-transform-tests

  为 Vue transform 模块添加完整的单元测试覆盖
  - 新增 57 个单元测试用例，覆盖 transform.ts 的所有核心函数
  - 测试内容包括：
    - transformScript：TypeScript 类型注解剥离、export default 转换
    - compileVueFile：完整 Vue SFC 编译（template、script、style、config）
    - compileConfigBlocks：JSON/JSONC/JSON5 配置块解析和合并
    - generateScopedId：Scoped ID 一致性和唯一性生成
    - 配置语言辅助函数：normalizeConfigLang、isJsonLikeLang、resolveJsLikeLang
  - 导出核心函数以支持单元测试
  - 添加边界值和错误场景测试（空文件、多个块、复杂类型等）
  - 所有测试均通过，核心函数代码覆盖率显著提升

  ## zh-auto-wevu-page-features

  weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

  ## zh-fix-template-cache-types

  修复 Vue 模板编译器的 TS 类型问题：调整 `lru-cache` 缓存的值类型以兼容 `lru-cache@11` 的泛型约束（不再使用 `null` 作为缓存值）。

  ## zh-perf-cache-wxml-and-asset

  优化编译阶段的性能与内存占用：
  - 修复 `FileCache` 在 LRU 淘汰/手动删除时未同步清理元数据导致的潜在内存增长。
  - `wxmlService.scan` 优先基于 `stat` 信息判断是否需要重新扫描，命中缓存时避免无意义的文件读取。
  - 静态资源收集改为延迟读取并增加并发上限，降低 `buildStart` 阶段的峰值内存与 I/O 压力。

  ## zh-perf-plugins-cache

  优化编译阶段插件性能：为文件读取/存在性检查增加轻量缓存，减少重复 I/O；同时修复带 query 的模块 id 在核心插件中导致部分页面模板未正确扫描的问题。
  - 补充 `plugins/utils/cache` 的单元测试与性能基准测试（`bench/cache.bench.ts`）。

  ## zh-slot-template-blocks-and-multiple-slots

  优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

  ## zh-wevu-component-only-pages

  wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

### Patch Changes

- 📦 Updated 4 dependencies [`488f8c4`](https://github.com/weapp-vite/weapp-vite/commit/488f8c4e62dcbd58a5b6823d97992680d077e4f7)

## 6.0.0-alpha.7

### Patch Changes

- 🐛 **修复 weapp-vite + wevu 在微信小程序中的两类常见问题：** [`a855a60`](https://github.com/weapp-vite/weapp-vite/commit/a855a601f40f4ae369ba35e2a1ec7ee78516f6f9) by @sonofmagic
  - `v-model`：不再生成 `bind:input="message = $event.detail.value"` 这类非法方法名，改为通过运行时方法 `__weapp_vite_model` 完成双向绑定。
  - `props`：补齐小程序 `properties` → `setup(props)` 绑定的同步与更新触发，避免模板里出现 `props.xxx` 为 `undefined`（尤其在 observer 回调时 `this.properties` 尚未更新的场景）。

- 🐛 **修复 Vue SFC `<script setup>` JSON 宏（`definePageJson/defineComponentJson/defineAppJson`）在 dev 下热更新不稳定、以及把配置从 `xxx1` 改回 `xxx` 时产物 `.json` 字段偶发丢失的问题：** [`8f6d11c`](https://github.com/weapp-vite/weapp-vite/commit/8f6d11cdd39011cac8008489238384b3480e330d) by @sonofmagic
  - 避免直接修改 `@vue/compiler-sfc` 的 `descriptor`（其内部存在 `parseCache`），防止缓存对象被污染导致宏被“永久剥离”。
  - 让宏内容变化能够稳定影响最终 JS 产物，从而触发增量构建与微信开发者工具刷新。

- 🐛 **优化编译阶段的性能与内存占用：** [`cfe2ca8`](https://github.com/weapp-vite/weapp-vite/commit/cfe2ca81dc7e5ba163a96ec6bc75bd0d08a7c1d3) by @sonofmagic
  - 修复 `FileCache` 在 LRU 淘汰/手动删除时未同步清理元数据导致的潜在内存增长。
  - `wxmlService.scan` 优先基于 `stat` 信息判断是否需要重新扫描，命中缓存时避免无意义的文件读取。
  - 静态资源收集改为延迟读取并增加并发上限，降低 `buildStart` 阶段的峰值内存与 I/O 压力。
- 📦 **Dependencies** [`a855a60`](https://github.com/weapp-vite/weapp-vite/commit/a855a601f40f4ae369ba35e2a1ec7ee78516f6f9)
  → `wevu@1.0.0-alpha.5`, `@weapp-core/init@3.0.8-alpha.1`

## 6.0.0-alpha.6

### Patch Changes

- 🐛 **修复 `<script setup>` 中 `defineExpose` 的编译产物处理：不再错误移除 `__expose({ ... })`，并将其对齐为 wevu `setup(_, { expose })` 的 `expose(...)` 调用，确保公开成员可被正确暴露。** [`e484974`](https://github.com/weapp-vite/weapp-vite/commit/e4849749f7a9d809f2740f120d5831990ec8482f) by @sonofmagic

- 🐛 **补齐 Vue `<script setup>` 宏与运行时兼容能力：** [`58bfb77`](https://github.com/weapp-vite/weapp-vite/commit/58bfb7703683f7908c81b6ee463a58075afe5472) by @sonofmagic
  - 支持 `defineModel()` / `defineSlots()`（将 Vue 编译产物中的 `useModel/mergeModels/useSlots/useAttrs` 迁移到 `wevu`）。
  - wevu 新增并导出 `useModel` / `mergeModels` / `useSlots` / `useAttrs` 兼容 API（用于承接 Vue SFC 编译产物）。
  - 模板事件绑定支持带 `:` 的事件名（如 `update:modelValue` 生成 `bind:update:modelValue`），确保 `defineModel` 的更新事件可在小程序端正常派发/监听。
- 📦 **Dependencies** [`58bfb77`](https://github.com/weapp-vite/weapp-vite/commit/58bfb7703683f7908c81b6ee463a58075afe5472)
  → `wevu@1.0.0-alpha.4`

## 6.0.0-alpha.5

### Patch Changes

- 🐛 **优化编译阶段插件性能：为文件读取/存在性检查增加轻量缓存，减少重复 I/O；同时修复带 query 的模块 id 在核心插件中导致部分页面模板未正确扫描的问题。** [`7cd5d89`](https://github.com/weapp-vite/weapp-vite/commit/7cd5d894b161839db97b02956e24bfdbef502200) by @sonofmagic
  - 补充 `plugins/utils/cache` 的单元测试与性能基准测试（`bench/cache.bench.ts`）。

## 6.0.0-alpha.4

### Minor Changes

- [`25bb59e`](https://github.com/weapp-vite/weapp-vite/commit/25bb59ef81b5c5e85a54919e874b720a7f4d558b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - weapp-vite 在编译阶段自动根据页面中使用的 wevu hooks（如 `onPageScroll` / `onShareAppMessage` 等）推断并注入对应 `features.enableOnXxx = true`，降低手动维护 `PageFeatures` 标志位的成本。
  - 同时支持 `.vue` SFC 页面与手写 `.ts/.js` 页面（仅在识别到 wevu 相关调用时才处理，不影响未使用 wevu 的页面）。
  - 显式写入的 `features` 不会被覆盖（可用 `false` 显式禁用）。

### Patch Changes

- [`c89c1cf`](https://github.com/weapp-vite/weapp-vite/commit/c89c1cfd65bf1c3f886305a4ff73a172e52dcc56) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 Vue 模板编译器的 TS 类型问题：调整 `lru-cache` 缓存的值类型以兼容 `lru-cache@11` 的泛型约束（不再使用 `null` 作为缓存值）。

- Updated dependencies [[`32b44ae`](https://github.com/weapp-vite/weapp-vite/commit/32b44aef543b981f74389ee23e8ae2b7d4ecd2af), [`25bb59e`](https://github.com/weapp-vite/weapp-vite/commit/25bb59ef81b5c5e85a54919e874b720a7f4d558b), [`7af6104`](https://github.com/weapp-vite/weapp-vite/commit/7af6104c5a4ddec0808f7336766adadae3c3801e)]:
  - wevu@1.0.0-alpha.3

## 6.0.0-alpha.3

### Patch Changes

- [`23bcc73`](https://github.com/weapp-vite/weapp-vite/commit/23bcc73282976463754f87ab1436481bbebb32c1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复小程序端 `script setup` 返回 `ref` 时更新不触发 UI 的问题：
  - wevu：运行时更新追踪补齐对 `setup` 返回 `ref/computedRef` 的依赖收集，`ref.value` 变化会触发 diff + `setData` 更新。
  - wevu：`ref/customRef` 默认 `markRaw`，避免被 `reactive()` 代理后影响内部依赖集合。
  - weapp-vite：npm 依赖缓存逻辑增强（非小程序包时对比入口文件时间戳），避免本地 workspace 包变更后仍复用旧的 `miniprogram_npm` 产物。

- Updated dependencies [[`e2fdc64`](https://github.com/weapp-vite/weapp-vite/commit/e2fdc643dc7224f398b4a21e2d3f55dec310dd8a), [`23bcc73`](https://github.com/weapp-vite/weapp-vite/commit/23bcc73282976463754f87ab1436481bbebb32c1), [`96a5161`](https://github.com/weapp-vite/weapp-vite/commit/96a516176d98344b4c1d5d9b70504b0032d138c9)]:
  - wevu@1.0.0-alpha.2

## 6.0.0-alpha.2

### Patch Changes

- [`aaed262`](https://github.com/weapp-vite/weapp-vite/commit/aaed2625429950566cde7ddbbe976af8db801dcb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化插槽/条件渲染兼容性：模板编译时，纯占位的 `<template>` 自动展开内容，带 `v-if/v-else(-if)` 等指令的 `<template>` 统一转换为 `<block>`（符合小程序条件语法），保留 `name/is/data` 或 `v-slot` 的模板实体；运行时组件默认开启 `multipleSlots`，仍支持用户显式覆盖。事件增强：内联 `@click="fn('ok', $event)"` 等表达式会编译为通用处理器并透传原生事件，常规事件默认仅接收原生事件参数。

- [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - wevu 页面/组件注册统一走小程序 `Component()`：移除 `definePage` 与 `defineComponent({ type: 'page' })` 写法，页面能力通过 `features` 声明（滚动/分享/收藏等）；同时 weapp-vite 默认处理 `.vue` 时会生成/合并 `json` 并强制写入 `"component": true`（即使未提供 `<json>`）；同步更新文档与 demo，并删除 `createApp().mount()` 相关文档描述。

- Updated dependencies [[`aaed262`](https://github.com/weapp-vite/weapp-vite/commit/aaed2625429950566cde7ddbbe976af8db801dcb), [`e9545a0`](https://github.com/weapp-vite/weapp-vite/commit/e9545a0120ca4183cb956395a53cea0e1d0f5f51)]:
  - wevu@1.0.0-alpha.1

## 6.0.0-alpha.1

### Patch Changes

- Updated dependencies [[`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26), [`a6b5bfb`](https://github.com/weapp-vite/weapp-vite/commit/a6b5bfb4b79da73cf29dc64d987248fac7832b26)]:
  - wevu@0.0.2-alpha.0

## 6.0.0-alpha.0

### Major Changes

- [`dcf920d`](https://github.com/weapp-vite/weapp-vite/commit/dcf920dda85bd4c74a7216bea81956126050f7b2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ## 重构 Vue 支持架构

  将 Vue SFC 支持完全集成到 `weapp-vite` 内部。

  ### 主要变更
  - ✅ **删除外置的 Vue 编译插件包**
    - 核心功能已完全迁移到 weapp-vite
    - 不再需要单独的 Vue 插件
  - ✅ **weapp-vite 内置 Vue 支持**
    - 自动处理 `.vue` 文件
    - 支持完整的 Vue SFC 编译
    - 支持 JS/TS 配置块
    - 更健壮的 Babel AST 转换
  - ✅ **Runtime API 导出**
    - `createWevuComponent` 可从 `weapp-vite` 和 `weapp-vite/runtime` 导入
    - 完整的 TypeScript 类型支持

  ### 迁移指南

  **之前（使用外置插件）：**

  ```typescript
  export default defineConfig({
    plugins: [
      /* 旧 Vue 插件 */
    ],
  });
  ```

  **现在（内置支持）：**

  ```typescript
  import { defineConfig } from "weapp-vite/config";

  export default defineConfig({
    weapp: {
      srcRoot: "src",
    },
    // Vue 文件自动处理，无需额外配置
  });
  ```

  ### Breaking Changes
  - 移除了外置 Vue 编译插件
  - demo 项目不再需要 pre 脚本来构建依赖
  - 依赖简化：`demo → weapp-vite → wevu`

  ### 测试

  所有 81 个测试通过 ✅

### Minor Changes

- [`91525a4`](https://github.com/weapp-vite/weapp-vite/commit/91525a42fd90c7813745ca4db04121fc2e7866cd) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 完整的 Vue SFC 单文件组件支持
  - 模板编译：使用 Vue compiler-core 替代正则表达式解析，支持完整的 Vue 3 模板语法
  - v-model 增强：支持所有输入类型（text、checkbox、radio、textarea、select、switch、slider、picker）
  - 样式处理：实现 CSS 到 WXSS 的转换，支持 Scoped CSS 和 CSS Modules
  - 插槽系统：支持默认插槽、具名插槽、作用域插槽和 fallback 内容
  - 高级特性：支持动态组件 `<component :is>`、过渡动画 `<transition>`、KeepAlive
  - 测试覆盖：新增 73 个测试用例，代码覆盖率达到 85%

### Patch Changes

- [`a2cbcc1`](https://github.com/weapp-vite/weapp-vite/commit/a2cbcc1f9e2360687a7ae585134882f9bd5d5265) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复在未开启 `weapp.autoRoutes` 时仍注册 auto-routes 插件导致的性能占比统计，并补充示例页的 `<json>` JS 写法使编译通过。

- [`ed25507`](https://github.com/weapp-vite/weapp-vite/commit/ed25507b3e97fcd2e0d7041dbaa3c3fb702847a0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复构建完成后进程仍然驻留的问题：显式关闭编译上下文的 watcher，并在退出时终止遗留的 sass-embedded 子进程，避免 pnpm build 卡住。

- [`b0863a5`](https://github.com/weapp-vite/weapp-vite/commit/b0863a581d87a6b77b87e3f82cac47af829e8002) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 移除未使用的 `weapp-vite:pre:take-query` 插件（及 `take:` 前缀解析）以降低构建插件开销，并同步示例特性文案。

- [`3919f14`](https://github.com/weapp-vite/weapp-vite/commit/3919f146b17b131ab25f3f18002324db2f6ba85e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown -> 1.0.0-beta.57 , vite -> 8.0.0-beta.5

- [`01d0ded`](https://github.com/weapp-vite/weapp-vite/commit/01d0dedec1ab85c0b7e5db0e87e82884f035ca15) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 统一 JSON Schema 定义来源，消除重复维护；移除编译产物中的 `$schema` 字段；修复 Vue SFC TypeScript 转换和运行时模块问题

  ### @weapp-core/schematics
  - 导出 `JSON_SCHEMA_DEFINITIONS`，供其他包使用
  - JSON Schema 现在只通过 Zod 在 `scripts/json.ts` 中维护单一数据源

  ### @weapp-vite/volar
  - 删除手写的 JSON Schema 定义（约 230 行）
  - 改为从 `@weapp-core/schematics` 导入 `JSON_SCHEMA_DEFINITIONS`
  - 确保与 schematics 包的 schema 定义始终同步

  ### weapp-vite
  - Vue SFC `<json>` 块编译时自动移除 `$schema` 字段
  - `$schema` 字段仅用于编辑器智能提示，不应出现在编译产物中
  - 修复 TypeScript `as` 类型断言移除逻辑
  - 修复正则表达式错误删除属性值的问题
  - 修复运行时模块解析问题：将 `createWevuComponent` 代码内联到每个页面文件

- [`d64e8ff`](https://github.com/weapp-vite/weapp-vite/commit/d64e8ff8f717bf1d51a918b1154218f589b217da) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 增强 Volar 插件配置块支持，完整实现 JSONC/JS/TS 配置模式

  ### @weapp-vite/volar
  - **新增 jsonc 支持**：`lang="jsonc"` 支持 JSON with Comments，可在配置中添加注释
  - **新增 js/ts 支持**：`lang="js"` 和 `lang="ts"` 支持使用 JavaScript/TypeScript 编写配置
  - **异步配置支持**：支持 `async` 函数动态生成配置，可使用 `await` 调用异步 API
  - **完整类型检查**：JS/TS 配置提供完整的 TypeScript 类型检查和智能提示
  - **类型推断**：根据文件路径自动推断配置类型（App/Page/Component）
  - **Schema 注入**：JSON/JSONC 模式下自动注入 `$schema` 字段

  ### weapp-vite
  - **集成 volar 插件**：通过 `weapp-vite/volar` 重新导出 volar 插件，无需单独安装
  - **自动依赖管理**：安装 weapp-vite 时自动获取 volar 智能提示功能
  - **构建时执行**：使用 rolldown-require 执行 JS/TS 配置块，支持异步函数

  ### wevu-comprehensive-demo
  - **添加配置示例**：更新 demo 页面展示各种配置模式的使用
    - `pages/basic` - jsonc 配置（带注释）
    - `pages/computed` - jsonc 配置（带 schema）
    - `pages/component` - jsonc 配置
    - `pages/watch` - js 配置
    - `pages/lifecycle` - ts 配置（带类型）
    - `pages/advanced` - 异步 ts 配置
  - **VSCode 配置**：添加 `.vscode/settings.json` 和 `.vscode/extensions.json`

  ### 配置模式对比

  | 模式           | 语法        | 智能提示       | 异步支持 | 适用场景                   |
  | -------------- | ----------- | -------------- | -------- | -------------------------- |
  | `lang="json"`  | JSON        | ✅ Schema      | ❌       | 简单静态配置               |
  | `lang="jsonc"` | JSON + 注释 | ✅ Schema      | ❌       | 带注释的静态配置           |
  | `lang="js"`    | JavaScript  | ✅ 类型        | ✅       | 动态配置、简单逻辑         |
  | `lang="ts"`    | TypeScript  | ✅ 类型 + 检查 | ✅       | 复杂动态配置、需要类型检查 |
  | 无 lang        | TypeScript  | ✅ 类型 + 检查 | ✅       | 默认模式，完整类型检查     |

- [`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 Vue 模板编译与 Volar 配置提示
  - 修正 v-for 场景下 :key 生成逻辑：当 :key 绑定循环项对象属性（如 item.id）时输出 `wx:key="id"`，当 :key 绑定 item 或 key 别名时输出 `wx:key="*this"`，避免小程序端 key 语义错误
  - 为 Vue 配置块（<json>）补充完整 TS/JS 智能提示：解析 default export 并注入带类型的辅助函数，规范语言解析（含 json/jsonc 降级），提升写配置时的补全与类型检查体验
  - 更新综合示例及构建输出，确保 demo 使用最新编译/提示行为

- [`abcd08a`](https://github.com/weapp-vite/weapp-vite/commit/abcd08ab146bd374e6aded8c7775f52dcc7d75de) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 为 Vue transform 模块添加完整的单元测试覆盖
  - 新增 57 个单元测试用例，覆盖 transform.ts 的所有核心函数
  - 测试内容包括：
    - transformScript：TypeScript 类型注解剥离、export default 转换
    - compileVueFile：完整 Vue SFC 编译（template、script、style、config）
    - compileConfigBlocks：JSON/JSONC/JSON5 配置块解析和合并
    - generateScopedId：Scoped ID 一致性和唯一性生成
    - 配置语言辅助函数：normalizeConfigLang、isJsonLikeLang、resolveJsLikeLang
  - 导出核心函数以支持单元测试
  - 添加边界值和错误场景测试（空文件、多个块、复杂类型等）
  - 所有测试均通过，核心函数代码覆盖率显著提升

- Updated dependencies [[`01d0ded`](https://github.com/weapp-vite/weapp-vite/commit/01d0dedec1ab85c0b7e5db0e87e82884f035ca15), [`d64e8ff`](https://github.com/weapp-vite/weapp-vite/commit/d64e8ff8f717bf1d51a918b1154218f589b217da), [`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59), [`9d4a8bd`](https://github.com/weapp-vite/weapp-vite/commit/9d4a8bd8b9d29274f9d3a75eaa20bfec27593e59)]:
  - @weapp-core/schematics@4.0.1-alpha.0
  - @weapp-vite/volar@0.1.0-alpha.0
  - @weapp-core/init@3.0.8-alpha.0

## 5.12.0

### Minor Changes

- [`84ec536`](https://github.com/weapp-vite/weapp-vite/commit/84ec536b29498a2b64d0c5a75a5f3d233b121279) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 重构 npm 构建：改用 Vite 库模式替代 tsdown，移除相关依赖并同步配置类型/文档说明。

### Patch Changes

- [`ba9496f`](https://github.com/weapp-vite/weapp-vite/commit/ba9496fd274b9a70468f83830373c7e7abd04332) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 5.11.4

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44)]:
  - weapp-ide-cli@4.1.2
  - @weapp-core/init@3.0.7
  - @weapp-vite/web@0.0.3

## 5.11.3

### Patch Changes

- [`fe93e13`](https://github.com/weapp-vite/weapp-vite/commit/fe93e13467c8a0db1fc7a24f438bcf7777862c82) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade deps

- [`6e4dd84`](https://github.com/weapp-vite/weapp-vite/commit/6e4dd8483e6ec7b42cbcd9c8ea067fbc07969506) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`fe93e13`](https://github.com/weapp-vite/weapp-vite/commit/fe93e13467c8a0db1fc7a24f438bcf7777862c82)]:
  - @weapp-core/init@3.0.6

## 5.11.2

### Patch Changes

- [`9a0fc27`](https://github.com/weapp-vite/weapp-vite/commit/9a0fc27488d46fab165d6bb8a6a75071224921e3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: use OIDC for ci publish

## 5.11.1

### Patch Changes

- [`98f7d7e`](https://github.com/weapp-vite/weapp-vite/commit/98f7d7e94766cdd05a08168c6f91c1e5bf059bba) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修正分包共享模块提升到主包时的日志，使用源码路径展示被提炼的模块，避免输出虚拟目录名，精简 `node_modules` 依赖显示。

- [`2c1b5d2`](https://github.com/weapp-vite/weapp-vite/commit/2c1b5d236992877a9efc2794585db236c74cf442) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown to 0.17.1 and vite to 8.0.0-beta.1

## 5.11.0

### Minor Changes

- [`43d79cc`](https://github.com/weapp-vite/weapp-vite/commit/43d79ccb9645fed733be9a034bd3e1d40832491b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade to vite@8.0.0-beta and tsdown 0.17.0

### Patch Changes

- [`3e379e4`](https://github.com/weapp-vite/weapp-vite/commit/3e379e4cedc1e6ae4a63850da4231534b2928367) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`1a71186`](https://github.com/weapp-vite/weapp-vite/commit/1a711865b415a0197e1b7017b98fb22a573bb8a6), [`3e379e4`](https://github.com/weapp-vite/weapp-vite/commit/3e379e4cedc1e6ae4a63850da4231534b2928367), [`adec557`](https://github.com/weapp-vite/weapp-vite/commit/adec557eaf08d9d0c05e55e5be20f05d4b3a8941), [`fa4bce0`](https://github.com/weapp-vite/weapp-vite/commit/fa4bce0dfd628a791f49f9249e0e05f54f76b6d7), [`fa4bce0`](https://github.com/weapp-vite/weapp-vite/commit/fa4bce0dfd628a791f49f9249e0e05f54f76b6d7), [`a560261`](https://github.com/weapp-vite/weapp-vite/commit/a5602611084a55c09ada38c7b5eafd8e376a44b5)]:
  - rolldown-require@1.0.6
  - weapp-ide-cli@4.1.1

## 5.10.0

### Minor Changes

- [`7a9b2e8`](https://github.com/weapp-vite/weapp-vite/commit/7a9b2e868bd06a7acb929ca0167fd3ae472e55ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 构建插件时自动读取 `project.config.json.pluginRoot`，并为插件与主小程序分别启动独立的 rolldown-vite 构建上下文，确保产物写入各自目录且互不干扰。

### Patch Changes

- [`835d07a`](https://github.com/weapp-vite/weapp-vite/commit/835d07a2a0bbd26a968ef11658977cbfed576354) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`ec736cd`](https://github.com/weapp-vite/weapp-vite/commit/ec736cd433fa344c7d10a96efe8af4ee899ba36b)]:
  - @weapp-core/init@3.0.5

## 5.9.5

### Patch Changes

- [`547f380`](https://github.com/weapp-vite/weapp-vite/commit/547f380a10af46a3c693957fd12878c76e2afb2b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 为自动导入新增 WeUI 解析器，默认生成 `mp-` 前缀映射（如 `mp-form` -> `weui-miniprogram/form/form`），并在生成脚本中忽略非组件目录。

- [`5932476`](https://github.com/weapp-vite/weapp-vite/commit/59324763fe05e99182b43614c947fb349d4179a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 为侧车 watcher 增加默认忽略目录并补充测试，减少无意义的文件监听负担。

## 5.9.4

### Patch Changes

- [`d3811f5`](https://github.com/weapp-vite/weapp-vite/commit/d3811f55016d8acef11a28b3515486ee9036d9b8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复共享 chunk 在降级回主包或被保留在主包时，入口脚本仍引用已删除的 `weapp_shared_virtual/*` 路径的问题，确保导入被重写为实际落盘的 `common.js` 文件。

- [`965f0c8`](https://github.com/weapp-vite/weapp-vite/commit/965f0c899e42af7fab45a6f5e3a6a64c946d72ec) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- [`274bdfe`](https://github.com/weapp-vite/weapp-vite/commit/274bdfeaa5f9b727cccce65adc016eaa8fd4d800) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 增强 `useExtendedLib.weui` 的处理逻辑，使全局启用后会默认允许 `weui-miniprogram` 组件并抑制无效的入口警告。

  link: https://github.com/weapp-vite/weapp-vite/issues/204

- Updated dependencies [[`965f0c8`](https://github.com/weapp-vite/weapp-vite/commit/965f0c899e42af7fab45a6f5e3a6a64c946d72ec)]:
  - @weapp-core/init@3.0.4

## 5.9.3

### Patch Changes

- [`fbc1e43`](https://github.com/weapp-vite/weapp-vite/commit/fbc1e438add0e230b439de38d9aa71a133c74321) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: refresh auto-import-components/builtin.auto.ts

- [`0259a17`](https://github.com/weapp-vite/weapp-vite/commit/0259a17018527d52df727c098045e208c048f476) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown

- [`6c0cbe2`](https://github.com/weapp-vite/weapp-vite/commit/6c0cbe2facf0a5537b8e0fcf23a1ae14b3b131df) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade rolldown-vite

- Updated dependencies [[`8bdcc85`](https://github.com/weapp-vite/weapp-vite/commit/8bdcc858b2f967c4b96ec997536c0ad5c8157aa7)]:
  - @weapp-core/init@3.0.3

## 5.9.2

### Patch Changes

- [`9ccf688`](https://github.com/weapp-vite/weapp-vite/commit/9ccf68806b487f1c1fbe30f3659b73c40fe774d8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复 rolldown 在 CJS 输出里对页面入口的隐式 `require()` 注入，确保 `app.js` 不会抢先执行页面脚本。

## 5.9.1

### Patch Changes

- [`4e4972f`](https://github.com/weapp-vite/weapp-vite/commit/4e4972f7531270c02b30a5032b1f7e1ce33b9daf) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 5.9.0

### Minor Changes

- [`1a96aed`](https://github.com/weapp-vite/weapp-vite/commit/1a96aed4c4eb0f9224cf5e1a058805d4bcb97aa7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 自动导入组件改为默认开启，自动扫描主包与各分包的 `components/` 目录，同时支持通过 `autoImportComponents: false` 或 `subPackages.<root>.autoImportComponents = false` 完全禁用该能力；同步更新示例与文档，方便分包独立维护自动导入策略。

### Patch Changes

- Updated dependencies [[`6a289f3`](https://github.com/weapp-vite/weapp-vite/commit/6a289f3d4ebe3dbc874f3f2650cfab1f330b5626)]:
  - weapp-ide-cli@4.1.0

## 5.8.0

### Minor Changes

- [`cdfe7a6`](https://github.com/weapp-vite/weapp-vite/commit/cdfe7a68bdd2a2c06fa5015cb88796af6bd7b8e1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 tsdown 到 0.16 升级 rolldown-vite 到 7.2.0

## 5.7.2

### Patch Changes

- [`9be5689`](https://github.com/weapp-vite/weapp-vite/commit/9be5689befeda4935296ebe58e2fcbfbf801fdec) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 `take:` 指令：在分包中通过 `import 'take:xxx'` 使用模块时，会强制将该模块复制到对应分包的 `weapp-shared/common.js`，即便全局共享策略为 `hoist`；若仍存在普通导入，构建日志会提示该模块同时保留在主包与相关分包中，便于后续重构。旧版 `?take` 语法仍兼容但会提示迁移。

## 5.7.1

### Patch Changes

- 默认将 `weapp.chunks.sharedStrategy` 切回 `hoist`，保持跨分包共享模块统一落到主包；若需要按分包复制，请在配置中显式设置 `sharedStrategy: 'duplicate'`。
- `hoist` 策略会根据源码所在目录决定共享产物位置：位于主包根目录的模块统一落到主包 `common.js`，位于分包目录的模块固定在对应分包，若被其它分包引用会直接报错，提示将共享代码移动到主包/公共目录。
<!--
- 支持在导入语句前加上 `take:` 指令强制将模块复制到当前分包：只要分包使用 `import 'take:foo'`，`foo` 就会复制到该分包的 `weapp-shared/common.js`，允许 `hoist` 策略下的按需复制；若同时存在普通导入，构建日志会提示代码既保留在主包也会复制到使用 `take:` 的分包。
- 模板项目默认在 `tsconfig.json` 中新增 `paths.take:@/*`，TypeScript 会自动把 `import 'take:foo'` 映射回原始模块，恢复类型提示。
  -->

- [`2ece3b4`](https://github.com/weapp-vite/weapp-vite/commit/2ece3b4cefce0f4e8e9af5ad16ad56328d71c6ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复共享 chunk duplicate 后仍指向 `weapp_shared_virtual` 的路径问题，确保入口脚本与 sourcemap 一并重写到各自分包的 `weapp-shared/common.js`。

## 5.7.0

### Minor Changes

- [`229a095`](https://github.com/weapp-vite/weapp-vite/commit/229a095a833f5118d81bb5b0ece17c89411690a5) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化共享 chunk 拆分：当模块仅被分包间接引用时不再强制回退主包，并新增 `weapp.chunks.forceDuplicatePatterns` 配置，支持以 glob/正则声明可复制到分包的共享目录，同时在构建日志中提示已忽略的伪主包引用；复制完成后会移除主包的虚拟共享产物，避免额外的 `weapp_shared_virtual/*` 文件膨胀主包体积。

- [`24975d8`](https://github.com/weapp-vite/weapp-vite/commit/24975d829cc39e524978c301253670d5ff1539b1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 `weapp-vite analyze` 命令，读取当前配置构建主包与各分包的产物映射，可输出 JSON 或写入指定文件，便于排查跨包复用的源码。

### Patch Changes

- [`c339914`](https://github.com/weapp-vite/weapp-vite/commit/c3399141671bdd34cc873a4aed7a85f47a9dc32b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重构 CLI 结构，拆分子命令与工具模块，提升可维护性与可读性。

- Updated dependencies [[`40c5dec`](https://github.com/weapp-vite/weapp-vite/commit/40c5dec63f8d1320d56849c7b1132fc33b788e98)]:
  - @weapp-vite/volar@0.0.2

## 5.6.3

### Patch Changes

- [`0e29cdd`](https://github.com/weapp-vite/weapp-vite/commit/0e29cdd3429eb222c0de764f2820b58028862845) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`352554a`](https://github.com/weapp-vite/weapp-vite/commit/352554ad802d1e5a1f4802a55dd257a9b32d1d18)]:
  - rolldown-require@1.0.5

## 5.6.2

### Patch Changes

- [`e001ba3`](https://github.com/weapp-vite/weapp-vite/commit/e001ba319ff954d9ca32dfca3145c1ade0f8e544) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown

## 5.6.1

### Patch Changes

- [`5e5497a`](https://github.com/weapp-vite/weapp-vite/commit/5e5497ac9cd4ba7aa659dc018c8fb87c498a5a2c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade rolldown-vite

- [`492fb95`](https://github.com/weapp-vite/weapp-vite/commit/492fb95e758872fce17beb318c2935114fec8bac) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复侧车样式新增/导入无法触发热更新的问题，补充 @import/@wv-keep-import 依赖追踪与日志输出。

- [`e138483`](https://github.com/weapp-vite/weapp-vite/commit/e138483964a5288517abe98d77d02b7a56ea4d0c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown

## 5.6.0

### Minor Changes

- [`e902fae`](https://github.com/weapp-vite/weapp-vite/commit/e902faefd4da777dc80a38619163d893d0b6e9cf) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 优化 weapp-vite 构建与 npm 流程

- [`51a403a`](https://github.com/weapp-vite/weapp-vite/commit/51a403a40f7346c2c52349f6c249cc31fe2c8e3f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 允许 `weapp.subPackages[*].styles` 支持 Sass/Less/Stylus 等多种格式，并落到共享样式注入流程。
  - 新增 include/exclude 精准控制分包共享样式范围，可脱离 `scope` 单独配置。
  - 若分包根目录存在 `index.*`、`pages.*`、`components.*` 样式文件，自动推导共享样式的作用范围（默认扫描 `.wxss`/`.css`）。
  - 在 bundle 阶段自动为页面 chunk 注入共享样式 import，确保生成的 `.wxss` 与 `.js` 同步落盘。
  - Sass 预处理默认使用 `sass`，迁移到 Vite `preprocessCSS` 管线，可选安装 `sass-embedded` 获得原生性能，避免构建环境缺少依赖时抛错。
  - 自动路由服务复用候选缓存与增量更新，监听性能更好，并兼容 `rename` 事件的同步。
  - 演示项目新增 Tailwind 分包案例，覆盖共享样式与多格式混合的实战场景。
  - 文档补充完整签名与复杂示例，说明多格式及 `sass-embedded` 支持。

### Patch Changes

- [`38b486d`](https://github.com/weapp-vite/weapp-vite/commit/38b486d05d81fc5635a449f611fa2e6131af7823) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 使用 `fdir` 扫描自动路由候选并缓存共享样式结果，减少多余 IO 和重复预处理。
  - 优化模板创建时的文件读写路径检测，避免额外的文件状态查询。

- [`0cafd50`](https://github.com/weapp-vite/weapp-vite/commit/0cafd500ac4fed4d88b337d597441bf1bd2d4533) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 修复 macOS Finder / VS Code 删除样式文件后不触发热更新的问题，侧车监听会及时触发入口刷新。
  - 即便样式文件暂时缺失，入口加载器也会持续监听对应路径，恢复文件时能重新注入样式并触发 HMR。

- [`a9f7df9`](https://github.com/weapp-vite/weapp-vite/commit/a9f7df95603d7919d946ce5989b56d43d0e9540e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复独立分包在 IDE 中被误判为保留目录的问题，统一将共享目录重命名为 `weapp-shared`，确保 rolldown 独立构建与微信开发者工具兼容。

  新增分包配置 `watchSharedStyles`（默认开启），在 TailwindCSS 等按需生成样式的场景下，独立分包改动可立即刷新共享样式产物，无需重新全量构建。

  重置 Tailwind JIT 缓存以兼容 v3/v4，在共享样式热更新时自动清除 `sharedState` 上下文，确保新增原子类即时生效。

- Updated dependencies [[`38b486d`](https://github.com/weapp-vite/weapp-vite/commit/38b486d05d81fc5635a449f611fa2e6131af7823)]:
  - @weapp-core/init@3.0.2

## 5.5.1

### Patch Changes

- [`f9355da`](https://github.com/weapp-vite/weapp-vite/commit/f9355dabc3696fe27db3e0b12e061b4c9f7018ac) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 拆分配置服务的实现，将 `configPlugin` 内部逻辑移动到 `createConfigService` 与多文件协作并补充文档说明新的模块职责。

- [`3674faf`](https://github.com/weapp-vite/weapp-vite/commit/3674faf03a40f140603b4c0fd64eb30637fad7f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 默认在构建日志里提示分包共享代码的复制与回退情况，并提供 `weapp.chunks.logOptimization` 开关以便按需关闭。

- [`989ce80`](https://github.com/weapp-vite/weapp-vite/commit/989ce807f1985050491024badba207c9eb287786) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 支持通过 `weapp.pluginRoot` 启用微信小程序插件编译链路，修复插件 WXSS 路径导致的源目录污染，并补充插件开发示例与中文指引。\*\*\*

## 5.5.0

### Minor Changes

- [`7e208dd`](https://github.com/weapp-vite/weapp-vite/commit/7e208dd613583e02bd740480979888e72e862287) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 默认分包共享模块的拆分策略由提炼到主包(`hoist`) 调整为按分包复制(`duplicate`)，跨分包复用的 `common.js` 将输出到各自分包的 `__shared__` 目录。若需要保持旧行为，请在 `vite.config.ts` 中设置 `weapp.chunks.sharedStrategy = 'hoist'`。

### Patch Changes

- [`ebd4035`](https://github.com/weapp-vite/weapp-vite/commit/ebd40358e2b5738b93fb70349d442f5853de9ede) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复开发与生产构建中透传到 Rolldown 的配置类型，使其保持与新版类型系统兼容。

## 5.4.0

### Minor Changes

- [`64f1955`](https://github.com/weapp-vite/weapp-vite/commit/64f19550b0cfcda9d2acb530e8345a98a891404a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 `typed-components.d.ts` 生成能力（需配置 `weapp.autoImportComponents.typedComponents`），并完善 `typed-router.d.ts` 输出，便于 WXML 补全与路由智能提示。

- [`18c8c66`](https://github.com/weapp-vite/weapp-vite/commit/18c8c66db5f49dbc1f413209c1bbca90e0777545) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 新增 `weapp.wxml`、`weapp.wxs` 与 `weapp.autoImportComponents` 顶层配置，并保留 `weapp.enhance` 作为兼容用法，发出废弃提示
  - 更新自动导入与 WXML 运行时代码，以优先读取新字段并兼容旧配置，确保增强能力行为一致
  - 修正相关测试与工具脚本的日志和排序规则，使 ESLint 与 TypeScript 校验在当前变更上通过

- [`252b807`](https://github.com/weapp-vite/weapp-vite/commit/252b80772508ef57a0dc533febddc1a1e69aa4c2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增 autoImportComponents.htmlCustomData 选项，支持在 VS Code 等编辑器中生成小程序组件的 HTML Custom Data；同时扩展 H5 运行时对多种模板后缀的识别能力，使 `.html` 等模板与小程序组件共用自动导入机制。

### Patch Changes

- [`84fc3cc`](https://github.com/weapp-vite/weapp-vite/commit/84fc3cc1e04169e49878f85825a3c02c057337fb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

- Updated dependencies [[`32949af`](https://github.com/weapp-vite/weapp-vite/commit/32949afff0c5cd4f410062209e504fef4cc56a4a), [`252b807`](https://github.com/weapp-vite/weapp-vite/commit/252b80772508ef57a0dc533febddc1a1e69aa4c2)]:
  - rolldown-require@1.0.4
  - @weapp-vite/web@0.0.2

## 5.3.0

### Minor Changes

- [`3d5c3bc`](https://github.com/weapp-vite/weapp-vite/commit/3d5c3bcbd1607afe0454c382e483810b8df05415) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持在项目中提供 `weapp-vite.config.ts`（等同扩展名）并与现有 `vite.config.*` 的 `weapp` 配置自动合并，同时导出 `WeappViteConfig` 类型

### Patch Changes

- [`465f5c1`](https://github.com/weapp-vite/weapp-vite/commit/465f5c155199049fb5033cc94b583d0a4e3aba2a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 为 `weapp.enhance.autoImportComponents` 新增自动生成 `auto-import-components.json` 清单功能，支持通过 `output` 字段配置输出路径或关闭生成，同时内置解析器会将所有可自动导入的第三方组件写入清单，便于 IDE 补全及调试。

## 5.2.3

### Patch Changes

- [`5e8afee`](https://github.com/weapp-vite/weapp-vite/commit/5e8afee94c681c18efd2faeb5320713a5849b9b0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 优化 weapp-vite 的构建缓存与 WXML 处理路径，降低重复 I/O 与解析成本。

## 5.2.2

### Patch Changes

- [`ff57f89`](https://github.com/weapp-vite/weapp-vite/commit/ff57f89fc7de90aad2c7429d0be19d5044bb2b76) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 整理 `configPlugin` 的内置别名逻辑，提取 @oxc-project/runtime 与 class-variance-authority 的处理，修复类型声明并避免外部构建解析报错。

## 5.2.1

### Patch Changes

- [`2d86964`](https://github.com/weapp-vite/weapp-vite/commit/2d869640ad9775c48e07e905b92088bc7c7e1a2f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 修复在新增或删除 JSON/JSON.ts/JSONC 以及 WXSS 等 sidecar 文件时热更新失效的问题，通过触发所属脚本的重新构建，并补充相关单元测试覆盖 watcher 行为。

- Updated dependencies [[`2d86964`](https://github.com/weapp-vite/weapp-vite/commit/2d869640ad9775c48e07e905b92088bc7c7e1a2f)]:
  - @weapp-core/init@3.0.1

## 5.2.0

### Minor Changes

- [`6e18aff`](https://github.com/weapp-vite/weapp-vite/commit/6e18aff6143db9f604589c76b9ad511be070b669) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat(weapp-vite): 新增可配置的 generate 模板，支持内联字符串、外部文件以及工厂函数；同步导出相关类型，并在文档站补充使用说明，同时扩充脚手架测试覆盖共享与按类型自定义的模板场景。

  https://github.com/weapp-vite/weapp-vite/discussions/178

- [`12ae777`](https://github.com/weapp-vite/weapp-vite/commit/12ae777ecc390f0a3f16d055a2a83e3e79e3ccf8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重构：移除 Inversify 容器，改由运行时 Vite 插件在编译上下文中注册共享服务
  - 新增：从 `@weapp-vite/context` 导出新的运行时服务接口，并在 CLI 与上下文初始化流程中接入
  - 清理：删除依赖装饰器与 Inversify 的旧版 IoC/Chokidar 测试与样例

- [`5998367`](https://github.com/weapp-vite/weapp-vite/commit/599836741acc1a30dda9f67ba6a0868cb8c77b0b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat(weapp-vite): 在解析 `app.json` 时将 `plugins.export` 识别为构建入口，主包与分包插件均生效，复用统一的入口收集逻辑并适配 `.ts`/`.js` 查找
  - test(weapp-vite): 增补 analyze 与 scan 服务的插件导出用例，覆盖子包场景
  - chore(weapp-vite): CSS 插件使用 rolldown 导出的 Output 类型，保持运行时与类型来源一致

### Patch Changes

- [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

- [`96c205d`](https://github.com/weapp-vite/weapp-vite/commit/96c205dd463b3e3c7190c386bf06211a473c32ae) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 导出 vite 相关类型

  https://github.com/weapp-vite/weapp-vite/discussions/179

- Updated dependencies [[`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91), [`eda9720`](https://github.com/weapp-vite/weapp-vite/commit/eda97203171f116783181483600cc82dd27ae102), [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547), [`284e0a2`](https://github.com/weapp-vite/weapp-vite/commit/284e0a29ea3fa3e66b8c2659eba40aea6ee893e0), [`896e5b9`](https://github.com/weapp-vite/weapp-vite/commit/896e5b95069c8f430467a8b5bd4f9d50a26517e2)]:
  - @weapp-core/init@3.0.0
  - weapp-ide-cli@4.0.0
  - @weapp-core/schematics@4.0.0
  - vite-plugin-performance@1.0.0

## 5.2.0-alpha.0

### Minor Changes

- [`6e18aff`](https://github.com/weapp-vite/weapp-vite/commit/6e18aff6143db9f604589c76b9ad511be070b669) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat(weapp-vite): 新增可配置的 generate 模板，支持内联字符串、外部文件以及工厂函数；同步导出相关类型，并在文档站补充使用说明，同时扩充脚手架测试覆盖共享与按类型自定义的模板场景。

  https://github.com/weapp-vite/weapp-vite/discussions/178

- [`12ae777`](https://github.com/weapp-vite/weapp-vite/commit/12ae777ecc390f0a3f16d055a2a83e3e79e3ccf8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - 重构：移除 Inversify 容器，改由运行时 Vite 插件在编译上下文中注册共享服务
  - 新增：从 `@weapp-vite/context` 导出新的运行时服务接口，并在 CLI 与上下文初始化流程中接入
  - 清理：删除依赖装饰器与 Inversify 的旧版 IoC/Chokidar 测试与样例

- [`5998367`](https://github.com/weapp-vite/weapp-vite/commit/599836741acc1a30dda9f67ba6a0868cb8c77b0b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat(weapp-vite): 在解析 `app.json` 时将 `plugins.export` 识别为构建入口，主包与分包插件均生效，复用统一的入口收集逻辑并适配 `.ts`/`.js` 查找
  - test(weapp-vite): 增补 analyze 与 scan 服务的插件导出用例，覆盖子包场景
  - chore(weapp-vite): CSS 插件使用 rolldown 导出的 Output 类型，保持运行时与类型来源一致

### Patch Changes

- [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

- [`96c205d`](https://github.com/weapp-vite/weapp-vite/commit/96c205dd463b3e3c7190c386bf06211a473c32ae) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 导出 vite 相关类型

  https://github.com/weapp-vite/weapp-vite/discussions/179

- Updated dependencies [[`fcf0e75`](https://github.com/weapp-vite/weapp-vite/commit/fcf0e75cb4ce73d4841676353a0b95d1d044db91), [`eda9720`](https://github.com/weapp-vite/weapp-vite/commit/eda97203171f116783181483600cc82dd27ae102), [`9f6a432`](https://github.com/weapp-vite/weapp-vite/commit/9f6a43229af6b6f57a05c35216660a025a83a547), [`284e0a2`](https://github.com/weapp-vite/weapp-vite/commit/284e0a29ea3fa3e66b8c2659eba40aea6ee893e0), [`896e5b9`](https://github.com/weapp-vite/weapp-vite/commit/896e5b95069c8f430467a8b5bd4f9d50a26517e2)]:
  - @weapp-core/init@3.0.0-alpha.0
  - weapp-ide-cli@4.0.0-alpha.0
  - @weapp-core/schematics@4.0.0-alpha.0
  - vite-plugin-performance@1.0.0-alpha.0

## 5.1.8

### Patch Changes

- [`18cc326`](https://github.com/weapp-vite/weapp-vite/commit/18cc3267edc73919ebccfd6d48ef6255481c0342) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

- [`9f14216`](https://github.com/weapp-vite/weapp-vite/commit/9f142162dd7dc28a576e7f9617e4b57adfa59048) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade tsdown to 0.15.3

- Updated dependencies [[`576c8e1`](https://github.com/weapp-vite/weapp-vite/commit/576c8e1f5a143031ed3c321bf25a8e66a0d8c043), [`9f14216`](https://github.com/weapp-vite/weapp-vite/commit/9f142162dd7dc28a576e7f9617e4b57adfa59048)]:
  - @weapp-core/init@2.1.5

## 5.1.7

### Patch Changes

- [#175](https://github.com/weapp-vite/weapp-vite/pull/175) [`700e5ef`](https://github.com/weapp-vite/weapp-vite/commit/700e5ef0e44a680ff08d94a91680fb30588821fc) Thanks [@mayphus](https://github.com/mayphus)! - fix: support --config/-c option for custom config files

- [`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745)]:
  - weapp-ide-cli@3.1.1
  - @weapp-core/init@2.1.4

## 5.1.6

### Patch Changes

- [`0e52d23`](https://github.com/weapp-vite/weapp-vite/commit/0e52d236e666753c76b8fb23cc65173b46d0cb8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 tsdown 的版本

- [`4a816f4`](https://github.com/weapp-vite/weapp-vite/commit/4a816f4c42084ef301f4c5b64f20595d7be8f62f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更新 rolldown-vite 版本到 `7.1.9`

- Updated dependencies [[`0e52d23`](https://github.com/weapp-vite/weapp-vite/commit/0e52d236e666753c76b8fb23cc65173b46d0cb8a), [`4a816f4`](https://github.com/weapp-vite/weapp-vite/commit/4a816f4c42084ef301f4c5b64f20595d7be8f62f)]:
  - @weapp-core/init@2.1.3

## 5.1.5

### Patch Changes

- [`fc25982`](https://github.com/weapp-vite/weapp-vite/commit/fc25982655cf40e16b3403a3d5102b5715dfbe7b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本

## 5.1.4

### Patch Changes

- [`b82e7c1`](https://github.com/weapp-vite/weapp-vite/commit/b82e7c1cec14e53ffba0edab8bccf70062fbfc86) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: dev 开发模式下默认开启 sourcemap

- [`83b7aeb`](https://github.com/weapp-vite/weapp-vite/commit/83b7aeb54df698b9314f6e702093fdb378bf2a4c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持独立分包使用单独的 vite inlineConfig

- Updated dependencies [[`3f0b3a2`](https://github.com/weapp-vite/weapp-vite/commit/3f0b3a2fb8dfbb83cd83e3b005ab3e9ccd2d4480)]:
  - @weapp-core/init@2.1.2

## 5.1.3

### Patch Changes

- [`5e344b5`](https://github.com/weapp-vite/weapp-vite/commit/5e344b56d6d5039270ba63876fbebd364fbcb106) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 优化分包 chunk 的策略

  当一个模块全部被分包中的代码引入的场景下，这个模块会被打入到分包中。

  当同时被分包，主包，或者其他分包使用的时候，这个会被打入到主包中去。

  https://github.com/weapp-vite/weapp-vite/discussions/150

## 5.1.2

### Patch Changes

- [`d8523bb`](https://github.com/weapp-vite/weapp-vite/commit/d8523bbf20a22abe5399808060da8854d0cfe68e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 默认提炼多次引入的 import 到 common.js 中

- Updated dependencies [[`d8523bb`](https://github.com/weapp-vite/weapp-vite/commit/d8523bbf20a22abe5399808060da8854d0cfe68e)]:
  - @weapp-core/init@2.1.1

## 5.1.1

### Patch Changes

- Updated dependencies [[`1d9952b`](https://github.com/weapp-vite/weapp-vite/commit/1d9952b8968dbd0c84b2d481383b6de8b3e701b5), [`2bda01c`](https://github.com/weapp-vite/weapp-vite/commit/2bda01c969c33c858e3dd30f617de232ba149857)]:
  - weapp-ide-cli@3.1.0
  - rolldown-require@1.0.3

## 5.1.0

### Minor Changes

- [`ef98c7d`](https://github.com/weapp-vite/weapp-vite/commit/ef98c7d5f4e7e9836f4e4c21ae80fae4581deb7a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 使用 `rolldown` 的 `advancedChunks` 优化代码块的拆分

  feat: 取消 `chunk` `hash` 的生成，避免开发者工具频繁清除缓存

  [#142](https://github.com/weapp-vite/weapp-vite/issues/142)

### Patch Changes

- Updated dependencies [[`ef98c7d`](https://github.com/weapp-vite/weapp-vite/commit/ef98c7d5f4e7e9836f4e4c21ae80fae4581deb7a)]:
  - @weapp-core/init@2.1.0

## 5.0.17

### Patch Changes

- [`9f1fc1b`](https://github.com/weapp-vite/weapp-vite/commit/9f1fc1b3f8e967b7c8fdfb2ae30b192290e2afca) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 版本到 7.1.4

## 5.0.16

### Patch Changes

- [`0cbd148`](https://github.com/weapp-vite/weapp-vite/commit/0cbd14877233fefd86720a818e1b9e79a7c3eb68) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持配置使用 jsonc 格式

## 5.0.15

### Patch Changes

- [`ca54a61`](https://github.com/weapp-vite/weapp-vite/commit/ca54a61b631a95b9ac4d220ccbf034a6d4dd4607) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown-vite 到 7.1.0

- [`bd1f447`](https://github.com/weapp-vite/weapp-vite/commit/bd1f447a7ad7a3cf3d1a038346d59e1c3a965854) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - chore: 升级 tsdown 到 0.13.4
  - feat: `vite.config.ts` 在 `dev/build` 模式下默认的 `mode` 各自为 `development` 和 `production`

## 5.0.14

### Patch Changes

- [`c4bf379`](https://github.com/weapp-vite/weapp-vite/commit/c4bf3796f07e2e93720601aee339bec5e8bd5038) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- [`66a2df2`](https://github.com/weapp-vite/weapp-vite/commit/66a2df2c484666f4d715b0d450a7e0925e10a273) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 tsdown 版本

- [`26e25bb`](https://github.com/weapp-vite/weapp-vite/commit/26e25bbcd71e834ad0d3791816cb90bd3deca122) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- [`6f4096e`](https://github.com/weapp-vite/weapp-vite/commit/6f4096e2a9fa0d7b287b2d07b42b58999d7caa7f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- [`911940f`](https://github.com/weapp-vite/weapp-vite/commit/911940f8560c9243e652ad301b43c32e8039f97a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复在 generateBundle 阶段直接给 bundle 赋值的问题

  fix: dist 目录清理问题 [weapp-vite/weapp-vite/pull/152](https://github.com/weapp-vite/weapp-vite/pull/152)

- Updated dependencies [[`66a2df2`](https://github.com/weapp-vite/weapp-vite/commit/66a2df2c484666f4d715b0d450a7e0925e10a273), [`26e25bb`](https://github.com/weapp-vite/weapp-vite/commit/26e25bbcd71e834ad0d3791816cb90bd3deca122), [`6f4096e`](https://github.com/weapp-vite/weapp-vite/commit/6f4096e2a9fa0d7b287b2d07b42b58999d7caa7f)]:
  - @weapp-core/init@2.0.9

## 5.0.13

### Patch Changes

- [`c0137f1`](https://github.com/weapp-vite/weapp-vite/commit/c0137f1009b96a6d68555a54f5b64a843bfad431) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: use target: ['es2015']

- [`40aa53d`](https://github.com/weapp-vite/weapp-vite/commit/40aa53dada7bf03096f6382964bf66253e2bd839) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: support es6 new class 语法

  https://github.com/weapp-vite/weapp-vite/issues/147

- Updated dependencies [[`c0137f1`](https://github.com/weapp-vite/weapp-vite/commit/c0137f1009b96a6d68555a54f5b64a843bfad431), [`40aa53d`](https://github.com/weapp-vite/weapp-vite/commit/40aa53dada7bf03096f6382964bf66253e2bd839)]:
  - @weapp-core/init@2.0.8

## 5.0.12

### Patch Changes

- [`6f921e7`](https://github.com/weapp-vite/weapp-vite/commit/6f921e7c4483afbb665db7c385f1ada8d0f23d17) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add miss dep oxc-parser

## 5.0.11

### Patch Changes

- [`9a2a21f`](https://github.com/weapp-vite/weapp-vite/commit/9a2a21f8c472aeb95a0192983275eddc85f5f37b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 5.0.10

### Patch Changes

- [`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`966853e`](https://github.com/weapp-vite/weapp-vite/commit/966853e32e2805bc5a4b372f72586c60955926f1)]:
  - @weapp-core/init@2.0.7

## 5.0.9

### Patch Changes

- [`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 升级 rolldown 和 rolldown vite 版本

- Updated dependencies [[`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821), [`b8e58c3`](https://github.com/weapp-vite/weapp-vite/commit/b8e58c38b0c95a2440601879e98511e08d90d821)]:
  - @weapp-core/init@2.0.6
  - @weapp-core/schematics@3.0.0

## 5.0.8

### Patch Changes

- [`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade 升级依赖版本

- [`975ef00`](https://github.com/weapp-vite/weapp-vite/commit/975ef001277f596012ee115eb154140e41c19e72) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump version

- Updated dependencies [[`f1fd325`](https://github.com/weapp-vite/weapp-vite/commit/f1fd3250cfec6a508535618169de0f136ec5cbc2), [`975ef00`](https://github.com/weapp-vite/weapp-vite/commit/975ef001277f596012ee115eb154140e41c19e72)]:
  - @weapp-core/init@2.0.5

## 5.0.7

### Patch Changes

- [`a057ad7`](https://github.com/weapp-vite/weapp-vite/commit/a057ad77107f757aa7dd185b18ff05635d945f54) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: JsonService 添加基于 mtime 的 FileCache 加快热更新速度

- [`3af287e`](https://github.com/weapp-vite/weapp-vite/commit/3af287ea2d35b309d9891d02242d551ef14f3a2e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump `rolldown-vite` and `rolldown` version

- Updated dependencies [[`3af287e`](https://github.com/weapp-vite/weapp-vite/commit/3af287ea2d35b309d9891d02242d551ef14f3a2e)]:
  - @weapp-core/init@2.0.4

## 5.0.6

### Patch Changes

- [`2c5a063`](https://github.com/weapp-vite/weapp-vite/commit/2c5a063fce61ab7248fe5cf4d42414c8c6fa8c36) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade rolldown version

## 5.0.5

### Patch Changes

- [`4ef7c3d`](https://github.com/weapp-vite/weapp-vite/commit/4ef7c3d3480fce8f8c241f3e1e1238628313350d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#136](https://github.com/weapp-vite/weapp-vite/issues/136)

- Updated dependencies [[`4ef7c3d`](https://github.com/weapp-vite/weapp-vite/commit/4ef7c3d3480fce8f8c241f3e1e1238628313350d)]:
  - @weapp-core/init@2.0.3

## 5.0.4

### Patch Changes

- [`a59845c`](https://github.com/weapp-vite/weapp-vite/commit/a59845c085a2484a29dd19d51ebef5f48e875dc1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade rolldown-vite

- [`9201535`](https://github.com/weapp-vite/weapp-vite/commit/92015355afe816d4ce2fa3925fb1f04aa0b8211b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade to rolldown 1.0.0-beta.16

- [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: change website url

- Updated dependencies [[`a59845c`](https://github.com/weapp-vite/weapp-vite/commit/a59845c085a2484a29dd19d51ebef5f48e875dc1), [`0ae2a53`](https://github.com/weapp-vite/weapp-vite/commit/0ae2a53198b8d3ab3e8a9ac18ee125e2017a8f51)]:
  - @weapp-core/init@2.0.2
  - @weapp-core/schematics@2.0.1

## 5.0.3

### Patch Changes

- [`7a8a130`](https://github.com/weapp-vite/weapp-vite/commit/7a8a130aff74304bb59ca9d2783783c81850c3f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#129](https://github.com/weapp-vite/weapp-vite/issues/129)

  修复 `autoImportComponents` 功能并未按预期自动导入并编译问题

- Updated dependencies [[`7a8a130`](https://github.com/weapp-vite/weapp-vite/commit/7a8a130aff74304bb59ca9d2783783c81850c3f0)]:
  - @weapp-core/shared@2.0.1
  - @weapp-core/init@2.0.1

## 5.0.2

### Patch Changes

- [`1ad45c3`](https://github.com/weapp-vite/weapp-vite/commit/1ad45c3f36e8e23a54b15afc81a0b81a94c7acb7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat(rolldown-require): add `rolldownOptions` `input` and `output` options
  - chore: set `rolldown` `outputOptions.exports` default value as `named`
- Updated dependencies [[`1ad45c3`](https://github.com/weapp-vite/weapp-vite/commit/1ad45c3f36e8e23a54b15afc81a0b81a94c7acb7)]:
  - rolldown-require@1.0.2

## 5.0.1

### Patch Changes

- Updated dependencies [[`e2cd39d`](https://github.com/weapp-vite/weapp-vite/commit/e2cd39def4b893c8f06be955fafe55744365b810)]:
  - rolldown-require@1.0.1

## 5.0.0

### Major Changes

- [`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 使用 tsdown 全面替换 tsup , 去除 esbuild 依赖
  feat!: use `rolldown-require` instead of `bundle-require` and remove `esbuild`

- [`8fcd092`](https://github.com/weapp-vite/weapp-vite/commit/8fcd092e06ab8807e2734016ec003ddab071e6e8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 全量切换到 rolldown-vite

  # weapp-vite 切换到 rolldown-vite

  迁移过程非常平滑，只改了部分 watcher 相关的使用代码的实现 (因为 rolldown watcher 没有 onCurrentRun 方法了)

  然后我以我一个复杂的测试案例进行性能测试，主包有 726 个模块，独立分包有 643 个模块，测试结果如下：

  整体平均构建时间提升：约 1.86 倍

  热更新平均构建时间提升：约 2.50 倍

  vite 的整体平均构建时间为 4302.26 ms, 构建热更新平均构建时间为 2216.58 ms

  切换到 rolldown-vite 后，整体平均构建时间为 2317.75 ms, 构建热更新平均构建时间为 887.56 ms

- [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 更多详情见:

  https://vite.icebreaker.top/migration/v5.htm

### Patch Changes

- Updated dependencies [[`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef), [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4)]:
  - @weapp-core/init@2.0.0
  - @weapp-core/logger@2.0.0
  - @weapp-core/schematics@2.0.0
  - @weapp-core/shared@2.0.0
  - weapp-ide-cli@3.0.0

## 5.0.0-beta.0

### Major Changes

- [`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 使用 tsdown 全面替换 tsup , 去除 esbuild 依赖
  feat!: use `rolldown-require` instead of `bundle-require` and remove `esbuild`

- [`8fcd092`](https://github.com/weapp-vite/weapp-vite/commit/8fcd092e06ab8807e2734016ec003ddab071e6e8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: 全量切换到 rolldown-vite

  # weapp-vite 切换到 rolldown-vite

  迁移过程非常平滑，只改了部分 watcher 相关的使用代码的实现 (因为 rolldown watcher 没有 onCurrentRun 方法了)

  然后我以我一个复杂的测试案例进行性能测试，主包有 726 个模块，独立分包有 643 个模块，测试结果如下：

  整体平均构建时间提升：约 1.86 倍

  热更新平均构建时间提升：约 2.50 倍

  vite 的整体平均构建时间为 4302.26 ms, 构建热更新平均构建时间为 2216.58 ms

  切换到 rolldown-vite 后，整体平均构建时间为 2317.75 ms, 构建热更新平均构建时间为 887.56 ms

### Patch Changes

- Updated dependencies [[`0fefeca`](https://github.com/weapp-vite/weapp-vite/commit/0fefeca50752fc33ecb5403072f0f863b04686ef)]:
  - @weapp-core/init@2.0.0-beta.0

## 4.1.2

### Patch Changes

- Updated dependencies [[`8c61a0f`](https://github.com/weapp-vite/weapp-vite/commit/8c61a0fb12298b90cf0f0aeebcea8d42aa2afd3a)]:
  - @weapp-core/init@1.2.2

## 4.1.1

### Patch Changes

- [`a9c1c9e`](https://github.com/weapp-vite/weapp-vite/commit/a9c1c9e3ff5e7312effa85c3be92eb6647b07fcc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 增加插件开发的 `export` 作为打包入口，同时编译到产物中去

- Updated dependencies [[`a9c1c9e`](https://github.com/weapp-vite/weapp-vite/commit/a9c1c9e3ff5e7312effa85c3be92eb6647b07fcc), [`953b105`](https://github.com/weapp-vite/weapp-vite/commit/953b105562fc559ddd811f8dfffcd71c19eedfde)]:
  - @weapp-core/init@1.2.1
  - @weapp-core/schematics@1.1.0

## 4.1.0

### Minor Changes

- [`512d3c7`](https://github.com/weapp-vite/weapp-vite/commit/512d3c76def28c90ec6d2f9f9e182595be39867b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 重构微信小程序 `worker` 的处理策略

  现在需要在 `vite.config.js` 中配置 `worker` 的路径，如：

  ```ts
  import { defineConfig } from "weapp-vite/config";

  export default defineConfig({
    weapp: {
      // ...
      worker: {
        entry: [
          // 不指定后缀，会去自动找 ts -> js
          "hello",
          // 指定后缀
          "index.ts",
          "other.js",
          // 此时 weapp-vite 会从你在 app.json 中设置的 workers.path 路径中去寻找打包入口
        ],
      },
    },
  });
  ```

  原先的策略是，直接默认以 app.json 中设置的 `workers.path` 所有的入口作为打包入口，发现存在问题，见 [#120](https://github.com/weapp-vite/weapp-vite/issues/120)

### Patch Changes

- Updated dependencies [[`1401bed`](https://github.com/weapp-vite/weapp-vite/commit/1401bedf00f722b1f03917b02481aafa456ac129)]:
  - @weapp-core/init@1.2.0

## 4.0.5

### Patch Changes

- [`23d8546`](https://github.com/weapp-vite/weapp-vite/commit/23d85469abe1f9ef9b1109e7e5f42e644e7e2580) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 设置 hashCharacters 为 base36

- [`b0fd143`](https://github.com/weapp-vite/weapp-vite/commit/b0fd1431a5d15d334159657cc40ac2ebe588b7bd) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 独立的 worker 打包上下文

- [`f28335f`](https://github.com/weapp-vite/weapp-vite/commit/f28335fbeb7c82d5dedca739084031b4d3bbccc3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 额外添加监听器为了 worker 的 add 的情况

- [`c7622d0`](https://github.com/weapp-vite/weapp-vite/commit/c7622d05ca1d8c82be882793513b333896c34d96) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 强制所有系统使用 posix 操作符

- Updated dependencies [[`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a)]:
  - weapp-ide-cli@2.0.12

## 4.0.5-alpha.2

### Patch Changes

- [`f28335f`](https://github.com/weapp-vite/weapp-vite/commit/f28335fbeb7c82d5dedca739084031b4d3bbccc3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 额外添加监听器为了 worker 的 add 的情况

## 4.0.5-alpha.1

### Patch Changes

- [`23d8546`](https://github.com/weapp-vite/weapp-vite/commit/23d85469abe1f9ef9b1109e7e5f42e644e7e2580) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 设置 hashCharacters 为 base36

- [`c7622d0`](https://github.com/weapp-vite/weapp-vite/commit/c7622d05ca1d8c82be882793513b333896c34d96) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 强制所有系统使用 posix 操作符

- Updated dependencies [[`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a)]:
  - weapp-ide-cli@2.0.12-alpha.0

## 4.0.5-alpha.0

### Patch Changes

- [`b0fd143`](https://github.com/weapp-vite/weapp-vite/commit/b0fd1431a5d15d334159657cc40ac2ebe588b7bd) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 独立的 worker 打包上下文

## 4.0.4

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b)]:
  - vite-plugin-performance@0.0.1
  - @weapp-vite/volar@0.0.1
  - @weapp-core/init@1.1.18
  - @weapp-core/logger@1.0.4
  - @weapp-core/schematics@1.0.13
  - @weapp-core/shared@1.0.8
  - weapp-ide-cli@2.0.11

## 4.0.3

### Patch Changes

- [`7488075`](https://github.com/weapp-vite/weapp-vite/commit/748807565cab801c031212f5663e243a05ee707f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 在 dist 中的静态资源被重复加载

## 4.0.2

### Patch Changes

- [`3b129f4`](https://github.com/weapp-vite/weapp-vite/commit/3b129f404f7b487e59e8c12e5e351061ec818ec3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加 `require.async` 支持

## 4.0.1

### Patch Changes

- [`93df132`](https://github.com/weapp-vite/weapp-vite/commit/93df1328e1e7e08a9e58a5e4dc614017cbc61928) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 优化热更新以及宽松不合法格式的判定

- [`8dde98a`](https://github.com/weapp-vite/weapp-vite/commit/8dde98a1f29ed53d6eb13a52279917dff9853184) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 优化 weapp-vite 的文件watch更新机制

## 4.0.0

### Major Changes

- [`bbd3334`](https://github.com/weapp-vite/weapp-vite/commit/bbd3334758fa3b6fb8fc0571957d2a4a51ab1a1c) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 重构整个编译核心

### Patch Changes

- [`ce411f5`](https://github.com/weapp-vite/weapp-vite/commit/ce411f5ca65be7a2457223dc493e7d3f30b771f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 更换 json $schema 引用地址以应对 dns 劫持污染

- [`d07eb7f`](https://github.com/weapp-vite/weapp-vite/commit/d07eb7fe4aea38e47b44d2851a2ad237dc206116) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 优化 npm service 的构建逻辑

- [`5702919`](https://github.com/weapp-vite/weapp-vite/commit/5702919ce463a096eb1ff5a72a100310f5af0de8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加 PQueue 队列处理 npm 构建，为了更好的性能

- [`e6facf1`](https://github.com/weapp-vite/weapp-vite/commit/e6facf18aa85ad9e66d4a41667688aeeb31b3a41) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 重构 ScanService

- [`3983ea5`](https://github.com/weapp-vite/weapp-vite/commit/3983ea552aa9b36ff4aea642aebc3f567d6e0a3d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 去除 subpackage service 改为编译时插件递归处理

- Updated dependencies [[`ce411f5`](https://github.com/weapp-vite/weapp-vite/commit/ce411f5ca65be7a2457223dc493e7d3f30b771f0), [`bbd3334`](https://github.com/weapp-vite/weapp-vite/commit/bbd3334758fa3b6fb8fc0571957d2a4a51ab1a1c), [`3983ea5`](https://github.com/weapp-vite/weapp-vite/commit/3983ea552aa9b36ff4aea642aebc3f567d6e0a3d)]:
  - @weapp-core/schematics@1.0.12
  - @weapp-core/init@1.1.17
  - @weapp-core/shared@1.0.7

## 3.1.1

### Patch Changes

- [`eda1d33`](https://github.com/weapp-vite/weapp-vite/commit/eda1d332fdcc7c99930dff77d9af031d7b3a86f8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 命令行传入 -m,--mode 失效的问题

- Updated dependencies [[`e583052`](https://github.com/weapp-vite/weapp-vite/commit/e5830522ba086959ca5632a58e1d077a99ee0c56)]:
  - @weapp-core/schematics@1.0.11

## 3.1.0

### Minor Changes

- [`41eef22`](https://github.com/weapp-vite/weapp-vite/commit/41eef2287a91884e0869e6af33e5e4c34df1e4dc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 加入 vite-plugin-commonjs 专门处理 require, 其余默认走 import

## 3.0.2

### Patch Changes

- [`56f13e7`](https://github.com/weapp-vite/weapp-vite/commit/56f13e79f6ac2190ab7c2fa89aacda8ea106bb2f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add WeappVitePluginApi

## 3.0.1

### Patch Changes

- [`64ff2ed`](https://github.com/weapp-vite/weapp-vite/commit/64ff2edeef9c1361efb625e825abb187189de565) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: improve npm build

- [`759b29a`](https://github.com/weapp-vite/weapp-vite/commit/759b29a911e8679b40b64a75b2e285c54aeb9acc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: node builtin module as dep

## 3.0.0

### Major Changes

- [`08d2aa7`](https://github.com/weapp-vite/weapp-vite/commit/08d2aa7abf183dd13488feb5f93a3f36c3bae762) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: upgrade inversify from 6 to 7

- [`1943c86`](https://github.com/weapp-vite/weapp-vite/commit/1943c8634602a8a023d970e38895e6ae938656d6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: upgrade vite from 5 -> 6

### Patch Changes

- [`4c6ee88`](https://github.com/weapp-vite/weapp-vite/commit/4c6ee88b7952e31b3cd45d1f59b3275f52e42de3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: del remove subpackage miniprogram_npm

## 3.0.0-alpha.1

### Patch Changes

- [`4c6ee88`](https://github.com/weapp-vite/weapp-vite/commit/4c6ee88b7952e31b3cd45d1f59b3275f52e42de3) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: del remove subpackage miniprogram_npm

## 3.0.0-alpha.0

### Major Changes

- [`08d2aa7`](https://github.com/weapp-vite/weapp-vite/commit/08d2aa7abf183dd13488feb5f93a3f36c3bae762) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: upgrade inversify from 6 to 7

- [`1943c86`](https://github.com/weapp-vite/weapp-vite/commit/1943c8634602a8a023d970e38895e6ae938656d6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: upgrade vite from 5 -> 6

## 2.1.6

### Patch Changes

- [`fca7a65`](https://github.com/weapp-vite/weapp-vite/commit/fca7a65144a8f9b10719e5de90ef0bdf61cddb9f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: weapp-vite 错误的把 workers 作为 asset 资源而不是 chunk

## 2.1.5

### Patch Changes

- [`b1b6ade`](https://github.com/weapp-vite/weapp-vite/commit/b1b6ade59768bbdcfc5dd571f16f66be8bc98423) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: worker source mess

## 2.1.4

### Patch Changes

- [`f374376`](https://github.com/weapp-vite/weapp-vite/commit/f3743761e393cc051e5fcc8b5eaa3e3b3a04ff4a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support /xx/xx and xx/xx import (js/wxml)

## 2.1.3

### Patch Changes

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`4907eae`](https://github.com/weapp-vite/weapp-vite/commit/4907eae52e0c5f3399c1468a0688f69a99f61f95), [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81)]:
  - @weapp-core/init@1.1.16
  - @weapp-core/logger@1.0.3
  - @weapp-core/schematics@1.0.10
  - @weapp-core/shared@1.0.6
  - weapp-ide-cli@2.0.10

## 2.1.2

### Patch Changes

- [`a688c38`](https://github.com/weapp-vite/weapp-vite/commit/a688c38ef90d668adecffc7be1efcb3601d30eff) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add css as supportedCssLangs

## 2.1.1

### Patch Changes

- [`5de179c`](https://github.com/weapp-vite/weapp-vite/commit/5de179cca0a57bc43b702cd5737e978c92f96c72) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 取消构建 npm 生成 sourcemap 同时降低语法版本，进行压缩

- Updated dependencies [[`f307755`](https://github.com/weapp-vite/weapp-vite/commit/f307755039eea6b316fe6918e9acf654f7e5c6b3)]:
  - @weapp-core/schematics@1.0.9

## 2.1.0

### Minor Changes

- [`fc3afe3`](https://github.com/weapp-vite/weapp-vite/commit/fc3afe361e404e6eabfe587edf073cfad1024e10) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support workers for bundle

### Patch Changes

- Updated dependencies [[`fc3afe3`](https://github.com/weapp-vite/weapp-vite/commit/fc3afe361e404e6eabfe587edf073cfad1024e10)]:
  - @weapp-core/schematics@1.0.8

## 2.0.2

### Patch Changes

- [`b32c939`](https://github.com/weapp-vite/weapp-vite/commit/b32c9395ba592a1ea176a553b693ac9c3bee89bf) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: update deps
  fix: [#87](https://github.com/weapp-vite/weapp-vite/issues/87)
  fix: [#86](https://github.com/weapp-vite/weapp-vite/issues/86)
- Updated dependencies [[`b32c939`](https://github.com/weapp-vite/weapp-vite/commit/b32c9395ba592a1ea176a553b693ac9c3bee89bf)]:
  - weapp-ide-cli@2.0.9

## 2.0.1

### Patch Changes

- [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ---
  - chore: 更改模板组件行为
  - chore: weapp-vite 依赖项 resolve

- [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build error and add semver/functions/parse as dep

- Updated dependencies [[`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04), [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204), [`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2), [`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020), [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35), [`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4)]:
  - @weapp-core/init@1.1.15
  - @weapp-core/shared@1.0.5

## 2.0.1-alpha.5

### Patch Changes

- Updated dependencies [[`ed79551`](https://github.com/weapp-vite/weapp-vite/commit/ed795512f7ddc9fbe0b2be5f67172257439ad7c2)]:
  - @weapp-core/init@1.1.15-alpha.5

## 2.0.1-alpha.4

### Patch Changes

- Updated dependencies [[`f15117e`](https://github.com/weapp-vite/weapp-vite/commit/f15117e42630f2b2452fb55db2daa580b98ac0b4)]:
  - @weapp-core/init@1.1.15-alpha.4

## 2.0.1-alpha.3

### Patch Changes

- Updated dependencies [[`cac6148`](https://github.com/weapp-vite/weapp-vite/commit/cac6148819fb25f541e6d6b5edebcf33b935ae04)]:
  - @weapp-core/init@1.1.15-alpha.3

## 2.0.1-alpha.2

### Patch Changes

- [`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build error and add semver/functions/parse as dep

- Updated dependencies [[`8682d07`](https://github.com/weapp-vite/weapp-vite/commit/8682d07cb9e9fb34acf1ce8c38756d38c005cd35)]:
  - @weapp-core/shared@1.0.5-alpha.0
  - @weapp-core/init@1.1.15-alpha.2

## 2.0.1-alpha.1

### Patch Changes

- Updated dependencies [[`4f72349`](https://github.com/weapp-vite/weapp-vite/commit/4f723498d7a4db28eba5a50f6fccda6b78a10020)]:
  - @weapp-core/init@1.1.15-alpha.1

## 2.0.1-alpha.0

### Patch Changes

- [`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204) Thanks [@sonofmagic](https://github.com/sonofmagic)! - ---
  - chore: 更改模板组件行为
  - chore: weapp-vite 依赖项 resolve

- Updated dependencies [[`61c7e8b`](https://github.com/weapp-vite/weapp-vite/commit/61c7e8b1d7ea3c4f6c0fcb4dc73b016693d45204)]:
  - @weapp-core/init@1.1.15-alpha.0

## 2.0.0

### Major Changes

- [`1335093`](https://github.com/weapp-vite/weapp-vite/commit/13350939181bf2b289b1954b00c608cd5013be66) Thanks [@sonofmagic](https://github.com/sonofmagic)! - # Breaking Changes
  - 现在添加了静态的 `wxml` 分析引擎，会自动分析所有引入的组件，页面, 以及 `<import/>`, `<include/>` 标签等等，所以现在不会默认复制所有的 `wxml` 文件到编译目录 `dist` 目录下

### Patch Changes

- Updated dependencies [[`8ddfc97`](https://github.com/weapp-vite/weapp-vite/commit/8ddfc97a5706a25fa146b10fa43b7dc626a9f893)]:
  - @weapp-core/init@1.1.14

## 1.9.3

### Patch Changes

- [`7a40299`](https://github.com/weapp-vite/weapp-vite/commit/7a402997b471a3ce31584121c25fcd6f7a2f7b9d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 使用 JSON.TS 生成 JSON 时存在的问题

- Updated dependencies [[`0af89c5`](https://github.com/weapp-vite/weapp-vite/commit/0af89c5837046dfca548d62427adba9b4afc2d6a)]:
  - @weapp-core/logger@1.0.2
  - @weapp-core/init@1.1.13
  - weapp-ide-cli@2.0.8

## 1.9.2

### Patch Changes

- [`4bfc306`](https://github.com/weapp-vite/weapp-vite/commit/4bfc306706a6e187c40487a2b4b0be6f47def031) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: auto import glob issue

## 1.9.1

### Patch Changes

- [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support multi-platform software

- [`258d915`](https://github.com/weapp-vite/weapp-vite/commit/258d915b2fb044df4884d69260d76bed5217de6a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自定义 wxss 指令来跳过 scss,less,postcss-import 的编译

- [`3e55905`](https://github.com/weapp-vite/weapp-vite/commit/3e559054258cd607746b319a5f271650020fe3b9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support wxml #ifdef and #endif

- [`0cd9365`](https://github.com/weapp-vite/weapp-vite/commit/0cd936514022d3ce5464f588a126f37f9a0372f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加条件编译样式的插件

- Updated dependencies [[`c2f29a1`](https://github.com/weapp-vite/weapp-vite/commit/c2f29a15a651389175fbe7cb5c6e1644bcaafd1c), [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af)]:
  - @weapp-core/init@1.1.12
  - weapp-ide-cli@2.0.7

## 1.9.0

### Minor Changes

- [`c05dc77`](https://github.com/weapp-vite/weapp-vite/commit/c05dc7720cc8cd7c921a5ba7a97221941c91cadb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: release auto import components

## 1.8.4

### Patch Changes

- [`27fe9bb`](https://github.com/weapp-vite/weapp-vite/commit/27fe9bb31dffdb43387326f7a2d5db004e825622) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自动导入 vant 和 tdesign 组件

## 1.8.3

### Patch Changes

- [`d62c59b`](https://github.com/weapp-vite/weapp-vite/commit/d62c59b415b73a31a6c99369d460bfd80b11b596) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add TDesignResolver for auto-import

## 1.8.2

### Patch Changes

- [`a7f1f21`](https://github.com/weapp-vite/weapp-vite/commit/a7f1f21c2952b4b2f5c1fa822cba32671fe8af80) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 开放 auto import 组件功能

- [`145e036`](https://github.com/weapp-vite/weapp-vite/commit/145e03624e6e205f8bd314ec4220e289d9a526f4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add entry type

- Updated dependencies [[`145e036`](https://github.com/weapp-vite/weapp-vite/commit/145e03624e6e205f8bd314ec4220e289d9a526f4)]:
  - @weapp-core/schematics@1.0.7

## 1.8.1

### Patch Changes

- [`239b5f0`](https://github.com/weapp-vite/weapp-vite/commit/239b5f0e3f2b8905fba86ca8c754174c82f5c1c4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build npm env default 'production'

## 1.8.0

### Minor Changes

- [`9bb7be0`](https://github.com/weapp-vite/weapp-vite/commit/9bb7be0acd28381404cfd06b3f44472d8dd17b90) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 更改 wxml,wxs 以及静态资源文件的构建时序

### Patch Changes

- [`cc9d70f`](https://github.com/weapp-vite/weapp-vite/commit/cc9d70fa8b359fe0202cac32eb36d20cf6b065bc) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 生成脚手架支持 dirs 和 filenames 配置

- [`53739f1`](https://github.com/weapp-vite/weapp-vite/commit/53739f1f5c298572f2d7bcde49140041b87f9c54) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#64](https://github.com/weapp-vite/weapp-vite/issues/64)

- Updated dependencies [[`cc9d70f`](https://github.com/weapp-vite/weapp-vite/commit/cc9d70fa8b359fe0202cac32eb36d20cf6b065bc), [`5735e56`](https://github.com/weapp-vite/weapp-vite/commit/5735e5651a793611489afbbd7982241b6792f8fc)]:
  - @weapp-core/schematics@1.0.6
  - @weapp-core/init@1.1.11

## 1.7.8

### Patch Changes

- [`7afc501`](https://github.com/weapp-vite/weapp-vite/commit/7afc501752c3f1a6ab839502233801bb7cd26c60) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 尝试修复热更新文件无限递归调用导致栈溢出的问题

## 1.7.7

### Patch Changes

- [`b794a55`](https://github.com/weapp-vite/weapp-vite/commit/b794a5562095c4f058e35c62928eec4f6c0fe55e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#59](https://github.com/weapp-vite/weapp-vite/issues/59)
  feat: 优化清空目录的方式

## 1.7.6

### Patch Changes

- [`9daa971`](https://github.com/weapp-vite/weapp-vite/commit/9daa971ffb8a2ffec3e26e7e186b8d75708a8cf0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 支持内联 wxs 引入其他的 wxs 文件

- Updated dependencies [[`9daa971`](https://github.com/weapp-vite/weapp-vite/commit/9daa971ffb8a2ffec3e26e7e186b8d75708a8cf0)]:
  - @weapp-core/init@1.1.10

## 1.7.5

### Patch Changes

- [`795cdef`](https://github.com/weapp-vite/weapp-vite/commit/795cdef24c3edf08441b38832cd1305ed2a69e63) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持文件夹index文件自动寻址

## 1.7.4

### Patch Changes

- [`1a7d4c0`](https://github.com/weapp-vite/weapp-vite/commit/1a7d4c0e6406626317bb76a095d6759ae94d9d3e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: add vite as dependencies

- Updated dependencies [[`53d5903`](https://github.com/weapp-vite/weapp-vite/commit/53d5903cf60e7b2316bdbc6d9dcadac16a7517bf)]:
  - @weapp-core/init@1.1.9

## 1.7.3

### Patch Changes

- [`29d4c63`](https://github.com/weapp-vite/weapp-vite/commit/29d4c63ec26fb061a20e70bb698c8df90e7308c5) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 优化日志和构建hook的显示

## 1.7.2

### Patch Changes

- [`7fe8291`](https://github.com/weapp-vite/weapp-vite/commit/7fe829157b6609f0801338e6ac165271644ccc04) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 watch 热更新问题

## 1.7.1

### Patch Changes

- [`4bc81a1`](https://github.com/weapp-vite/weapp-vite/commit/4bc81a13712769de7662f216700c5c67592711c6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: wxs 增强支持分析与提取

- Updated dependencies [[`7f9c36a`](https://github.com/weapp-vite/weapp-vite/commit/7f9c36a30e41b4a2b95e61080f645b7c169fe847), [`c11d076`](https://github.com/weapp-vite/weapp-vite/commit/c11d07684c4592700a1141f2dc83dc3ce08c6676)]:
  - @weapp-core/init@1.1.8
  - @weapp-core/shared@1.0.4

## 1.7.0

### Minor Changes

- [`ace78e9`](https://github.com/weapp-vite/weapp-vite/commit/ace78e9c9d8ec82942f14d41bed293484bba765f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 增加 wxml 增强模式,支持 @ 加修饰符写法

### Patch Changes

- [`57f2d21`](https://github.com/weapp-vite/weapp-vite/commit/57f2d217e95b48815cd8293ac35de354ffb69d1b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持独立分包拥有自己的构建依赖配置

## 1.6.9

### Patch Changes

- [`0e2c9cb`](https://github.com/weapp-vite/weapp-vite/commit/0e2c9cb24c5a7dd803aaded340820ed4a1522f52) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持 Skyline 全局工具栏 appBar

- Updated dependencies [[`0e2c9cb`](https://github.com/weapp-vite/weapp-vite/commit/0e2c9cb24c5a7dd803aaded340820ed4a1522f52)]:
  - @weapp-core/schematics@1.0.5
  - @weapp-core/init@1.1.7

## 1.6.8

### Patch Changes

- [`33933ad`](https://github.com/weapp-vite/weapp-vite/commit/33933ad2059a142a28df488bffbf6939d2f6ad1b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 独立分包支持构建 npm

- Updated dependencies [[`33933ad`](https://github.com/weapp-vite/weapp-vite/commit/33933ad2059a142a28df488bffbf6939d2f6ad1b)]:
  - @weapp-core/schematics@1.0.4

## 1.6.7

### Patch Changes

- [`4b7b64a`](https://github.com/weapp-vite/weapp-vite/commit/4b7b64a692e5cb700160452f0f1b3b021408d507) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持在 json.[jt]s 中传入上下文和编译变量

## 1.6.6

### Patch Changes

- [`4f95b16`](https://github.com/weapp-vite/weapp-vite/commit/4f95b16923d5e9646aec6cf8d726316e2d5ab0ec) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - feat: 支持 html 作为 wxml 的后缀，以便复用 html 相关的插件和工具链
  - chore: 更新相关依赖包

## 1.6.5

### Patch Changes

- [`d818041`](https://github.com/weapp-vite/weapp-vite/commit/d8180411fb76102c6a0f792e90246715880993ad) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: dts 中对于 vite/client 的继承和智能提示

- Updated dependencies [[`d818041`](https://github.com/weapp-vite/weapp-vite/commit/d8180411fb76102c6a0f792e90246715880993ad)]:
  - @weapp-core/init@1.1.6

## 1.6.4

### Patch Changes

- [`5488a42`](https://github.com/weapp-vite/weapp-vite/commit/5488a42dcd9b6848f29c9f0ac5797d3330165901) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持使用 ts/js 来配置 json 文件 index.json.ts/js

- [`1170293`](https://github.com/weapp-vite/weapp-vite/commit/117029308b4740e84b3efbf0413f8dda7abea796) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加 copy 配置项

- Updated dependencies [[`5488a42`](https://github.com/weapp-vite/weapp-vite/commit/5488a42dcd9b6848f29c9f0ac5797d3330165901), [`1825f02`](https://github.com/weapp-vite/weapp-vite/commit/1825f024172dfeb357536c0aaeba6c4d53d97196)]:
  - @weapp-core/schematics@1.0.3
  - @weapp-core/init@1.1.5

## 1.6.3

### Patch Changes

- [`e7a95cd`](https://github.com/weapp-vite/weapp-vite/commit/e7a95cd26f5c94e3ef95c82dfd8e8fe11e356c85) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复多个分包提前返回的场景

## 1.6.2

### Patch Changes

- [`583b913`](https://github.com/weapp-vite/weapp-vite/commit/583b913212c5e5b080975a5e946f8d0ea6828aa7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: add weapp.tsconfigPaths for tsconfigPaths plugin

- Updated dependencies [[`583b913`](https://github.com/weapp-vite/weapp-vite/commit/583b913212c5e5b080975a5e946f8d0ea6828aa7)]:
  - @weapp-core/init@1.1.4

## 1.6.1

### Patch Changes

- [`f0523bc`](https://github.com/weapp-vite/weapp-vite/commit/f0523bc120655282fa411380c8fc227632f1460e) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 支持自定义 custom-tab-bar, 需要设置 tabBar.custom 为 true 来开启

- Updated dependencies [[`f0523bc`](https://github.com/weapp-vite/weapp-vite/commit/f0523bc120655282fa411380c8fc227632f1460e), [`228e4d2`](https://github.com/weapp-vite/weapp-vite/commit/228e4d2a9f780c018b13e91e15d1057d3c1360e0)]:
  - @weapp-core/schematics@1.0.2
  - @weapp-core/init@1.1.3

## 1.6.0

### Minor Changes

- [`5326cfc`](https://github.com/weapp-vite/weapp-vite/commit/5326cfc8a2d55d50414d557b15cf376cf36449d0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 去除 chokidar 和 watch 选项，改用 vite 内置的 watcher

## 1.5.6

### Patch Changes

- Updated dependencies [[`401fc58`](https://github.com/weapp-vite/weapp-vite/commit/401fc584fad1c884ac8f276f3dc4daccde9fe659)]:
  - @weapp-core/init@1.1.2

## 1.5.5

### Patch Changes

- [`df1303b`](https://github.com/weapp-vite/weapp-vite/commit/df1303bfbeef5613524b07142d1493aeb3c471f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 打包产物消失的问题

## 1.5.4

### Patch Changes

- [`2e6baf1`](https://github.com/weapp-vite/weapp-vite/commit/2e6baf1e0001477ca1d3df7ea67a5327533da196) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 删除不正确的依赖项

## 1.5.3

### Patch Changes

- Updated dependencies [[`bc9f19d`](https://github.com/weapp-vite/weapp-vite/commit/bc9f19dcf73e38b6b8a835a3e4660980eb1d9a7b)]:
  - @weapp-core/init@1.1.1

## 1.5.2

### Patch Changes

- [`8804452`](https://github.com/weapp-vite/weapp-vite/commit/8804452270184c7eb48d409ca2ec49e5b4d7599f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 分包 json 文件 copy 与 build 清空逻辑修复

## 1.5.1

### Patch Changes

- [`29dbbdc`](https://github.com/weapp-vite/weapp-vite/commit/29dbbdc356915e4778baccf6ec2f5ba67dd01781) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 添加 sitemap.json 和 theme.json 支持

- Updated dependencies [[`e0f4c38`](https://github.com/weapp-vite/weapp-vite/commit/e0f4c386823ec99c653ad2b5e1cbf4344ac632b4), [`e428516`](https://github.com/weapp-vite/weapp-vite/commit/e428516fd993bd9b4081c12773d614bf30fd48cd)]:
  - @weapp-core/schematics@1.0.1
  - @weapp-core/init@1.1.0

## 1.5.0

### Minor Changes

- [`95e195c`](https://github.com/weapp-vite/weapp-vite/commit/95e195c0400438833e63417c90030f5e296b5d29) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加生成脚手架功能

### Patch Changes

- Updated dependencies [[`1d84143`](https://github.com/weapp-vite/weapp-vite/commit/1d8414388e2fb18d4ccec0d743de787d934e772e), [`1d84143`](https://github.com/weapp-vite/weapp-vite/commit/1d8414388e2fb18d4ccec0d743de787d934e772e)]:
  - @weapp-core/init@1.0.9
  - @weapp-core/schematics@1.0.0

## 1.4.5

### Patch Changes

- [`518046e`](https://github.com/weapp-vite/weapp-vite/commit/518046ec1cd9e6bc132f8a7dea03d73962c20f31) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 直接执行 `npx weapp init` 会报出 `typescript` 找不到错误的问题

## 1.4.4

### Patch Changes

- Updated dependencies [[`1596334`](https://github.com/weapp-vite/weapp-vite/commit/159633422903bf3b5a5a3015bc0c495ec672c308)]:
  - @weapp-core/shared@1.0.3
  - @weapp-core/init@1.0.8

## 1.4.3

### Patch Changes

- [`90ecbab`](https://github.com/weapp-vite/weapp-vite/commit/90ecbabb3b5d0c6b276670c26bc10de60ac5c237) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 支持自动处理分包 `entry` 文件后缀

## 1.4.2

### Patch Changes

- [`9831c09`](https://github.com/weapp-vite/weapp-vite/commit/9831c097e0344a7313a6185f3672ce28ed645d42) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 允许在 json 里的 usingComponents 使用别名

- Updated dependencies [[`e15adce`](https://github.com/weapp-vite/weapp-vite/commit/e15adce483e9b47ef836680df49321db5431ac31)]:
  - @weapp-core/shared@1.0.2
  - @weapp-core/init@1.0.7

## 1.4.1

### Patch Changes

- [`c6d3b43`](https://github.com/weapp-vite/weapp-vite/commit/c6d3b43aba1d465f8353cde04d21113e0766ed8d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix:

- Updated dependencies [[`c6d3b43`](https://github.com/weapp-vite/weapp-vite/commit/c6d3b43aba1d465f8353cde04d21113e0766ed8d)]:
  - @weapp-core/init@1.0.6

## 1.4.0

### Minor Changes

- [`a5e2cbe`](https://github.com/weapp-vite/weapp-vite/commit/a5e2cbe3e811e89accc5932cb8e0a5d3ad3322b7) Thanks [@sonofmagic](https://github.com/sonofmagic)! - <br/>
  - feat: 独立分包单独进行构建
  - feat: 配置 `json` 支持注释

## 1.3.4

### Patch Changes

- [`7a249e7`](https://github.com/weapp-vite/weapp-vite/commit/7a249e7903cbf27e28aa3583e035707f1e433bcb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: 添加 watcher 输出日志

## 1.3.3

### Patch Changes

- [`b480be8`](https://github.com/weapp-vite/weapp-vite/commit/b480be86bd1ece7f6eec2e873d44f4883a62ea50) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 envDir 配置选项

## 1.3.2

### Patch Changes

- [`f905c14`](https://github.com/weapp-vite/weapp-vite/commit/f905c140f20b22583c8a2b713f73c46bdf927b1f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: json 文件重复 emit 问题

## 1.3.1

### Patch Changes

- [`dae031f`](https://github.com/weapp-vite/weapp-vite/commit/dae031f2e2c6aa319c1fb6d4537182495433c722) Thanks [@sonofmagic](https://github.com/sonofmagic)! - refactor: 整理依赖项提交

## 1.3.0

### Minor Changes

- [`b52d53a`](https://github.com/weapp-vite/weapp-vite/commit/b52d53ac848823b51e293c2e9318d82cc7d003f0) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 改进现有的依赖分析算法

## 1.2.5

### Patch Changes

- Updated dependencies [[`374bd9d`](https://github.com/weapp-vite/weapp-vite/commit/374bd9d22ad9df1aac65338f741b6fcc70bd342c)]:
  - @weapp-core/init@1.0.5

## 1.2.4

### Patch Changes

- [`8fe26ae`](https://github.com/weapp-vite/weapp-vite/commit/8fe26ae86f1365f46a2242e616441c7cfd7c7926) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 build 构建后不停止的问题

- Updated dependencies [[`8fe26ae`](https://github.com/weapp-vite/weapp-vite/commit/8fe26ae86f1365f46a2242e616441c7cfd7c7926)]:
  - weapp-ide-cli@2.0.6

## 1.2.3

### Patch Changes

- [`3499363`](https://github.com/weapp-vite/weapp-vite/commit/34993636a593f95b349007befbf228c4449551a9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: npm 包构建报错问题

## 1.2.2

### Patch Changes

- [`a0b7eb9`](https://github.com/weapp-vite/weapp-vite/commit/a0b7eb98a54ba80ebe3da439908be521a1121a75) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 build 会 watch 和依赖死循环问题

## 1.2.1

### Patch Changes

- [`db848f9`](https://github.com/weapp-vite/weapp-vite/commit/db848f929ba144ec82a87d37c7195d98c93b92d8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 使用 fdir 替换 klaw for better performance

## 1.2.0

### Minor Changes

- [`aa14554`](https://github.com/weapp-vite/weapp-vite/commit/aa14554bc6c5dec7ca56f0a70368e6b612dc9cca) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: 添加自动构建 npm 算法

## 1.1.7

### Patch Changes

- [`1df6bab`](https://github.com/weapp-vite/weapp-vite/commit/1df6baba4419816260ae4e144e32331edba08ee8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复不正确的 wxss 产物路径问题

## 1.1.6

### Patch Changes

- [`de1b0f2`](https://github.com/weapp-vite/weapp-vite/commit/de1b0f2f88a37f0ea04f10787100ab5f3a36c192) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: [#6](https://github.com/weapp-vite/weapp-vite/issues/6) 由于 `typescript` 文件作为入口的时候，`css` 样式文件没有被正确的处理 导致的这个问题

## 1.1.5

### Patch Changes

- [`5cc86a5`](https://github.com/weapp-vite/weapp-vite/commit/5cc86a5be6eb7caa6bedbf586f04489ad90d0411) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: dist watch 目录无限死循环问题

## 1.1.4

### Patch Changes

- [`584fe62`](https://github.com/weapp-vite/weapp-vite/commit/584fe6211f14d88779a711edba72e682b24ac59f) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: css preprocessCSS error

## 1.1.3

### Patch Changes

- Updated dependencies [[`c0146d3`](https://github.com/weapp-vite/weapp-vite/commit/c0146d31304f35db5b3a03aa9f9497ed46688730)]:
  - @weapp-core/init@1.0.4
  - weapp-ide-cli@2.0.5

## 1.1.2

### Patch Changes

- [`598753c`](https://github.com/weapp-vite/weapp-vite/commit/598753ced4f0c40ec971b28a4e98e4a18b35525a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: deps upgrade

- Updated dependencies [[`598753c`](https://github.com/weapp-vite/weapp-vite/commit/598753ced4f0c40ec971b28a4e98e4a18b35525a)]:
  - weapp-ide-cli@2.0.4

## 1.1.1

### Patch Changes

- [`b40bc77`](https://github.com/sonofmagic/weapp-tailwindcss/commit/b40bc7716861343bc63ca3a9fa8ade9388614ae8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Date: 2024-09-01
  - 重构 `vite` 上下文的实现
  - 优化自定义的路径的显示效果

- Updated dependencies [[`b40bc77`](https://github.com/sonofmagic/weapp-tailwindcss/commit/b40bc7716861343bc63ca3a9fa8ade9388614ae8)]:
  - weapp-ide-cli@2.0.3
  - @weapp-core/init@1.0.3

## 1.1.0

### Minor Changes

- [`5507cd8`](https://github.com/sonofmagic/weapp-tailwindcss/commit/5507cd8c38fc0f0821548cb1f8382ae8e9d5fbf9) Thanks [@sonofmagic](https://github.com/sonofmagic)! - support cli mode param

  releated: https://github.com/sonofmagic/weapp-tailwindcss/discussions/369

## 1.0.6

### Patch Changes

- Updated dependencies [6f469c3]
  - weapp-ide-cli@2.0.2

## 1.0.3

### Patch Changes

- fbb1ed7: 修复 `@weapp-core/init` 和 `weapp-vite` 的一些问题
- Updated dependencies [fbb1ed7]
  - @weapp-core/init@1.0.2

## 1.0.2

### Patch Changes

- f7a2d5d: fix: watcher do not close error
- Updated dependencies [f7a2d5d]
  - @weapp-core/init@1.0.1
  - @weapp-core/logger@1.0.1
  - @weapp-core/shared@1.0.1
  - weapp-ide-cli@2.0.1

## 1.0.1

### Patch Changes

- 2e458bb: fix: Cannot find module `weapp-vite/config` error

## 1.0.0

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- 80ce9ca: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- 0fc5083: release alpha
- f22c535: chore: compact for `weapp-vite`
- 2b7be6d: feat: add serve watch files
- Updated dependencies [80ce9ca]
- Updated dependencies [0fc5083]
- Updated dependencies [f22c535]
- Updated dependencies [36f5a7c]
- Updated dependencies [2b7be6d]
  - weapp-ide-cli@2.0.0
  - @weapp-core/shared@1.0.0
  - @weapp-core/init@1.0.0
  - @weapp-core/logger@1.0.0

## 1.0.0-alpha.4

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- Updated dependencies [36f5a7c]
  - @weapp-core/logger@1.0.0-alpha.1
  - @weapp-core/shared@1.0.0-alpha.4
  - @weapp-core/init@1.0.0-alpha.4
  - weapp-ide-cli@2.0.0-alpha.2

## 0.0.2-alpha.3

### Patch Changes

- 792f50c: chore: compact for `weapp-vite`
- Updated dependencies [792f50c]
  - weapp-ide-cli@2.0.0-alpha.1
  - @weapp-core/logger@0.0.1-alpha.0
  - @weapp-core/shared@0.0.2-alpha.3
  - @weapp-core/init@0.0.2-alpha.3

## 0.0.2-alpha.2

### Patch Changes

- ffa21da: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

- Updated dependencies [ffa21da]
  - weapp-ide-cli@2.0.0-alpha.0
  - @weapp-core/shared@0.0.2-alpha.2
  - @weapp-core/init@0.0.2-alpha.2

## 0.0.2-alpha.1

### Patch Changes

- a4adb3f: feat: add serve watch files
- Updated dependencies [a4adb3f]
  - @weapp-core/shared@0.0.2-alpha.1
  - @weapp-core/init@0.0.2-alpha.1

## 0.0.2-alpha.0

### Patch Changes

- f28a193: release alpha
- Updated dependencies [f28a193]
  - @weapp-core/shared@0.0.2-alpha.0
  - @weapp-core/init@0.0.2-alpha.0

## 0.0.1

### Patch Changes

- f01681a: release version
- Updated dependencies [f01681a]
  - @weapp-core/shared@0.0.1
  - @weapp-core/init@0.0.1
