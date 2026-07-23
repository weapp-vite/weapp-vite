# @weapp-vite/ast

## 6.18.5

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`71e0e70`](https://github.com/weapp-vite/weapp-vite/commit/71e0e70cc7a466d67236a406d47f261ac57c815b) by @sonofmagic
  - 默认 catalog 变更键：@vue/language-core, oxc-parser, postcss, rolldown, sass, stylelint, vue-tsc, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。
  - 同时适配 Monaco Editor 0.56 的 worker 公开入口，恢复 Dashboard 构建。
- 📦 **Dependencies** [`9097806`](https://github.com/weapp-vite/weapp-vite/commit/9097806cf6a88144ddb161532dd77bbf78a44ccb)
  → `@weapp-core/shared@3.0.6`

## 6.18.4

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`213a8e6`](https://github.com/weapp-vite/weapp-vite/commit/213a8e6a410198b54c499e29ad8c5d8d86bbaeb2) by @sonofmagic
  - 默认 catalog 变更键：@vitejs/plugin-vue, @vue/compiler-core, @vue/compiler-dom, autoprefixer, oxc-parser, rolldown, vite, vue, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

## 6.18.3

## 6.18.2

## 6.18.1

## 6.18.0

### Minor Changes

- ✨ **新增可选的 native AST 批量分析与性能评估能力，将同一份脚本上的多项静态检查合并为一次 JS 与 Rust 通信和一次解析，并在 bundle rewrite 热路径复用分析缓存。native binding 未配置、加载失败或执行失败时继续回退 Babel、Oxc 与 Vue compiler 路径，保持现有构建兼容性。** [`1f62703`](https://github.com/weapp-vite/weapp-vite/commit/1f62703e60b9db5223ef349ad4dff7ac4f16bdfc) by @sonofmagic

## 6.17.8

## 6.17.7

## 6.17.6

## 6.17.5

## 6.17.4

## 6.17.3

## 6.17.2

### Patch Changes

- 📦 **Dependencies** [`75e79fb`](https://github.com/weapp-vite/weapp-vite/commit/75e79fb08afc3165ff66fefeffe42623ffb48d62)
  → `@weapp-core/shared@3.0.5`

## 6.17.1

### Patch Changes

- 🐛 **修复升级 rolldown 后因全局覆盖 Vite 内部 rolldown 版本导致的构建失败；现在保留 Vite 声明的内部 rolldown 版本，同时继续校验工作区直接使用的 rolldown 版本保持一致。** [`ba39ecc`](https://github.com/weapp-vite/weapp-vite/commit/ba39ecc7ca44117428bf8fba9a19c4684d0623dc) by @sonofmagic

## 6.17.0

### Minor Changes

- ✨ **升级 Babel 相关依赖到 8.x，并同步适配 Babel 8 的 AST 与 ESM 导出变化。WXS 转换继续保持 CommonJS/ES5 输出，Vue SFC 编译和 VS Code 扩展中的动态 import、泛型剥离、可选链调用识别、组件宏元数据提取和脚手架依赖目录也同步兼容新的 Babel 行为。** [#690](https://github.com/weapp-vite/weapp-vite/pull/690) by @sonofmagic

## 6.16.47

### Patch Changes

- 🐛 **修正 Oxc 引擎下 `onPageScroll` 性能诊断的遍历边界，避免重复扫描已命中的回调体，并跳过嵌套函数声明中的调用，降低 HMR 热路径上的无效 AST 遍历。** [`dda8c7a`](https://github.com/weapp-vite/weapp-vite/commit/dda8c7a917017407e314839a9799b0faf13f5a8a) by @sonofmagic

- 🐛 **优化 HMR 热路径中的 AST 预检逻辑，减少组件属性和页面特性分析在无关源码上的 Babel/Oxc 解析开销，并为 HMR lab 增加 Babel/Oxc 引擎横向对比报告能力。** [`477ca39`](https://github.com/weapp-vite/weapp-vite/commit/477ca391b93313286412a62a468b854c4b3ccbf2) by @sonofmagic

## 6.16.46

## 6.16.45

## 6.16.44

## 6.16.43

## 6.16.42

## 6.16.41

## 6.16.40

## 6.16.39

## 6.16.38

## 6.16.37

## 6.16.36

## 6.16.35

## 6.16.34

## 6.16.33

## 6.16.32

## 6.16.31

## 6.16.30

## 6.16.29

## 6.16.28

## 6.16.27

## 6.16.26

## 6.16.25

## 6.16.24

## 6.16.23

## 6.16.22

## 6.16.21

### Patch Changes

- 🐛 **增强原生小程序渐进迁移到 weapp-vite 的项目 skill，补充工具链优先接入、原生页面与 Vue SFC 共存、分波次迁移、回滚边界和验证矩阵说明，方便既有小程序在不一次性重写的前提下逐步采用现代化工程链路。** [`f3868b2`](https://github.com/weapp-vite/weapp-vite/commit/f3868b23d1483ab7d9af14f78d11ac914a368f78) by @sonofmagic

## 6.16.20

## 6.16.19

## 6.16.18

## 6.16.17

### Patch Changes

- 🐛 **补发共享常量包，并同步提升所有公开依赖包版本，确保新增的 wevu 函数 props 运行时常量会随用户更新一起解析到 npm 最新产物。** [`362bbd3`](https://github.com/weapp-vite/weapp-vite/commit/362bbd3e3bbed438746fe4db00602204da8c7ec2) by @sonofmagic

## 6.16.16

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`3515293`](https://github.com/weapp-vite/weapp-vite/commit/3515293ede9d200c85ece4c1e6a874dcf7c1eabf) by @sonofmagic
  - 默认 catalog 变更键：@types/node, @vue/language-core, lru-cache, oxc-parser, vue-tsc。命名 catalog 变更键：无。

## 6.16.15

## 6.16.14

## 6.16.13

### Patch Changes

- 🐛 **修复 `@weapp-vite/ast` 的 Babel `generate` 包装函数类型边界，避免消费方在依赖树中同时存在 Babel 7 与 Babel 8 RC 类型时出现 AST 节点类型不兼容，恢复 `weapp-vite` 包级 typecheck。** [`36e8f68`](https://github.com/weapp-vite/weapp-vite/commit/36e8f687807f04e5a0fb64650477f1b5c72c6db2) by @sonofmagic

## 6.16.12

## 6.16.11

## 6.16.10

## 6.16.9

### Patch Changes

- 🐛 **将当前发布分支的运行时代码回滚到 6.16.7 稳定基线，仅保留 issue #553、#554、#555 与 #563 的修复，避免 6.16.8 中 scoped slot 运行时同步改动继续影响页面运行。** [#568](https://github.com/weapp-vite/weapp-vite/pull/568) by @sonofmagic

## 6.16.8

## 6.16.7

## 6.16.6

### Patch Changes

- 🐛 **将会进入小程序运行时、编译链路和回归示例的 `Object.hasOwn()` 调用改为兼容的 `Object.prototype.hasOwnProperty.call(...)` 封装，并补充 ESLint 限制，避免 Rolldown 无法降级的运行时内建 API 进入小程序产物。** [`43bcefc`](https://github.com/weapp-vite/weapp-vite/commit/43bcefc22656df15897ff5cb960cdbe3f106d04b) by @sonofmagic

## 6.16.5

## 6.16.4

## 6.16.3

## 6.16.2

## 6.16.1

## 6.16.0

## 6.15.18

## 6.15.17

## 6.15.16

## 6.15.15

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
