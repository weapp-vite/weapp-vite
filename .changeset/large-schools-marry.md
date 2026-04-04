---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `autoImportComponents` 使用对象配置时未自动继承支持文件默认输出的问题。现在像 `VantResolver()` 这类 resolver 场景，即使只配置 `resolvers`，也会默认生成 `.weapp-vite/typed-components.d.ts`、`components.d.ts` 与 `mini-program.html-data.json`，补齐模板项目中的组件智能提示与类型声明。
