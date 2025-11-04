---
"weapp-vite": patch
---

修复共享 chunk duplicate 后仍指向 `weapp_shared_virtual` 的路径问题，确保入口脚本与 sourcemap 一并重写到各自分包的 `weapp-shared/common.js`。
