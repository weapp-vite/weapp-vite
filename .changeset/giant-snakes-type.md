---
'create-weapp-vite': patch
---

为 `weapp-vite-wevu-tailwindcss-tdesign-template` 模板新增统一的组件变更事件值解析工具，并将数据页、表单页、筛选栏、组件实验室等场景切换为共享实现。现在模板对 TDesign 与小程序运行时下的值直传、`detail` 直传、`detail.value` 三种常见事件形态都能稳定兼容，减少重复判断与运行时分支不一致问题。
