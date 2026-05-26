---
"@wevu/compiler": patch
"wevu": patch
"@weapp-core/constants": patch
---

为 `useTemplateRef()` 生成并暴露稳定的模板节点 `id`，在保留原有 class selector 的同时，让 `useElementIntersectionObserver()` 等依赖 id selector 的小程序 API 可以直接复用模板 ref 元数据。
