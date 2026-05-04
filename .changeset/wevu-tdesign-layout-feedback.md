---
"create-weapp-vite": patch
---

更新 wevu TDesign 零售模板的节点查询写法，改用 `useBoundingClientRect()` 替代残留的原生 selector query，并补充 `layout-host` 承载 Toast/Dialog 反馈宿主的文档与 skill recipe，方便新项目沿用一致的模板约定。
