---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

修复同一轮更新中 setup 返回对象内的 loading ref 先触发刷新时，后续 reactive 数组 push 可能被调度去重吞掉，导致列表首屏未渲染新增项的问题。

同时修复 `wevu` 产物 hash 中包含短横线时，`weapp-vite` 未能继续把运行时 shared chunk 稳定重命名到 `weapp-vendors/wevu-src.js` 的问题，避免开发者工具热重载时旧模块引用悬空。
