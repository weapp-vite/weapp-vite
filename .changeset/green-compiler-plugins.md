---
"weapp-vite": minor
"create-weapp-vite": patch
---

新增可扩展的 `weapp.compilerPlugins` 底层编译插件协议，允许第三方编译器参与 CSS、WXML、JavaScript、bundle 与 HMR 生命周期；现有 `weapp.tailwindcss` 配置继续兼容。
