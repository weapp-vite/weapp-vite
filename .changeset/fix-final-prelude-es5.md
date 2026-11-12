---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 `weapp.es5` 未降级后注入的 Web Runtime 和 app prelude 代码的问题，统一处理最终 JavaScript 产物并保留 sourcemap 与增量构建标记。
