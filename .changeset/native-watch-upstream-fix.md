---
"weapp-vite": patch
"create-weapp-vite": patch
"rolldown-require": patch
"@weapp-vite/web": patch
---

更新 Rolldown 至 1.2.12，接入上游 macOS 原生监听修复，避免监听路径未变化时重启事件流造成保存事件丢失，改善连续保存和路由拓扑更新的构建可靠性。

同步适配上游状态保持 HMR 的 ESM 图协议及内联辅助函数布局，在原生输出钩子中保留宿主 CommonJS 格式与 sourcemap，继续校验完整运行时契约。
