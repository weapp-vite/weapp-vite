---
"wevu": patch
"create-weapp-vite": patch
---

fix(wevu)：修复组件 attrs 同步会混入运行时 state 字段的问题，避免 useAttrs 读取到 doubled、attrsSummary 等内部数据；同时将 runtime e2e 页面中的 `<text selectable>` 调整为 `user-select` 以消除平台弃用告警。
