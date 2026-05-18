---
"wevu": patch
"create-weapp-vite": patch
---

修复同一轮更新中 setup 返回对象内的 loading ref 先触发刷新时，后续 reactive 数组 push 可能被调度去重吞掉，导致列表首屏未渲染新增项的问题。
