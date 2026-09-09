---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Windows 跨盘构建时逻辑入口的样式资产元数据被误当作绝对输出路径的问题，统一从图协议恢复真实页面或组件归属。共享与保留模块分块按真实路径识别逻辑入口源码，避免 junction 工作区中的组件生成与入口同名的第二个 chunk。
