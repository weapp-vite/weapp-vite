---
"wevu": patch
"create-weapp-vite": patch
---

为 `wevu` 的 `setData` 新增了两项运行时性能能力：`suspendWhenHidden` 用于页面/组件进入后台态后挂起并合并更新，在回到前台时再一次性下发；`diagnostics` 用于输出内建的 `setData` 诊断日志，便于定位高频更新、回退 diff 与 payload 体积问题，同时保持现有 `debug` 回调兼容。
