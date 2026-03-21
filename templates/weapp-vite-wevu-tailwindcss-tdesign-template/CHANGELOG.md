# weapp-vite-wevu-template

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
