---
"wevu": patch
"create-weapp-vite": patch
---

修复增强 scoped slot 的宿主属性早于 runtime 挂载时，owner proxy 与 slot props 未同步到新 runtime、导致模板计算值回退为空的问题。
