---
'weapp-vite': patch
'create-weapp-vite': patch
---

为 weapp-vite 创建的 Vite 实例注入 `config.weappVite` 宿主元信息，并提供配套的检测 helper。这样用户自定义的 Vite 插件可以在 `config` 与 `configResolved` 阶段可靠判断自己当前是运行在 weapp-vite 中，还是普通 Vite 中，同时还能区分 `miniprogram` 与 `web` 两种 weapp-vite 运行面。
