---
"weapp-vite": patch
"create-weapp-vite": patch
---

保持原生状态保持 HMR 中 Vue 样式模块的稳定标识，避免 CSS Modules 编辑被后续批次或完整构建取代后，恢复补丁引用客户端从未收到的样式 factory。
