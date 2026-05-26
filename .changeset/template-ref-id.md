---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"wevu": patch
---

调整 `useTemplateRef()` 的模板 ref 元数据，仅保留基于 class 的 `selector` 作为节点定位入口，不再为普通模板 ref 自动生成或暴露额外 `id`，并同步收敛共享常量导出。
