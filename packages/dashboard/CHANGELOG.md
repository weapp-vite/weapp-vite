# @weapp-vite/dashboard

## 6.17.7

## 6.17.6

## 6.17.5

## 6.17.4

## 6.17.3

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`06588a6`](https://github.com/weapp-vite/weapp-vite/commit/06588a6469679c665632bdc6e98f7c93177050de) by @sonofmagic
  - 默认 catalog 变更键：autoprefixer, vite, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

## 6.17.2

## 6.17.1

## 6.17.0

## 6.16.47

## 6.16.46

## 6.16.45

## 6.16.44

### Patch Changes

- 🐛 **升级 workspace catalog 中的 rolldown、Vue、esbuild、sass 与 weapp-tailwindcss 版本，并同步 create-weapp-vite 模板 catalog。安装阶段现在会禁用 pnpm 11 的 optimistic repeat install 早退，确保重新执行 `pnpm i` 时仍会刷新受管 catalog 与 package.json 引用。** [`7df6ac4`](https://github.com/weapp-vite/weapp-vite/commit/7df6ac4c8dfc677aeb63b370c6a835a5baa0c51d) by @sonofmagic

## 6.16.43

### Patch Changes

- 🐛 **模板中的 Tailwind v4 图标插件从 `@egoist/tailwindcss-icons` 迁移到 `@iconify/tailwind4`，并移除模板里的 `tailwind.config.ts`，让 Tailwind 扫描与插件配置统一由 `src/app.css` 管理。** [`44bd5a8`](https://github.com/weapp-vite/weapp-vite/commit/44bd5a89ba172fed7f54fb5f6d769075f21e75d5) by @sonofmagic

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

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`7ad96ca`](https://github.com/weapp-vite/weapp-vite/commit/7ad96ca963731768a386571865053649c67faf69) by @sonofmagic
  - 默认 catalog 变更键：@types/node, @vue/language-core, echarts, lru-cache, rolldown, stylelint, vue-tsc。命名 catalog 变更键：无。

## 6.16.18

## 6.16.17

### Patch Changes

- 🐛 **补发共享常量包，并同步提升所有公开依赖包版本，确保新增的 wevu 函数 props 运行时常量会随用户更新一起解析到 npm 最新产物。** [`362bbd3`](https://github.com/weapp-vite/weapp-vite/commit/362bbd3e3bbed438746fe4db00602204da8c7ec2) by @sonofmagic

## 6.16.16

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`3515293`](https://github.com/weapp-vite/weapp-vite/commit/3515293ede9d200c85ece4c1e6a874dcf7c1eabf) by @sonofmagic
  - 默认 catalog 变更键：@types/node, @vue/language-core, lru-cache, oxc-parser, vue-tsc。命名 catalog 变更键：无。

## 6.16.15

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`74978d8`](https://github.com/weapp-vite/weapp-vite/commit/74978d89dfc25439803b7003119ee57b8fadc27f) by @sonofmagic
  - 默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @types/node, @vitejs/plugin-vue, @vue/language-core, miniprogram-api-typings, rolldown, stylelint, vite, vue-tsc。命名 catalog 变更键：latest(miniprogram-api-typings)。

## 6.16.14

## 6.16.13

### Patch Changes

- 🐛 **将内部调试日志依赖从 `debug` 替换为更轻量的 `obug`，同步脚手架依赖 catalog，并升级 dashboard 路由相关依赖类型以保持当前依赖版本兼容。** [`4276782`](https://github.com/weapp-vite/weapp-vite/commit/4276782841181ef7b540be4eb5e722e979f4363f) by @sonofmagic

## 6.16.12

## 6.16.11

## 6.16.10

## 6.16.9

## 6.16.8

## 6.16.7

## 6.16.6

## 6.16.5

## 6.16.4

### Patch Changes

- 🐛 **在 `dev --ui` 的 dashboard 活动流中展示小程序 HMR 重建 profile，包含总耗时、阶段耗时、入口计数和脏标记原因，便于在开发态直接定位慢重建来源。** [`a9e21dc`](https://github.com/weapp-vite/weapp-vite/commit/a9e21dccc8938f2c3e0b0331423403ab9e4146c5) by @sonofmagic

## 6.16.3

## 6.16.2

### Patch Changes

- 🐛 **增强 analyze 与 dashboard 能力：`wv analyze` 新增组件依赖洞察、包体预算门禁、PR/Markdown 报告、历史快照、真实 gzip/brotli 体积、历史对比、预算告警、重复模块建议、来源细分数据，以及受限源码和产物内容读取能力，方便上层 UI 定位源码到产物的体积差异。** [`a934ef3`](https://github.com/weapp-vite/weapp-vite/commit/a934ef32641a63273fe67453e4177acda2607550) by @sonofmagic
  - 系统增强 Analyze Dashboard：重构分析视图信息架构，新增左侧分析分组导航、可拖拽并本地记忆的视图布局、全局搜索命令面板、导出中心、当前视图链接复制、视图重置、发布门禁、PR 风险清单、处理清单、预算沙盘、包体健康分、历史趋势、源码对比、运行事件摘要和工作台 readiness 摘要，并将 dashboard 本地开发与预览服务默认端口调整为 6188，端口冲突时自动递增。
  - 优化模板、运行时与编辑器体验：模板项目默认安装 `@weapp-vite/dashboard`，补充 `dev:ui` 与 `dev:open:ui` 脚本，并在 VS Code 推荐扩展中加入 weapp-vite 扩展；压缩 wevu 默认发布构建产物，同时提供未压缩开发产物，支持通过 development 条件导出和 `wevu/dev` 子路径切换到可读源码；优化 VS Code 中 WXML 与 Vue template 的 class、`wx:for` 隐式成员表达式和 kebab 名称跳转体验。
  - 稳定微信开发者工具启动链路：应用配置产物现在会始终输出规范的 `subPackages: []`，并在 IDE e2e 启动前校验 `app.json` 的 pages 与分包字段形态，避免开发者工具在模拟器启动阶段读到不完整配置后抛出 `subPackages` 相关错误。

## 6.16.1

## 6.16.0

## 6.15.18

## 6.15.17

## 6.15.16

## 6.15.15

## 6.15.14

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`2a9ea57`](https://github.com/weapp-vite/weapp-vite/commit/2a9ea57748425265c35533646bdc0c3fa70c440f) by @sonofmagic
  - 默认 catalog 变更键：@vue/compiler-core, @vue/compiler-dom, miniprogram-api-typings, rolldown, vite, vue。命名 catalog 变更键：latest(miniprogram-api-typings)。

## 6.15.13

## 6.15.12

## 6.15.11

## 6.15.10

## 6.15.9

### Patch Changes

- 🐛 **基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。** [`624f9ee`](https://github.com/weapp-vite/weapp-vite/commit/624f9ee0bf09d9cf5a5d0815cbff1aa094cdd702) by @sonofmagic
  - 默认 catalog 变更键：@icebreakers/eslint-config, @vue/language-core, rolldown, vite, vue-tsc。命名 catalog 变更键：无。

## 6.15.8

## 6.15.7

## 6.15.6

## 6.15.5

## 6.15.4

## 6.15.3

## 6.15.2

## 6.15.1

## 6.15.0

## 6.14.3

## 6.14.2

## 6.14.1

## 6.14.0

## 6.13.4

## 6.13.3

## 6.13.2

## 6.13.1

### Patch Changes

- 🐛 **同步升级 workspace catalog 与 `create-weapp-vite` 模板 catalog 中的 Vue 相关依赖版本，统一到 `3.5.32`，并刷新 `@types/node`、`@tanstack/vue-query` 及锁文件，确保工作区内发布包、示例应用与脚手架生成结果使用一致的依赖基线。** [`d2ea11e`](https://github.com/weapp-vite/weapp-vite/commit/d2ea11efc6b2248a9a5ee6e5e692646c0562a211) by @sonofmagic

## 6.13.0

## 6.12.4

## 6.12.3

## 6.12.2

## 6.12.1

## 6.12.0

### Patch Changes

- 🐛 **增强 dashboard 的运行事件链路健壮性，统一规范化无效或不完整的事件载荷，并补充事件耗时与元信息展示。同时为 `packages/dashboard` 增加独立的 Vitest 配置，使相关工具测试可以进入工作区测试链路。** [#368](https://github.com/weapp-vite/weapp-vite/pull/368) by @sonofmagic

- 🐛 **增强 `@weapp-vite/dashboard` 的应用壳子，新增工作台、活动流、设计令牌等页面骨架，并将现有 analyze 面板迁移为独立路由页面。现在 dashboard 具备统一导航、全局主题切换和可持续扩展的页面结构，后续接入真实 CLI 事件与诊断数据会更稳定。** [#368](https://github.com/weapp-vite/weapp-vite/pull/368) by @sonofmagic

- 🐛 **优化 dashboard 分析页的运行上下文展示，新增按事件来源聚合的摘要卡片，帮助在分析视图中快速识别不同来源的事件密度、错误数量与平均耗时。** [#368](https://github.com/weapp-vite/weapp-vite/pull/368) by @sonofmagic

- 🐛 **优化 dashboard 中运行事件徽标的视觉表达，统一不同等级与来源摘要的 badge 样式映射，使活动页和分析页的运行状态展示更一致、更易读。** [#368](https://github.com/weapp-vite/weapp-vite/pull/368) by @sonofmagic

- 🐛 **优化 dashboard 活动页的事件控制台，新增按来源过滤与来源聚合摘要卡片，便于在真实 CLI 运行事件流中更快识别不同来源的事件密度、错误数量与平均耗时。** [#368](https://github.com/weapp-vite/weapp-vite/pull/368) by @sonofmagic

## 6.11.9

## 6.11.8

## 6.11.7

## 6.11.6

### Patch Changes

- 🐛 **为 `weapp-vite` 新增 `--ui` 调试入口并保留 `--analyze` 兼容别名，同时将 dashboard 升级为单页多面板分析 UI，集中展示包体、分包、产物文件与跨包模块复用细节。** [`f278c9f`](https://github.com/weapp-vite/weapp-vite/commit/f278c9f04bb4b17138cbb3bb21f2f969585d08d3) by @sonofmagic

## 6.11.5

## 6.11.4

## 6.11.3

## 6.11.2

## 6.11.1

## 6.11.0

## 6.10.2

## 6.10.1

## 6.10.0

### Minor Changes

- ✨ **将 `weapp-vite analyze` 的仪表盘资源从主包中拆分为独立的可选安装包 `@weapp-vite/dashboard`。未安装该包时，CLI 会提示对应的安装命令并自动降级为仅输出分析结果，不再要求主包默认携带大体积 dashboard 静态资源。** [`be412dd`](https://github.com/weapp-vite/weapp-vite/commit/be412dda3507e7c29cb25be0e90d5e5374f18fde) by @sonofmagic
