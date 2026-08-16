---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式下原生组件模板等 sidecar 文件在原子保存时可能因模块图短暂缺失而漏掉增量构建的问题，确保已注册的入口依赖持续参与 HMR。
