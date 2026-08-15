---
title: Vue SFC 开发
description: 这里是 Vue SFC 开发的入口说明。完整内容已迁移到 Wevu 文档目录：Weapp-vite 负责编译期（.vue →
  小程序产物），Wevu 负责运行期（响应式与生命周期）。
keywords:
  - Vue SFC
  - guide
  - vue
  - sfc
  - 开发
  - 这里是
  - 开发的入口说明。完整内容已迁移到
  - Wevu
---

# Vue SFC 开发

这里是 Vue SFC 开发的入口说明。完整内容已迁移到 `wevu` 文档目录：Weapp-vite 负责编译期（`.vue` → 小程序产物），Wevu 负责运行期（响应式与生命周期）。

需要用同一份 Vue SFC 覆盖微信、支付宝、抖音、百度、京东、小红书与 Web 时，可以直接创建 `multi-platform-sfc` 模板：

```sh
pnpm create weapp-vite my-app multi-platform-sfc
```

该模板从 `wevu` 导入 Runtime API，使用 `defineAppJson` / `definePageJson` / `defineComponentJson` 生成平台配置，并通过 `wv prepare -p weapp` 维护 `.weapp-vite` 类型文件。逐平台命令、便携模板约束和分层验收边界见[多平台构建指南](/guide/multi-platform)。

## 目录

- [总览](/wevu/vue-sfc/)
- [基础与组成](/wevu/vue-sfc/basics)
- [配置与宏](/wevu/vue-sfc/config)
- [模板与指令](/wevu/vue-sfc/template)
- [示例](/wevu/vue-sfc/examples)
- [调试与排错](/wevu/vue-sfc/troubleshoot)
