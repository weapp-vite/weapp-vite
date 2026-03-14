---
"weapp-vite": patch
"create-weapp-vite": patch
---

将 `typed-router.d.ts`、`typed-components.d.ts` 与 `components.d.ts` 的默认生成位置统一调整到 `weapp.srcRoot` 下，减少模板与示例项目在 `tsconfig` 中对根目录生成文件的额外 `include` 与引用配置。
