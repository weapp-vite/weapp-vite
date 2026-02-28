# weapp-ide-cli

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
