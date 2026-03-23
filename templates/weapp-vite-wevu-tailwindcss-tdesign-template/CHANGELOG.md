# weapp-vite-wevu-template

## 1.0.5

### Patch Changes

- 🐛 **重构 `weapp-vite-wevu-tailwindcss-tdesign-template` 的 `useDialog()` 实现，统一 alert / confirm 在 layout 宿主与直接组件调用两种模式下的打开流程，并移除对宿主旧 `properties` 的回灌。这样可以从根本上避免旧按钮配置残留到后续弹窗，减少实现分叉并让 alert / confirm 行为更稳定。** [`1f086dc`](https://github.com/weapp-vite/weapp-vite/commit/1f086dc7602c642d6371064af792877dc1f5c29e) by @sonofmagic

- 🐛 **修复动态页面布局模板在重复应用 layout transform 时可能被再次包裹的问题。此前同一个页面在经过多轮 transform / 构建后，`wx:if` 动态 layout 分支会整体再嵌套一层，导致切换到 `admin` 布局时出现重复的 `layouts/admin.vue` 页面壳。现在动态 layout 包裹逻辑已保持幂等，并补充对应测试，确保同一页面模板不会被重复注入 layout 分支。** [`1a5da11`](https://github.com/weapp-vite/weapp-vite/commit/1a5da1142ddae8362f9f46cc691a4f186cfa7811) by @sonofmagic

- 🐛 **修复 `weapp-vite-wevu-tailwindcss-tdesign-template` 中 Layout 通信演示页的页面级按钮点击无响应问题。此前事件绑定在包裹 `t-button` 的外层 `view` 上，导致点击时没有稳定触发页面方法；现在改为直接绑定到 `t-button`，使页面触发 Toast、Alert、Confirm 与子组件示例保持一致。** [`ed97136`](https://github.com/weapp-vite/weapp-vite/commit/ed971363e68f2b245fda1e71d34f2ced65803407) by @sonofmagic

- 🐛 **为 `weapp-vite` 增加开发态输出目录清理开关 `weapp.cleanOutputsInDev`，并将开发态默认行为调整为“不在 `dev` / `dev -o` 启动前全量清空小程序输出目录”。这样模板和项目在默认配置下即可减少开发模式的磁盘清理开销；如果需要恢复旧行为，可显式设置 `cleanOutputsInDev: true`。** [`0dbdb30`](https://github.com/weapp-vite/weapp-vite/commit/0dbdb304cd3db1df579d0e828ae17beb29194bb2) by @sonofmagic

- 🐛 **修复 `wevu` 中 `setPageLayout()` 在页面 `watch` / `watchEffect` 回调里调用时可能丢失页面上下文的问题。现在页面实例会更早挂载 layout setter，响应式监听回调也会恢复创建时的当前实例；同时 `setPageLayout()` 会优先回退到运行时维护的当前页面实例，使 `setup()` 内部的 `immediate` watcher 以及后续响应式切换都能稳定驱动 layout 更新。同步更新 TDesign wevu 模板中的 store-layout 演示页，重新使用 watcher 驱动 `setPageLayout()` 以覆盖这一场景。** [`3ba325a`](https://github.com/weapp-vite/weapp-vite/commit/3ba325ac4538637f8828c5a4cc3c3815ebce10a7) by @sonofmagic

- 🐛 **修复 `weapp-vite-wevu-tailwindcss-tdesign-template` 中 Layout 通信演示页的 alert 弹窗底部左侧残留空白按钮位的问题。宿主模式下打开 alert 时，改为显式清空 `cancelBtn`，避免 TDesign `t-dialog` 将空字符串当作取消按钮配置渲染出空白占位。** [`b24ce4b`](https://github.com/weapp-vite/weapp-vite/commit/b24ce4b7d4df1c29ccec40dcc9ef6b5c09972612) by @sonofmagic

- 🐛 **为 `weapp-vite-wevu-tailwindcss-tdesign-template` 增加一个 `wevu/store` 驱动 layout 交互的演示页。新示例展示了 store 如何保存布局状态与交互意图，再由页面上下文消费这些命令并调用 `setPageLayout()`、`useToast()`、`useDialog()`，从而命中 `default` 与 `admin` layout 中承载的反馈宿主。** [`d7a9073`](https://github.com/weapp-vite/weapp-vite/commit/d7a9073c79fc68161c049d36b78d5ba3cc21567c) by @sonofmagic

- 🐛 **调整 `weapp-vite-wevu-tailwindcss-tdesign-template` 中 Store 调用 Layout 演示页的交互职责。现在页面本身不再直接调用 `useToast()` / `useDialog()`，而是由 `wevu/store` 内的 action 直接触发 toast、alert 与 confirm，并通过当前页面的 layout 宿主完成展示，使示例更符合“store 统一调度交互反馈”的目标。** [`b807fdc`](https://github.com/weapp-vite/weapp-vite/commit/b807fdc8a1ced4f31d43d4c8b5ec095e4e76d5ec) by @sonofmagic

## 1.0.4

### Patch Changes

- 🐛 **修复两个 wevu + TDesign 模板中 `Toast/Dialog` 反馈宿主的挂载位置。模板现在将反馈节点放回实际触发它们的页面或组件，避免首页、布局页和零售模板相关页面在微信开发者工具中触发提示时出现“未找到组件,请检查selector是否正确”的运行时警告。** [`792e343`](https://github.com/weapp-vite/weapp-vite/commit/792e3432568246bee4513ef006d4de7a15ed1925) by @sonofmagic

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
