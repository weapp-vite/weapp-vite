# @weapp-vite/ast

## 6.15.14

## 6.15.13

## 6.15.12

## 6.15.11

## 6.15.10

## 6.15.9

## 6.15.8

## 6.15.7

### Patch Changes

- 🐛 **继续收敛多平台小程序适配的共享 contract 与宿主中立命名。`@weapp-core/shared` 现在提供更安全的运行时根入口与独立的 Node 子入口，统一平台 registry、宿主全局对象、模板指令前缀、路由与 capability 描述，避免小程序环境误入 Node-only 能力；`weapp-vite`、`@weapp-vite/ast`、`@wevu/compiler`、`wevu`、`@wevu/api`、`@weapp-vite/web` 与 `weapp-ide-cli` 则统一消费这套 contract，补齐 `a` / `tt` / `s` 等结构指令识别、默认平台回退、配置读取与多宿主 bridge 挂载逻辑，减少核心链路里散落的 `wx` 单宿主假设。** [`27c655f`](https://github.com/weapp-vite/weapp-vite/commit/27c655f20e4f033cbefa0920a1b60a55343a22f1) by @sonofmagic
  - 同时继续扩展公共 API 与运行时类型面的宿主中立别名，包括 `miniProgramRouter`、`AutoRoutesMiniProgramRouter`、`WeapiMiniProgramMethodName`、`WeapiMiniProgramAdapter`、`WeapiMiniProgramRequestTask`、`WeapiMiniProgramRequestSuccessResult`、`MiniProgramRequestMethod`、`MiniProgramSelectorQuery`、`MiniProgramIntersectionObserver`、`MiniProgramRouter`、`MiniProgramLaunchOptions` 等，并保持原有 `wx` / `WeapiWx*` 兼容导出不变。这样后续接入支付宝小程序、抖音小程序、百度小程序等宿主时，可以逐步迁移到统一的小程序命名与共享平台能力，而不需要继续把公共类型和内部模板协议绑定到微信前缀。
  - 在 Web 运行时侧，也继续把多平台桥接协议做成宿主中立模型：`canIUse` 支持解析 `wx.*`、`my.*`、`tt.*` 等前缀，模板事件属性默认输出 `data-mp-on-*` / `data-mp-on-flags-*`，并把 bridge 同步挂到 `wx`、`my`、`tt`、`swan`、`jd`、`xhs` 等宿主全局对象上。这样同一套运行时与工具链在多小程序平台之间更容易复用，也为后续平台接入继续收窄改造面。
- 📦 **Dependencies** [`1f76780`](https://github.com/weapp-vite/weapp-vite/commit/1f76780d69a3e0a7f8d9d197f50865c7d6d0c3b3)
  → `@weapp-core/shared@3.0.4`

## 6.15.6

## 6.15.5

## 6.15.4

## 6.15.3

## 6.15.2

## 6.15.1

## 6.15.0

## 6.14.3

### Patch Changes

- 🐛 **修复多个发布包在严格 TypeScript 校验下的类型问题，补齐 `tsd` 类型回归测试，并同步收敛 `wevu`、`@weapp-vite/mcp`、`@wevu/web-apis` 与 `create-weapp-vite` 的类型契约，减少后续重构时的类型回退风险。** [`b9a3e5b`](https://github.com/weapp-vite/weapp-vite/commit/b9a3e5b8fc6259ae5d77eba359aca3632d083b75) by @sonofmagic

## 6.14.2

## 6.14.1

### Patch Changes

- 🐛 **同步升级构建链路与模板目录中的部分依赖版本，包括 `rolldown`、`vite`、`rolldown-plugin-dts`、`@inquirer/prompts` 及相关 lint 配置，并更新 `create-weapp-vite` 内置模板 catalog 的对应版本映射。** [`8bb15f2`](https://github.com/weapp-vite/weapp-vite/commit/8bb15f2f5db775bb2cec4b1d90e6c6ac746e50aa) by @sonofmagic

## 6.14.0

## 6.13.4

## 6.13.3

## 6.13.2

## 6.13.1

## 6.13.0

## 6.12.4

## 6.12.3

## 6.12.2

## 6.12.1

## 6.12.0

### Minor Changes

- ✨ **增强 `@weapp-vite/ast` 面向多小程序平台分析场景的共享 helper 导出，补充 `platformApi`、`require`、`scriptSetupImports`、`featureFlags`、`jsxAutoComponents`、`onPageScroll`、`componentProps` 等操作中的可复用纯函数，并完善对应单元测试覆盖，便于跨 Babel/Oxc 引擎复用一致的分析能力。** [`c46de52`](https://github.com/weapp-vite/weapp-vite/commit/c46de52e65ed10146784ab583580600daa4320bf) by @sonofmagic

## 6.11.9

## 6.11.8

## 6.11.7

## 6.11.6

## 6.11.5

## 6.11.4

## 6.11.3

## 6.11.2

## 6.11.1

## 6.11.0

## 6.10.2

## 6.10.1

## 6.10.0

## 6.9.1

## 6.9.0

### Minor Changes

- ✨ **为 `@weapp-vite/ast` 新增 `collectJsxAutoComponentsFromCode` 共享分析能力，并让 `@wevu/compiler` 的 JSX 自动组件收集逻辑复用该公共实现。这样可以继续把 Babel/Oxc 双后端 AST 分析能力从业务包中抽离出来，减少重复实现并统一后续扩展入口。** [`3021847`](https://github.com/weapp-vite/weapp-vite/commit/302184760fc7680d7f57ec3ecd50664311652808) by @sonofmagic

- ✨ **为 `@weapp-vite/ast` 新增 Babel AST 只读节点辅助与 JSX 模块分析辅助，包括类型包裹表达式解包、对象静态属性读取，以及从 Babel AST 中提取 JSX 自动组件分析所需的导入组件和默认导出组件表达式，进一步减少 `@wevu/compiler` 中的重复 AST 分析实现。** [`7296b72`](https://github.com/weapp-vite/weapp-vite/commit/7296b723d46a62060d48830af578852d56dbc339) by @sonofmagic

- ✨ **新增 `@weapp-vite/ast` 共享 AST 分析包，统一封装 Babel/Oxc 解析能力以及平台 API、require、`<script setup>` 导入分析等通用操作，并让 `weapp-vite` 与 `@wevu/compiler` 复用这套内核，降低后续编译分析工具的维护分叉成本。** [`7bc7ecc`](https://github.com/weapp-vite/weapp-vite/commit/7bc7ecca2aef913b0751d18f9c0f586bd582dc01) by @sonofmagic
