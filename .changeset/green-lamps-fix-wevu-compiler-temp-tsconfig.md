---
"@wevu/compiler": patch
---

修复 `<json lang="ts">`、JSON 宏和 `defineOptions` 在执行临时 TypeScript 配置模块时，Vite 8/OXC 可能因为临时文件不属于任何 tsconfig 而构建失败的问题。
