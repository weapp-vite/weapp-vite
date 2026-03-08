---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `autoRoutes` 生成路由类型在 `defineAppJson` 场景下的 `subPackages` 类型兼容性问题：为 `AutoRoutesSubPackage` 增加字符串索引签名，并在 `typed-router.d.ts` 生成的分包对象字面量中同步注入 `[k: string]: unknown`。修复后，`routes.subPackages` 可直接用于 `defineAppJson({ subPackages })`，避免 `vue-tsc` 报告 TS2769 类型不匹配错误。
