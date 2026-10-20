---
"wevu": patch
"create-weapp-vite": patch
---

为微信宿主运行时的发布声明保留显式 SDK 类型引用，并将所需 typings 作为正式依赖发布；配置和纯类型入口继续保持无宿主声明依赖。
