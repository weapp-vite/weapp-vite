---
"weapp-vite": patch
---

修复共享 chunk 在降级回主包或被保留在主包时，入口脚本仍引用已删除的 `weapp_shared_virtual/*` 路径的问题，确保导入被重写为实际落盘的 `common.js` 文件。
