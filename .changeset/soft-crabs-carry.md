---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复原生 HMR 的 Noop 批次同时包含编译器依赖和普通脚本时丢失编译器更新的问题，并隔离已丢弃脚本的变更原因，保留原生脚本恢复与后续补丁交付行为。
