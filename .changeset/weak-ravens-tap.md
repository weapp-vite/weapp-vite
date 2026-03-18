---
'@wevu/compiler': patch
'create-weapp-vite': patch
---

增强 `defineOptions` 的序列化与内联能力，支持在宏配置中安全引用顶层局部常量；同时将 retail 模板中的遗留 CJS 与 `wxs` 辅助逻辑迁移为 ESM/TypeScript 实现，避免模板脚手架继续产出 CommonJS 风格代码。
