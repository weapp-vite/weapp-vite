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

如果你只是想做浏览器预览，请看 [Web 运行时配置](/config/web)。这里讨论的是“小程序产物中如何提前安装运行时能力”。

## 继续阅读

- [App Prelude](/guide/app-prelude)
- [Web Runtime 全局对象注入](/guide/web-runtime-globals)
- [App Prelude 配置](/config/app-prelude)
- [Web Runtime 全局对象注入配置](/config/web-runtime-globals)
