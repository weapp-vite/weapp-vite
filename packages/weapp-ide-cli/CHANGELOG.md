# weapp-ide-cli

## 5.2.8

### Patch Changes

- 🐛 **让自动化 CLI 命令优先复用本地 DevTools runtime REST 服务，从而与 MCP、REST HTTP 共享同一个模拟器连接；服务不可用时仍回退到原有直连模式。** [`952e885`](https://github.com/weapp-vite/weapp-vite/commit/952e885042746bf1579eff111e651b68ea78a46f) by @sonofmagic
- 📦 **Dependencies** [`6e78d57`](https://github.com/weapp-vite/weapp-vite/commit/6e78d570d4dbf459397410e0c17f8ca2ebafe873)
  → `@weapp-vite/miniprogram-automator@1.0.5`, `@weapp-vite/devtools-runtime@0.2.1`

## 5.2.7

### Patch Changes

- 🐛 **为 MCP 服务新增微信开发者工具 runtime 工具集，并抽出共享 DevTools runtime 会话包，支持连接复用、页面跳转、截图、日志读取、页面数据、元素查询和组件交互等自动化能力。** [#527](https://github.com/weapp-vite/weapp-vite/pull/527) by @sonofmagic
- 📦 **Dependencies** [`a3451df`](https://github.com/weapp-vite/weapp-vite/commit/a3451df4f907a58d7ba1c7ebaa78bd215c017da4)
  → `@weapp-vite/devtools-runtime@0.2.0`

## 5.2.6

### Patch Changes

- 🐛 **修复 `weapp auto-preview -p` 在微信开发者工具不在前台时可能无法唤起小程序预览的问题。现在 `auto-preview` 会在执行前先按同一项目定位信息唤起开发者工具，再继续运行官方自动预览命令，提升后台场景下的预览启动稳定性。** [#506](https://github.com/weapp-vite/weapp-vite/pull/506) by @sonofmagic

- 🐛 **修复 ESM shared chunk 中 request runtime 安装代码覆盖第三方库同名局部变量的问题，并稳定微信开发者工具打开后的项目索引刷新流程。现在 request globals 共享安装阶段只同步运行时 actuals 与 `globalThis`，避免把 `Request`、`WebSocket` 等 Web API 绑定回写到 chunk 内部变量；同时 `wv open` / `wv dev --open` 会在打开后刷新项目、重置 fileutils 并在 HTTP engine build 端点缺失时回退到官方 CLI，减少模拟器首次启动时读取陈旧配置导致的 `subPackages` 异常。** [`471286e`](https://github.com/weapp-vite/weapp-vite/commit/471286ea43d918d07c0dd38058429987c0c335e1) by @sonofmagic

## 5.2.5

### Patch Changes

- 🐛 **继续增强微信开发者工具命令链路的稳定封装。`weapp-ide-cli` 新增了更完整的程序化命令层与顶层 helper 分发，覆盖 `open`、`login`、`preview`、`upload`、`cache`、`close`、`quit`、`build-npm`、`open-other`、`auto`、`auto-replay`、`build-apk`、`build-ipa`、`reset-fileutils`、`engine build` 等官方命令，并为 `engine build` 补齐了 `logPath` 日志落盘语义；同时补充了 DevTools HTTP `engine build` 流程，以及基于已打开 automator 会话优先执行的 `Tool.*` 程序化 helper（如 `compile`、`clearCache`、`toolInfo`、`ticket` 相关能力）。`weapp-vite` 则开始在 IDE 顶层转发、统一执行器与 `npm` / `close` 等入口优先复用这些稳定 helper，并新增 `wv ide info`、`wv ide test-accounts`、`wv ide ticket`、`wv ide ticket:set`、`wv ide ticket:refresh` 等用户入口，减少对原始 argv 透传和官方 CLI 黑盒行为的直接耦合。** [`1ebbab3`](https://github.com/weapp-vite/weapp-vite/commit/1ebbab3f3a650caf146f340be39a0b63491f9e46) by @sonofmagic

- 🐛 **修复 `weapp-vite dev --open` 的微信开发者工具快捷键与会话协同逻辑。现在 `r` 仅用于手动重新构建当前小程序产物，不再误触发开发者工具项目重开；`c` / `C` 改为重置当前 automator 会话或重置后重开项目。与此同时，`weapp-ide-cli` 新增基于 DevTools HTTP `/open` 的项目重开能力，并统一共享输入挂起与登录重试处理，避免快捷键、重试确认和已打开会话之间发生按键冲突。** [`b3a30a3`](https://github.com/weapp-vite/weapp-vite/commit/b3a30a3454ad0ed441b14c97a15cd5e230a628b5) by @sonofmagic

- 🐛 **修复并收敛小程序开发态的 DevTools 交互流程：`weapp-vite dev --open` 现在将 `r` 明确用于通知微信开发者工具重新编译，将手动重新构建产物调整为 `R`，并修复手动重建清空 `dist` 后 `app.json` 等关键产物未重新写回的问题；同时统一 IDE 打开、登录失效重试与终端按键输入协调逻辑，避免在微信开发者工具登录过期时出现热键监听、重试提示与重新编译动作互相干扰的情况。** [`b759e42`](https://github.com/weapp-vite/weapp-vite/commit/b759e42b1b8d1e42ae1e8de60ed64418364bdb0c) by @sonofmagic
- 📦 **Dependencies** [`1ebbab3`](https://github.com/weapp-vite/weapp-vite/commit/1ebbab3f3a650caf146f340be39a0b63491f9e46)
  → `@weapp-vite/miniprogram-automator@1.0.4`

## 5.2.4

### Patch Changes

- 🐛 **改进微信开发者工具打开项目的兼容性：启动前会检测并尊重用户当前的服务端口配置，不再盲目覆盖已有设置；当用户关闭服务端口时，会保留原配置并回退到普通打开流程。同时补齐 Windows 下的默认 CLI 路径探测、批处理启动兼容、项目信任预写入与调试回退错误定位，降低 automator 打开项目时的启动与信任失败概率。** [`cd33619`](https://github.com/weapp-vite/weapp-vite/commit/cd336193b4cd6c7002e574d1eeb9031c14755484) by @sonofmagic

- 🐛 **继续收敛多平台小程序适配的共享 contract 与宿主中立命名。`@weapp-core/shared` 现在提供更安全的运行时根入口与独立的 Node 子入口，统一平台 registry、宿主全局对象、模板指令前缀、路由与 capability 描述，避免小程序环境误入 Node-only 能力；`weapp-vite`、`@weapp-vite/ast`、`@wevu/compiler`、`wevu`、`@wevu/api`、`@weapp-vite/web` 与 `weapp-ide-cli` 则统一消费这套 contract，补齐 `a` / `tt` / `s` 等结构指令识别、默认平台回退、配置读取与多宿主 bridge 挂载逻辑，减少核心链路里散落的 `wx` 单宿主假设。** [`27c655f`](https://github.com/weapp-vite/weapp-vite/commit/27c655f20e4f033cbefa0920a1b60a55343a22f1) by @sonofmagic
  - 同时继续扩展公共 API 与运行时类型面的宿主中立别名，包括 `miniProgramRouter`、`AutoRoutesMiniProgramRouter`、`WeapiMiniProgramMethodName`、`WeapiMiniProgramAdapter`、`WeapiMiniProgramRequestTask`、`WeapiMiniProgramRequestSuccessResult`、`MiniProgramRequestMethod`、`MiniProgramSelectorQuery`、`MiniProgramIntersectionObserver`、`MiniProgramRouter`、`MiniProgramLaunchOptions` 等，并保持原有 `wx` / `WeapiWx*` 兼容导出不变。这样后续接入支付宝小程序、抖音小程序、百度小程序等宿主时，可以逐步迁移到统一的小程序命名与共享平台能力，而不需要继续把公共类型和内部模板协议绑定到微信前缀。
  - 在 Web 运行时侧，也继续把多平台桥接协议做成宿主中立模型：`canIUse` 支持解析 `wx.*`、`my.*`、`tt.*` 等前缀，模板事件属性默认输出 `data-mp-on-*` / `data-mp-on-flags-*`，并把 bridge 同步挂到 `wx`、`my`、`tt`、`swan`、`jd`、`xhs` 等宿主全局对象上。这样同一套运行时与工具链在多小程序平台之间更容易复用，也为后续平台接入继续收窄改造面。
- 📦 **Dependencies** [`1f76780`](https://github.com/weapp-vite/weapp-vite/commit/1f76780d69a3e0a7f8d9d197f50865c7d6d0c3b3)
  → `@weapp-core/shared@3.0.4`, `@weapp-vite/miniprogram-automator@1.0.3`

## 5.2.3

### Patch Changes

- 🐛 **增强微信开发者工具启动前的本地配置预热能力。`weapp-ide-cli` 现在会在 `open`、`auto`、`auto-preview` 与 automator 启动前自动补齐 DevTools 安全设置，并可按命令参数或全局配置自动信任目标项目；同时新增 `autoBootstrapDevtools`、`autoTrustProject` 配置项与更直观的 `config show` / `config doctor` 输出。`weapp-vite` 复用了这套底层能力，新增 `ide setup` 命令，并让 `open`、`dev --open`、`build --open` 共享同一套 DevTools 预热与项目信任策略。** [`08fd6ae`](https://github.com/weapp-vite/weapp-vite/commit/08fd6ae8093f7935ee6a9df51eef639c185fa861) by @sonofmagic

## 5.2.2

### Patch Changes

- 🐛 **修复 `weapp-ide-cli --full-page` 整页长截图会改变当前页面滚动位置的问题。现在截图前会记录当前页面的 y 轴位置，完成从顶部到底部的拼接后自动恢复原位置，并在截图异常中断时同样执行滚动恢复，避免调试现场被截图流程打断。** [`0ea8493`](https://github.com/weapp-vite/weapp-vite/commit/0ea84934b344ea19607090bcda070452c6e41dbe) by @sonofmagic

## 5.2.1

### Patch Changes

- 🐛 **修复微信开发者工具自动化会话在启动抖动阶段容易误判为“HTTP 服务端口未开启”的问题。现在会在 `Extension context invalidated`、websocket 启动超时等可恢复场景下自动重试一次，并在仍然失败时输出更贴近真实状态的错误分类。同步修正 `weapp-vite-tailwindcss-vant-template` 的布局演示页操作区排版，避免 `@vant/weapp` 按钮以内联方式挤压换行导致页面错乱。** [`b4cfb7b`](https://github.com/weapp-vite/weapp-vite/commit/b4cfb7b6503ee4fc8758b9275aabd5f57372dd3e) by @sonofmagic

- 🐛 **在 `weapp-ide-cli` 底层新增按 `projectPath` 复用的共享 automator 会话能力，并将 `weapp-vite dev` 的截图热键切换为通过该共享会话执行。这样后续更多 DevTools 操作都可以基于底层统一的会话复用机制扩展，而不是继续在上层命令里各自维护连接状态。** [`257b037`](https://github.com/weapp-vite/weapp-vite/commit/257b0372857734a2ae5180862ab0a33aef974e4b) by @sonofmagic

- 🐛 **修复 `weapp-vite dev -o` 开发态截图热键每次都重新连接 DevTools 的问题。现在开发态会优先复用已建立的 automator 会话来执行截图，并默认生成整页长截图，减少重复连接导致的超时与卡顿；底层 `weapp-ide-cli` 截图命令也新增了复用现有 `miniProgram` 会话的能力。** [`2e1f557`](https://github.com/weapp-vite/weapp-vite/commit/2e1f557e2d09027116d807ad50f68e213f85fb87) by @sonofmagic

- 🐛 **修复小程序截图链路在微信开发者工具无响应或自动化会话异常时的诊断行为，并为 `weapp-vite screenshot` / `wv screenshot` / `weapp-ide-cli screenshot` 新增 `--full-page` 整页长截图能力。现在截图命令会正确等待异步命令完成；当 DevTools websocket 连接失败、截图请求长时间不返回，或清理会话时 `App.exit` / `Tool.close` 无响应时，会显式抛出可排查的错误提示，而不再静默退出或表现为“成功但没有产物”；同时 `--page pages/...` 这类常见写法也会自动归一化为小程序路由所需的前导 `/`。** [`2a5882b`](https://github.com/weapp-vite/weapp-vite/commit/2a5882b016a6018ae5e5e73d48db11a3e0456676) by @sonofmagic
- 📦 **Dependencies** [`b4cfb7b`](https://github.com/weapp-vite/weapp-vite/commit/b4cfb7b6503ee4fc8758b9275aabd5f57372dd3e)
  → `@weapp-vite/miniprogram-automator@1.0.2`

## 5.2.0

### Minor Changes

- ✨ **为 `weapp-ide-cli` 新增 `weapp compare` 截图对比命令，基于 `pixelmatch` 支持基准图比对、diff 图输出、阈值判定与 JSON 结果输出，并同步接入 `weapp-vite` / `wv` 的上层命令透传与 AI 工作流文档。** [`d43b232`](https://github.com/weapp-vite/weapp-vite/commit/d43b2320b0cb38b69d8993d00d41930eb65d0fbc) by @sonofmagic

### Patch Changes

- 🐛 **将多个源码包中直接使用的 `fs-extra` 调用统一迁移到 `@weapp-core/shared` 提供的原生 `node:fs` / `node:fs/promises` 兼容层，减少重复文件系统封装，并清理相关直接依赖与测试 mock。** [`09b2383`](https://github.com/weapp-vite/weapp-vite/commit/09b2383906143adebb7717d59fe274d34a7b9a97) by @sonofmagic
- 📦 **Dependencies** [`09b2383`](https://github.com/weapp-vite/weapp-vite/commit/09b2383906143adebb7717d59fe274d34a7b9a97)
  → `@weapp-core/shared@3.0.3`

## 5.1.5

### Patch Changes

- 🐛 **补齐 `weapp-ide-cli cache` 命令的参数校验与使用示例。现在 `cache` 命令会显式校验 `--clean/-c` 是否传入，以及清理类型是否属于 `storage`、`file`、`compile`、`auth`、`network`、`session`、`all`；同时同步补充 `weapp-vite` 与 `weapp-ide-cli` 文档中的缓存清理示例，明确该能力已作为正式 CLI 集成能力提供。** [`4212f6b`](https://github.com/weapp-vite/weapp-vite/commit/4212f6b6421dd08c93acc57d55f3b97063381101) by @sonofmagic

## 5.1.4

### Patch Changes

- 📦 **Dependencies** [`fcf09b3`](https://github.com/weapp-vite/weapp-vite/commit/fcf09b343c38ca1d5abe662dd15dd6d9414f1ab3)
  → `@weapp-vite/miniprogram-automator@1.0.1`

## 5.1.3

### Patch Changes

- 🐛 **新增 `@weapp-vite/miniprogram-automator` 包，作为对微信官方 `miniprogram-automator` 的现代化兼容替代实现，提供纯根入口 named exports、`MiniProgram / Page / Element / Native` 等核心类、内置二维码解析与终端渲染能力，并接入 `weapp-vite` 生态内的 headless 运行时适配能力。** [`a979852`](https://github.com/weapp-vite/weapp-vite/commit/a97985294bb7f2fd7321aafd28b0faad4d383c8e) by @sonofmagic
  - 同时将 `weapp-ide-cli` 与仓库内 e2e 运行时切换到新的 workspace automator 包，为后续完全替换官方依赖做准备。

- 🐛 **重构 `weapp-ide-cli` 的命令行入口，改为基于 `cac` 的顶层命令注册与解析，同时继续保持现有微信开发者工具透传命令、automator 子命令、`config` 子命令与 `minidev` 转发入口的兼容行为。内部的 automator 会话层也已切换到现代化的 `@weapp-vite/miniprogram-automator` 命名导出与 `Launcher` 启动路径。** [`d94a443`](https://github.com/weapp-vite/weapp-vite/commit/d94a44378ad53b3b27019bed4855f782926147ff) by @sonofmagic
  - `@weapp-vite/miniprogram-automator` 现在只发布 ESM 产物，不再提供 CJS 入口。包导出与构建配置已经同步收敛为纯 ESM 形式，使用 `require()` 加载该包的旧调用方式将不再受支持。
- 📦 **Dependencies** [`a979852`](https://github.com/weapp-vite/weapp-vite/commit/a97985294bb7f2fd7321aafd28b0faad4d383c8e)
  → `@weapp-vite/miniprogram-automator@1.0.0`

## 5.1.2

### Patch Changes

- 🐛 **新增 `weapp.forwardConsole` 开发态日志转发能力：在微信开发者工具连接成功后，可将小程序 `console` 日志与未捕获异常桥接到终端输出。默认在检测到 AI 终端时自动开启，并支持通过配置控制启用状态、日志级别与异常转发行为。** [`22897df`](https://github.com/weapp-vite/weapp-vite/commit/22897df1dbe8a460955bb41fa9147fbc33e0f81e) by @sonofmagic

## 5.1.1

### Patch Changes

- 🐛 **将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8) by @sonofmagic
- 📦 **Dependencies** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8)
  → `@weapp-core/logger@3.1.1`

## 5.1.0

### Minor Changes

- ✨ **新增截图命令，集成 miniprogram-automator** [`02dc3e8`](https://github.com/weapp-vite/weapp-vite/commit/02dc3e84674222e6769b975a96c8943dc33d4b52) by @sonofmagic
  - 新增 `weapp screenshot` 命令用于捕获小程序截图
  - 支持输出为 base64 或保存到文件
  - 支持截图前进行页面导航
  - 添加登录校验和 HTTP 端口错误处理
  - 添加 automator 和截图模块的单元测试

### Patch Changes

- 🐛 **重构 weapp-ide-cli 的命令解析与 automator 执行架构，统一参数解析、登录重试与会话生命周期处理；同时修复 automator 命令测试导入路径问题并补齐结构化分层实现，提升后续扩展和维护稳定性。** [`1a04e9f`](https://github.com/weapp-vite/weapp-vite/commit/1a04e9f3067bdc7815184d0488cf73c3d714ef38) by @sonofmagic

- 🐛 **在 `weapp-ide-cli` 中整理并导出了完整命令目录（官方 CLI、automator、config、minidev），新增 `isWeappIdeTopLevelCommand` 判断函数。`weapp-vite` 的 IDE 透传逻辑改为基于该目录判断，仅在命令未被 `weapp-vite` 自身注册且命中 `weapp-ide-cli` 命令目录时才透传执行。** [`83a3e18`](https://github.com/weapp-vite/weapp-vite/commit/83a3e18c07bf9780e1b012a106f217af51cd2123) by @sonofmagic

## 5.0.4

### Patch Changes

- 🐛 **feat(weapp-ide-cli)：新增 `--non-interactive`、`--login-retry` 与 `--login-retry-timeout`，并在 CI 或非 TTY 场景下对登录失效（code:10）快速失败，避免卡在按键重试交互。** [`f034ff2`](https://github.com/weapp-vite/weapp-vite/commit/f034ff2ae5f9f2db3fa74c18fd56cdd04a171d59) by @sonofmagic

## 5.0.3

### Patch Changes

- 🐛 **refactor: 提炼微信 IDE 登录失效重试逻辑，减少跨包重复实现。** [`ff78c39`](https://github.com/weapp-vite/weapp-vite/commit/ff78c394a29766497a7da57f46a2b394fbfc82d6) by @sonofmagic
  - `weapp-ide-cli` 对外导出登录失效识别与按键重试 helper。
  - `weapp-vite` 的 `open/dev -o` 逻辑改为复用 `weapp-ide-cli` helper，不再维护重复副本。
  - 清理 `weapp-vite` 本地重复重试模块，并更新单测 mock 到统一导出入口。

- 🐛 **fix: 登录失效场景优化错误展示，避免输出原始对象堆栈。** [`d73be83`](https://github.com/weapp-vite/weapp-vite/commit/d73be83cbb5bfe1dd6d529bb3a0ee5b1724133fa) by @sonofmagic
  - 执行微信 CLI 时关闭原始 `stderr` 直通输出，避免 `code/message` 对象和堆栈原样刷屏。
  - 登录失效提示改为结构化摘要（`code` / `message`），提升可读性。
  - 保持 `r` 重试交互，并补充对应单元测试。

- 🐛 **fix: 兼容微信 CLI 输出登录失效但未抛异常的场景。** [`cef276a`](https://github.com/weapp-vite/weapp-vite/commit/cef276ab3f3ab49d689231b653b65cd96e82cdad) by @sonofmagic
  - `execute` 成功返回后也会检查输出内容，命中 `code: 10` / `需要重新登录` 依旧触发友好提示与按键重试。
  - 保持原有异常分支的重试逻辑，统一进入同一套提示与交互流程。
  - 增加单测覆盖“输出命中登录失效”的重试路径。

- 🐛 **feat: 统一 CLI 终端染色入口到 logger colors。** [`f7f936f`](https://github.com/weapp-vite/weapp-vite/commit/f7f936f1884cf0e588764132bf7f280d5d22bf41) by @sonofmagic
  - `@weapp-core/logger` 新增 `colors` 导出（基于 `picocolors`），作为统一终端染色能力。
  - 对齐 `packages/*/src/logger.ts` 适配层，统一通过本地 `logger` 入口透传 `colors`。
  - 后续 CLI 代码可统一使用 `from '../logger'`（或 `@weapp-core/logger`）进行染色，避免分散依赖与手写 ANSI。
  - 本次发布包含 `weapp-vite`，同步 bump `create-weapp-vite` 以保持脚手架依赖一致性。

- 🐛 **chore: 统一 CLI 中优先级输出风格与终端染色。** [`51735d0`](https://github.com/weapp-vite/weapp-vite/commit/51735d05925951eb9dc99a5f88a555178f845021) by @sonofmagic
  - `weapp-ide-cli`：补齐 `colors` 相关测试 mock，确保配置解析与 `minidev` 安装提示在新增染色后行为稳定。
  - `weapp-vite`：对齐 `openIde` 重试提示日志级别（`error/warn/info`），并统一通过 `logger.colors` 做重点信息高亮。
  - `weapp-vite`：优化运行目标、构建完成、分析结果写入等高频输出，统一命令/路径/URL 的染色展示。
  - 包含 `weapp-vite` 变更，按仓库约定同步 bump `create-weapp-vite`。

- 🐛 **feat: 微信开发者工具登录失效场景增加友好提示与按键重试。** [`eb618e4`](https://github.com/weapp-vite/weapp-vite/commit/eb618e4c47ceb3ae1466ca03bfb1000f4d41ad88) by @sonofmagic
  - 当 CLI 返回 `code: 10` / `需要重新登录` 时，展示更明确的登录指引。
  - 失败后支持按 `r` 重试，按 `q`、`Esc` 或 `Ctrl+C` 退出。
  - 增加重试相关单元测试，覆盖重试成功与取消重试场景。

- 🐛 **style: 优化登录失效重试提示的终端染色层次。** [`b0fb993`](https://github.com/weapp-vite/weapp-vite/commit/b0fb9934761eb5514222f2cab8fc697a26559996) by @sonofmagic
  - 复用 `@weapp-core/logger`（consola）能力，将提示按 `error/warn/info/start` 分级输出。
  - 登录失效摘要与重试引导改为有层次的彩色输出，更易快速识别关键步骤。
  - 补充对应单元测试，覆盖新的日志方法调用。
- 📦 **Dependencies** [`f7f936f`](https://github.com/weapp-vite/weapp-vite/commit/f7f936f1884cf0e588764132bf7f280d5d22bf41)
  → `@weapp-core/logger@3.1.0`

## 5.0.2

### Patch Changes

- 🐛 **feat: 支持支付宝平台一键打开 IDE，并优化 lib-mode 测试产物稳定性。** [`f46e69c`](https://github.com/weapp-vite/weapp-vite/commit/f46e69cbb7c6aef720d1ace6aa58916e0d28dc1a) by @sonofmagic
  - `weapp-ide-cli` 新增 `open --platform alipay` 分流能力，自动转发到 `minidev ide`。
  - `weapp-vite` 新增 `open --platform <platform>`，且在 `dev/build --open -p alipay` 场景自动走支付宝 IDE 打开链路。
  - `weapp-vite` 的 `injectWeapi` 在 app 注入阶段新增原生平台 API 兜底探测，避免支付宝环境下 `wpi` 未绑定原生 `my` 导致 `setClipboardData:fail method not supported`。
  - `weapp-vite` 在多平台模式下针对支付宝平台优化 npm 输出目录推导：若未手动配置 `packNpmRelationList`，会基于 `mini.project.json` 的 `miniprogramRoot` 计算 npm 输出目录，避免 npm 产物错误写入项目根目录。
  - `weapp-vite` 的 `lib-mode` 测试改为写入临时输出目录，避免每次单测改写 fixture 内的 `.d.ts` 文件。

## 5.0.1

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic
- 📦 **Dependencies** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f)
  → `@weapp-core/logger@3.0.3`

## 5.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

### Patch Changes

- 📦 **Dependencies** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda)
  → `@weapp-core/logger@3.0.0`

## 4.1.2

### Patch Changes

- [`a876ddb`](https://github.com/weapp-vite/weapp-vite/commit/a876ddb9f35757093f2d349c2a9c70648c278c44) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 4.1.1

### Patch Changes

- [`3e379e4`](https://github.com/weapp-vite/weapp-vite/commit/3e379e4cedc1e6ae4a63850da4231534b2928367) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 4.1.0

### Minor Changes

- [`6a289f3`](https://github.com/weapp-vite/weapp-vite/commit/6a289f3d4ebe3dbc874f3f2650cfab1f330b5626) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 新增基于 minidev 的支付宝小程序 CLI 入口：支持使用 `weapp alipay`/`weapp ali` 直接转发指令，若未安装 minidev 将提示用户安装。

## 4.0.0

### Major Changes

- [`eda9720`](https://github.com/weapp-vite/weapp-vite/commit/eda97203171f116783181483600cc82dd27ae102) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - refactor: 重构 CLI 架构，拆分解析与执行流程，引入跨平台默认路径探测、交互式路径配置与参数归一化工具，并补充对应单元测试覆盖。

## 4.0.0-alpha.0

### Major Changes

- [`eda9720`](https://github.com/weapp-vite/weapp-vite/commit/eda97203171f116783181483600cc82dd27ae102) Thanks [@sonofmagic](https://github.com/sonofmagic)! - - refactor: 重构 CLI 架构，拆分解析与执行流程，引入跨平台默认路径探测、交互式路径配置与参数归一化工具，并补充对应单元测试覆盖。

## 3.1.1

### Patch Changes

- [`9733680`](https://github.com/weapp-vite/weapp-vite/commit/9733680cbdcc2a54a9c89f5f50b2b0f951202745) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 3.1.0

### Minor Changes

- [#165](https://github.com/weapp-vite/weapp-vite/pull/165) [`1d9952b`](https://github.com/weapp-vite/weapp-vite/commit/1d9952b8968dbd0c84b2d481383b6de8b3e701b5) Thanks [@sd44](https://github.com/sd44)! - feat(weapp-ide-cli): 添加 `Linux` 平台支持

## 3.0.0

### Major Changes

- [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 更多详情见:

  https://vite.icebreaker.top/migration/v5.htm

### Patch Changes

- Updated dependencies [[`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4)]:
  - @weapp-core/logger@2.0.0

## 2.0.12

### Patch Changes

- [`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 2.0.12-alpha.0

### Patch Changes

- [`007d5e9`](https://github.com/weapp-vite/weapp-vite/commit/007d5e961d751f8f3ab3966595fe9970876d7f8a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 2.0.11

### Patch Changes

- Updated dependencies [[`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b)]:
  - @weapp-core/logger@1.0.4

## 2.0.10

### Patch Changes

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

- Updated dependencies [[`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81)]:
  - @weapp-core/logger@1.0.3

## 2.0.9

### Patch Changes

- [`b32c939`](https://github.com/weapp-vite/weapp-vite/commit/b32c9395ba592a1ea176a553b693ac9c3bee89bf) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: update deps
  fix: [#87](https://github.com/weapp-vite/weapp-vite/issues/87)
  fix: [#86](https://github.com/weapp-vite/weapp-vite/issues/86)

## 2.0.8

### Patch Changes

- Updated dependencies [[`0af89c5`](https://github.com/weapp-vite/weapp-vite/commit/0af89c5837046dfca548d62427adba9b4afc2d6a)]:
  - @weapp-core/logger@1.0.2

## 2.0.7

### Patch Changes

- [`ea7be91`](https://github.com/weapp-vite/weapp-vite/commit/ea7be91e0d230b499691ae75239659c4586346af) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support multi-platform software

## 2.0.6

### Patch Changes

- [`8fe26ae`](https://github.com/weapp-vite/weapp-vite/commit/8fe26ae86f1365f46a2242e616441c7cfd7c7926) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: 修复 build 构建后不停止的问题

## 2.0.5

### Patch Changes

- [`c0146d3`](https://github.com/weapp-vite/weapp-vite/commit/c0146d31304f35db5b3a03aa9f9497ed46688730) Thanks [@sonofmagic](https://github.com/sonofmagic)! - improve init script and allow init project by `npx weapp init`

## 2.0.4

### Patch Changes

- [`598753c`](https://github.com/weapp-vite/weapp-vite/commit/598753ced4f0c40ec971b28a4e98e4a18b35525a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: deps upgrade

## 2.0.3

### Patch Changes

- [`b40bc77`](https://github.com/sonofmagic/weapp-tailwindcss/commit/b40bc7716861343bc63ca3a9fa8ade9388614ae8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Date: 2024-09-01
  - 重构 `vite` 上下文的实现
  - 优化自定义的路径的显示效果

## 2.0.2

### Patch Changes

- 6f469c3: fix: execa cjs import error

## 2.0.1

### Patch Changes

- Updated dependencies [f7a2d5d]
  - @weapp-core/logger@1.0.1

## 2.0.0

### Major Changes

- 80ce9ca: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`

### Patch Changes

- f22c535: chore: compact for `weapp-vite`
- 36f5a7c: release major version
- Updated dependencies [f22c535]
- Updated dependencies [36f5a7c]
  - @weapp-core/logger@1.0.0

## 2.0.0-alpha.2

### Patch Changes

- 36f5a7c: release major version
- Updated dependencies [36f5a7c]
  - @weapp-core/logger@1.0.0-alpha.1

## 2.0.0-alpha.1

### Patch Changes

- 792f50c: chore: compact for `weapp-vite`
- Updated dependencies [792f50c]
  - @weapp-core/logger@0.0.1-alpha.0

## 2.0.0-alpha.0

### Major Changes

- ffa21da: `@weapp-ide-cli` cjs -> esm ( `type: module` ) (BREAKING CHANGE!)

  `weapp-vite` use `@weapp-ide-cli`

  `vite.config.ts` support

  enhance `@weapp-core/init`
