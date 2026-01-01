---
"weapp-vite": patch
---

修复 Vue SFC `<script setup>` JSON 宏（`definePageJson/defineComponentJson/defineAppJson`）在 dev 下热更新不稳定、以及把配置从 `xxx1` 改回 `xxx` 时产物 `.json` 字段偶发丢失的问题：

- 避免直接修改 `@vue/compiler-sfc` 的 `descriptor`（其内部存在 `parseCache`），防止缓存对象被污染导致宏被“永久剥离”。
- 让宏内容变化能够稳定影响最终 JS 产物，从而触发增量构建与微信开发者工具刷新。
