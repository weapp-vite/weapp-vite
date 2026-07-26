---
'@mpcore/simulator': minor
'@weapp-core/constants': patch
'@weapp-vite/web': minor
'@wevu/compiler': minor
'create-weapp-vite': patch
'weapp-vite': minor
'wevu': minor
---

新增实验性的 uni-app Vue SFC 组件库兼容层与 `WotUiResolver()`，支持显式白名单依赖的条件编译、外部组件图、样式资源和双端注册，并补齐 Wot UI 2.2.0 全部 99 个公开组件在微信小程序、Web 与 headless 运行时所需的编译和运行时语义。外部组件产物使用微信允许的稳定目录名，避免组件文件因命中双下划线保留目录规则而被开发者工具忽略。
