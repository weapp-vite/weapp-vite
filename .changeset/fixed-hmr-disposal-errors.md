---
"weapp-vite": patch
"@weapp-vite/hmr": patch
"create-weapp-vite": patch
---

fix(hmr): 保留 HMR 编译准备和交付资源的释放错误，独立尝试并等待所有清理操作；编译与清理同时失败时保留编译首错，交付释放失败后阻止后续交付，并让重复关闭共享完整的错误结果。
