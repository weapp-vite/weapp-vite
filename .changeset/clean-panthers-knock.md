---
'wevu': patch
'create-weapp-vite': patch
---

修复在 `setup()` 返回 `getCurrentSetupContext()` 时可能进入 `setData` 快照并触发递归爆栈的问题，同时补充对应回归测试，并将 composition api 的 weapp e2e 用例拆分为可单独执行的页面级 case。
