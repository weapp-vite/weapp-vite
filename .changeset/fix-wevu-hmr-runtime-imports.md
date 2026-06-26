---
"weapp-vite": patch
---

修复 wevu 项目开发模式下普通 TS 文件从 `wevu` 根入口导入页面 hook 或响应式 API 时，HMR 后可能把运行时成员绑定到错误 vendor chunk 的问题。现在增量构建会稳定重写并补齐 wevu runtime 访问，避免微信开发者工具热更新后出现 `onShareAppMessage is not a function` 或 `unref is not a function`。
