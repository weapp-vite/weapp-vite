---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `weapp.autoImportComponents: true` 的默认展开行为。现在该布尔开关除了启用组件目录扫描外，还会默认开启 `auto-import-components.json`、`typed-components.d.ts`、`mini-program.html-data.json` 和 `vueComponents` 等辅助产物输出，避免模板项目只写 `true` 时缺少 IDE 补全与清单文件。
