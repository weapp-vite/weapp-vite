---
"weapp-vite": patch
"wevu": patch
---

修复 autoImportComponents 生成的导航路径优先指向 `.d.ts`，避免组件类型在 Volar 中退化为 `any`。
补充 wevu 宏指令的中文说明与示例，完善类型提示使用说明。
