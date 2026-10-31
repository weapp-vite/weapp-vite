---
'create-weapp-vite': minor
'weapp-vite': patch
'@weapp-vite/oxlint': minor
'@weapp-vite/oxfmt': minor
---

feat(create-weapp-vite): 精简默认模板选择，并提供内置小程序规则与格式预设的 Vite+ 工程。

默认展示原生、Wevu、Wevu + TDesign、TailwindCSS、TDesign、Vant 六个模板；React、多平台、插件和组件库移入更多模板，原模板名、显式创建命令与 API 保持兼容。模板选择后独立选择工具链，默认继续使用 wv。

Vite+ 项目接入新发布的 `@weapp-vite/oxlint` 与 `@weapp-vite/oxfmt`，提供 lint、format、check 脚本与对应编辑器配置；Wevu 保留 Vue 模板专项 ESLint，React 预设补充 hooks 规则，样式继续由 Stylelint 检查。小程序 runtime 与 Wevu API 规则可在普通 Oxlint 项目复用，Oxfmt 预设可单独使用。

标准 Oxfmt 预设保留 WXSS 的 CSS 关联并忽略 WXML。`weapp-vite-format --write`、`--check`、`--check-all` 将 Vite+ 与安全 WXML 适配器组合，按实际项目 `fmt` 配置及文件 overrides 处理标签空白，保留文本、插值、属性值、内联 WXS 和自闭合语义。生成项目的 format/check 脚本均包含适配器，单独的 `vp fmt` 不代表 WXML 已检查。

工具链固定配对升级为 Vite+ 1.2.0 与 Vitest 5.0.4，并同步 core alias、严格 peer 和 workspace 约束。已有工作区保留根配置所有权，综合检查与 WXML 适配器遵循根 lint/fmt 策略。模板在发布前准备完整格式化副本，创建时核验内容摘要，保留用户自定义 AGENTS.md；创建和安装时不会隐式运行格式修复。
