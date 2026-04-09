---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复未显式配置 `autoImportComponents` 的 wevu 项目默认不会生成 `.weapp-vite/components.d.ts`、`typed-components.d.ts` 与 `mini-program.html-data.json` 的问题。现在 wevu 应用在默认配置下也会自动产出组件类型支持文件，补齐 Vue SFC 全局组件的模板智能提示基础能力。
