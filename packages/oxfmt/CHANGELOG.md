# @weapp-vite/oxfmt

## 0.1.2

### Patch Changes

- Updated dependencies:
  - @weapp-vite/language-service@0.1.2

## 0.1.1

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

- Updated dependencies:
  - @weapp-vite/language-service@0.1.1

## 0.1.0

### Minor Changes

- feat(create-weapp-vite): 为多平台模板、样式与脚本模块提供统一的语言诊断、格式化和编辑器能力。

  新增共享语言内核，统一九种模板语言、原生样式和 WXS/SJS/KS/filter 的平台归属、作用域及模块引用。项目通过 `weapp.language` 配置按文件覆盖；CLI 与 VSCode 复用同一份离线平台资料和分析结果，提供语法与平台限制诊断、补全、悬浮、跳转、引用和重命名，不新增完整模板类型检查器。

  格式化保留模板文本、属性值、实体、引号、顺序与显式闭合形式，原生脚本采用方言校验与 AST 等价保护；全部候选文件通过检查后才写入，源码变化或非法输入会拒绝覆盖。保留 `formatWxml` 入口，新增通用格式化与组合 lint 命令。生成项目同步多平台文件关联、唯一格式化提供者和检查脚本，Wevu 保留专项 ESLint，Stylelint 扩大原生样式范围。

  项目文件扫描统一 Windows 路径表示，并将忽略规则查找限制在所属项目内，避免混合路径分隔符导致格式化命令无法结束。

  构建的脚本模块格式与标签属性按平台描述统一处理，修正抖音 SJS 的 CommonJS 输出和百度 import-sjs 的 src/module 属性。支持范围以公开矩阵与静态、CLI、VSCode host、构建回归为准，不代表已完成真实小程序 IDE runtime 验收。

- feat(create-weapp-vite): 精简默认模板选择，并提供内置小程序规则与格式预设的 Vite+ 工程。

  默认展示原生、Wevu、Wevu + TDesign、TailwindCSS、TDesign、Vant 六个模板；React、多平台、插件和组件库移入更多模板，原模板名、显式创建命令与 API 保持兼容。模板选择后独立选择工具链，默认继续使用 wv。

  Vite+ 项目接入新发布的 `@weapp-vite/oxlint` 与 `@weapp-vite/oxfmt`，提供 lint、format、check 脚本与对应编辑器配置；Wevu 保留 Vue 模板专项 ESLint，React 预设补充 hooks 规则，样式继续由 Stylelint 检查。小程序 runtime 与 Wevu API 规则可在普通 Oxlint 项目复用，Oxfmt 预设可单独使用。

  标准 Oxfmt 预设保留 WXSS 的 CSS 关联并忽略 WXML。`weapp-vite-format --write`、`--check`、`--check-all` 将 Vite+ 与安全 WXML 适配器组合，按实际项目 `fmt` 配置及文件 overrides 处理标签空白，保留文本、插值、属性值、内联 WXS 和自闭合语义。生成项目的 format/check 脚本均包含适配器，单独的 `vp fmt` 不代表 WXML 已检查。

  工具链固定配对升级为 Vite+ 1.2.0 与 Vitest 5.0.4，并同步 core alias、严格 peer 和 workspace 约束。已有工作区保留根配置所有权，综合检查与 WXML 适配器遵循根 lint/fmt 策略。模板在发布前准备完整格式化副本，创建时核验内容摘要，保留用户自定义 AGENTS.md；创建和安装时不会隐式运行格式修复。

### Patch Changes

- Updated dependencies:
  - @weapp-vite/language-service@0.1.0
