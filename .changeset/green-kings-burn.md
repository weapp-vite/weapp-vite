---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

压缩内联事件编译产物中的 dataset 属性名与 inline id：将 `data-wv-inline-id-*` / `data-wv-handler-*` / `data-wv-event-detail-*` 分别缩短为 `data-wi-*` / `data-wh-*` / `data-wd-*`，并把 `__wv_inline_*` 形式的内联表达式 id 缩短为更短的稳定 id。运行时同步支持新旧 dataset key 的兼容读取，以减少大型小程序项目的 WXML 包体积，同时避免历史产物在升级后直接失效。
