---
"weapp-vite": patch
"create-weapp-vite": patch
---

将六个历史示例应用迁移到内置 Tailwind CSS 集成，保留单位转换与根选择器设置，补齐由 App 直接导入的纯 CSS 生成入口。原生应用继续保留业务样式和未启用 Tailwind preflight 的配置意图，多平台示例保留图标插件与原全局样式，避免外部插件被接管后丢失配置或引用不存在的生成入口。

修复内置 Tailwind 生成入口未进入构建图仍静默成功的问题，并让完整样式使用公开 rawCss 经统一小程序转换与 finalization，保留作者 page/view 规则、单位转换和动态颜色兼容。

保留 `@wv-keep-import` 后处理中的 Tailwind 待生成标记，避免原生 App 同时导入全局 Tailwind 与组件库样式时丢失生成产物。
