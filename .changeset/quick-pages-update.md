---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 页面中 `definePageJson` 仅修改页面 JSON 元数据时的开发热更新路径，避免编辑器原子保存触发完整入口重建，并减少 shared chunk 相关页面的无效重发。
