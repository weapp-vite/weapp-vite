---
"create-weapp-vite": patch
---

迁移模板 ESLint 配置以使用新版预设内置的小程序兼容规则，避免新建项目因重复注册 Wevu 插件而无法执行 lint，并移除冗余的直接依赖。
