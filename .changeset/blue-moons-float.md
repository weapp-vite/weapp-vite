---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `autoImportComponents.globs = []` 会被默认扫描规则覆盖的问题。现在可以只保留 `autoImportComponents.resolvers`，同时通过手写 `import XXX from 'xxx.vue'` 明确控制组件导入，不再强制启用基于 `components/**` 的自动扫描。
