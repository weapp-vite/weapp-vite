---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 build 模式下入口加载阶段的文件存在性缓存复用，让同一轮构建中的页面和组件共享 sidecar 预测路径查询结果，减少多入口项目在 `weapp-vite:pre` 阶段的重复 filesystem lookup；dev/HMR 仍按入口刷新缓存以保留文件增删响应语义。
