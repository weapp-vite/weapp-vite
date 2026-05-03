# weapp-vite-wevu-template

## 1.0.5

### Patch Changes

- 🐛 **为 wevu 模板补齐默认布局、管理布局和布局示例页，使脚手架生成的 Vue SFC 模板与布局能力保持一致。** [`f8f7d3d`](https://github.com/weapp-vite/weapp-vite/commit/f8f7d3d7bd7751aa595f3d4d9dea90bf809b9ff0) by @sonofmagic

- 🐛 **精简 wevu 与 wevu + Tailwind CSS + TDesign 脚手架模板，仅保留最小首页入口，并将原有 layout、分包、表单、样式绑定等验证性页面迁移到 e2e-apps 回归用例中。** [`b76e310`](https://github.com/weapp-vite/weapp-vite/commit/b76e31079fccca9d254b9fb44750969ba59f470a) by @sonofmagic

## 1.0.4

### Patch Changes

- 🐛 **将脚手架生成项目中的 `AGENTS.md` 改为由 `create-weapp-vite` 统一动态生成，不再在各模板目录中重复维护近似副本。新的 AGENTS 指引会集中补充 `weapp-vite` 的 CLI / prepare / screenshot / ide logs 用法、`wevu` 模板的运行时编写约束，以及推荐安装的 AI skills 列表，降低后续模板间文案漂移和维护成本。** [`14f3885`](https://github.com/weapp-vite/weapp-vite/commit/14f38856796ae70ccf9015b51554b6f6f0c820aa) by @sonofmagic

- 🐛 **将仓库内模板默认的 `dev`、`build`、`open`、`generate`、`prepare` 等 CLI 脚本调用从 `weapp-vite` 统一切换为 `wv`，让模板项目与当前推荐的命令别名保持一致。同时为脚手架生成的新项目默认注入根目录 `AGENTS.md`，明确告知 AI 代理安装依赖后优先阅读 `node_modules/weapp-vite/dist/docs/` 下的随包文档，并在做小程序截图验收时优先使用 `weapp-vite screenshot` / `wv screenshot`，在需要查看终端日志时优先使用 `weapp-vite ide logs --open` / `wv ide logs --open`。此外，`weapp-vite` npm 包会同步发布 `dist/docs` 本地文档目录，减少 AI 在其他仓库里依赖过时外部资料的概率。同步补充 `create-weapp-vite` 的版本变更，确保脚手架生成的新项目默认携带同一套命令与 AI 指引。** [`acf8c14`](https://github.com/weapp-vite/weapp-vite/commit/acf8c14a4657859ca305c128bc86145228f3e524) by @sonofmagic

## 1.0.3

### Patch Changes

- 🐛 **修复 `.weapp-vite/tsconfig.app.json` 的默认类型与别名生成：现在会自动注入 `weapp-vite/client`，并让 `@/*` 跟随 `weapp.srcRoot`。同时清理 templates 中仍残留在根目录和 `src/` 下的旧支持文件，统一改由 `.weapp-vite` 托管生成。** [`94320d3`](https://github.com/weapp-vite/weapp-vite/commit/94320d3ec92e3803054e4d8f7dd8e60d7c1f7e12) by @sonofmagic

- 🐛 **将模板中的 Vue SFC 配置从 `<json>` 自定义块统一迁移为 `definePageJson` 与 `defineComponentJson` 等宏指令写法，避免继续生成旧式配置示例。** [`5ba950b`](https://github.com/weapp-vite/weapp-vite/commit/5ba950bfa7918cbe51cec1b6cab8bf5d9f6153a8) by @sonofmagic

## 1.0.2

### Patch Changes

- 🐛 **为 wevu 基础模板补充 `src/layouts` 页面布局能力。新模板现在内置 `default` 与 `admin` 布局示例，并提供可直接体验 `setPageLayout()` 的演示页面，便于新项目开箱即用地组织页面壳与内容区域。** [`6107d39`](https://github.com/weapp-vite/weapp-vite/commit/6107d39834f5c7fa3aacbacd246ccf8dae200404) by @sonofmagic

## 1.0.1

### Patch Changes

- 🐛 **将 `weapp-vite-wevu-template` 的默认页面从功能演示风格调整为更正式的业务模板风格，统一首页、概览、工作台和设置页的信息架构、命名语义与视觉层级，减少生成项目后的演示痕迹，使模板更适合作为实际小程序项目的起点。** [`79b065e`](https://github.com/weapp-vite/weapp-vite/commit/79b065e2fed56f35bb1f07a736feaf623ea3dc38) by @sonofmagic

- 🐛 **修复 `autoRoutes` 对显式分包根目录的默认扫描回归，补齐源码 CLI 在 Node 22 下的 `createRequire` 绝对路径处理，并将 `tsconfig paths` 解析提升为 `weapp-vite` 默认行为。同步更新 wevu 模板与相关 e2e 断言，确保模板构建、分包输出和自动导入类型产物保持一致。** [`77aac93`](https://github.com/weapp-vite/weapp-vite/commit/77aac9340bcc1505aaecc3cd0ac1d569949e50fb) by @sonofmagic

- 🐛 **统一脚手架模板与仓库模板的忽略规则，默认忽略项目根目录下 `.weapp-vite/` 中的所有内容，为后续沉淀更多本地构建缓存和工具状态文件预留稳定目录约定，避免生成项目后误提交内部缓存产物。** [`2eee335`](https://github.com/weapp-vite/weapp-vite/commit/2eee33515a759635285e34104912558556551690) by @sonofmagic

## 1.0.0

### Minor Changes

- 初始化 weapp-vite + wevu（Vue SFC）模板
