---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复启用 `weapp.es5` 时，`appPrelude.webRuntime` 和用户 prelude 注入代码仍包含现代 JavaScript 语法的问题。

将 ES5 降级统一放到最终产物处理阶段，覆盖 `require`、`entry` 和 `inline` 三种 prelude 模式，以及以 asset 发出的 `app.prelude.js`，避免可选链、箭头函数和块级变量声明遗漏转换。同时保留 sourcemap 和增量构建所需的标记注释。
