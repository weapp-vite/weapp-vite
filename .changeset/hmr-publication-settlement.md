---
"@weapp-vite/hmr": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

为 HMR 交付队列提供可等待的稳定边界，并将状态保持宿主的快照重建与产物发布纳入验收等待，避免页面已更新但后台发布尚未完成时提前采样。失败会明确拒绝等待，修复后仍可继续等待新的成功交付。
