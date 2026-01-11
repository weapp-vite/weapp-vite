---
"weapp-vite": patch
"wevu": patch
---

修复 autoImportComponents 生成的导航路径优先指向 `.d.ts`，避免组件类型在 Volar 中退化为 `any`。
补充 wevu 宏指令的中文说明与示例，完善类型提示使用说明。
调整 wevu `jsx-runtime` 的 `IntrinsicElements` 以继承 `GlobalComponents`，让小程序组件标签能正确推断属性类型。
