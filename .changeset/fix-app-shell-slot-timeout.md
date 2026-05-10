---
"@wevu/compiler": patch
---

修复 `src/app.vue` 应用外壳模板中的普通默认 `<slot />` 被编译为增强 scoped slot generic 的问题，避免微信开发者工具真实运行时加载模板外壳时出现 `WAServiceMainContext.js` timeout。
