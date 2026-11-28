---
title: App Prelude 与 Web Runtime 注入
description: App Prelude 与 Web Runtime 全局对象注入的功能入口，帮助你区分前置脚本和 Web 风格全局对象注入。
keywords:
  - app.prelude
  - web runtime
  - global injection
---

# App Prelude 与 Web Runtime 注入

`weapp-vite` 提供两类容易混淆、但经常一起使用的运行时增强：

- [App Prelude](/guide/app-prelude)：在小程序 `app`、页面、组件等入口执行前插入一段前置脚本。
- [Web Runtime 全局对象注入](/guide/web-runtime-globals)：把 `fetch`、`Headers`、`XMLHttpRequest`、`WebSocket` 等 Web 风格全局对象安装到小程序运行环境。

它们解决的是两个不同问题：

| 功能                     | 解决的问题                                         | 配置入口                                                     |
| ------------------------ | -------------------------------------------------- | ------------------------------------------------------------ |
| App Prelude              | 代码执行时机，适合在业务入口前运行自包含初始化脚本 | [`weapp.appPrelude`](/config/app-prelude)                    |
| Web Runtime 全局对象注入 | 第三方依赖对 Web 全局对象的运行环境假设            | [`weapp.appPrelude.webRuntime`](/config/web-runtime-globals) |

`appPrelude.mode` 现在有四种模式。原有的 `inline`、`entry`、`require` 保留自定义前置脚本行为，也保留原有 Web Runtime 注入路径与默认时机；新增的 `native` 必须显式选择，才启用 hybrid Web Runtime 绑定。`native` 下自定义 prelude 是普通静态模块，不再生成 `app.prelude.js` 或承担启动协调。

`native` 类似 transform-runtime：自由标识符精确注入且不写全局，明确全局语义按目标桥接；动态或间接全局访问可用 `globalTargets` 声明。它不读取依赖包名，不提供策略选项，也不生成 installer、eager 状态或 axios 专用补丁；`appPrelude.webRuntime.prelude: true` 只把绑定、桥接与实现拆进独立 vendor chunk，不改变安装时机。完整边界见 [Web Runtime 全局对象注入](/guide/web-runtime-globals#native-模式如何绑定)，模式与默认值详见 [App Prelude 配置](/config/app-prelude#mode) 和 [Web Runtime 全局对象注入配置](/config/web-runtime-globals)。

如果你只是想做浏览器预览，请看 [Web 运行时配置](/config/web)。这里讨论的是“小程序产物中如何提供前置脚本与 Web 风格模块绑定”。

## 继续阅读

- [App Prelude](/guide/app-prelude)
- [Web Runtime 全局对象注入](/guide/web-runtime-globals)
- [App Prelude 配置](/config/app-prelude)
- [Web Runtime 全局对象注入配置](/config/web-runtime-globals)
