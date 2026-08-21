---
"weapp-vite": minor
"create-weapp-vite": patch
---

新增 `weapp.styles` 主包共享样式入口，可生成独立的目标平台样式文件，并按作用范围注入主包与普通分包页面或组件；支持通过 `inject: false` 仅生成文件，同时保持独立分包的资源隔离。
