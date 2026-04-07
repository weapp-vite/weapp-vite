# @weapp-vite/dashboard

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
