---
'weapp-vite': patch
'create-weapp-vite': patch
---

增强 `autoImportComponents` 的 resolver 支持文件生成策略。现在 resolver 可以声明 `.weapp-vite` 支持文件采用“按需”还是“全量”收集；内置第三方 resolver 默认会在 `prepare` / 支持文件同步阶段为其静态组件全集生成 `auto-import-components.json`、`typed-components.d.ts`、`components.d.ts` 与 `mini-program.html-data.json`，从而补齐未在模板中直接使用的组件智能提示，同时保持运行时自动导入仍按实际命中工作。
