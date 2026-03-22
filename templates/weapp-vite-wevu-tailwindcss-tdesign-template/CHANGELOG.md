# weapp-vite-wevu-template

## 1.0.3

### Patch Changes

- 🐛 **为两个 TDesign wevu 模板统一收敛通用反馈节点：默认 layout 现在承载 `t-toast` 与 `t-dialog`，页面与组件通过封装方法触发提示与确认弹窗，同时补充对应的构建级集成测试，避免页面重新各自挂载通用反馈实例。** [`4e55323`](https://github.com/weapp-vite/weapp-vite/commit/4e553235c1a03d9616a965931a30e304004b6ed2) by @sonofmagic

- 🐛 **修复 `.weapp-vite/tsconfig.app.json` 的默认类型与别名生成：现在会自动注入 `weapp-vite/client`，并让 `@/*` 跟随 `weapp.srcRoot`。同时清理 templates 中仍残留在根目录和 `src/` 下的旧支持文件，统一改由 `.weapp-vite` 托管生成。** [`94320d3`](https://github.com/weapp-vite/weapp-vite/commit/94320d3ec92e3803054e4d8f7dd8e60d7c1f7e12) by @sonofmagic

- 🐛 **将模板中的 Vue SFC 配置从 `<json>` 自定义块统一迁移为 `definePageJson` 与 `defineComponentJson` 等宏指令写法，避免继续生成旧式配置示例。** [`5ba950b`](https://github.com/weapp-vite/weapp-vite/commit/5ba950bfa7918cbe51cec1b6cab8bf5d9f6153a8) by @sonofmagic

## 1.0.2

### Patch Changes

- 🐛 **修复 `<script setup>` 类型声明 props 在小程序运行时的结构化类型告警回归。`@wevu/compiler` 现在会对类型声明生成的 `Array/Object` 类 props 放宽小程序属性校验，避免作用域插槽等场景下出现误报；`weapp-vite-wevu-tailwindcss-tdesign-template` 中的 `KpiBoard` 也因此可以恢复原本的 `defineProps<...>` 与 `#items` 写法，并在 DevTools e2e 中保持 `warn=0`。** [`b387a51`](https://github.com/weapp-vite/weapp-vite/commit/b387a519b85851fe71657a29bd59848dd16ae836) by @sonofmagic

- 🐛 **为 wevu 基础模板补充 `src/layouts` 页面布局能力。新模板现在内置 `default` 与 `admin` 布局示例，并提供可直接体验 `setPageLayout()` 的演示页面，便于新项目开箱即用地组织页面壳与内容区域。** [`6107d39`](https://github.com/weapp-vite/weapp-vite/commit/6107d39834f5c7fa3aacbacd246ccf8dae200404) by @sonofmagic

## 1.0.1

### Patch Changes

- 🐛 **修复 `autoRoutes` 对显式分包根目录的默认扫描回归，补齐源码 CLI 在 Node 22 下的 `createRequire` 绝对路径处理，并将 `tsconfig paths` 解析提升为 `weapp-vite` 默认行为。同步更新 wevu 模板与相关 e2e 断言，确保模板构建、分包输出和自动导入类型产物保持一致。** [`77aac93`](https://github.com/weapp-vite/weapp-vite/commit/77aac9340bcc1505aaecc3cd0ac1d569949e50fb) by @sonofmagic

- 🐛 **统一脚手架模板与仓库模板的忽略规则，默认忽略项目根目录下 `.weapp-vite/` 中的所有内容，为后续沉淀更多本地构建缓存和工具状态文件预留稳定目录约定，避免生成项目后误提交内部缓存产物。** [`2eee335`](https://github.com/weapp-vite/weapp-vite/commit/2eee33515a759635285e34104912558556551690) by @sonofmagic

## 1.0.0

### Minor Changes

- 初始化 weapp-vite + wevu（Vue SFC）模板
