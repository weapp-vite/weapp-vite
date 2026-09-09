---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复启用 Web runtime prelude 时初始化器及其同步依赖反向加载 prelude 的循环依赖，并在 prelude 需要外部初始化模块时保留唯一模块实例，避免 app 再次内联执行初始化器。

依赖分析按编译后的 JavaScript 语义解析 CommonJS 与 ESM，兼容 CommonJS 中合法的函数与 var 同名声明。

所有 Web API 产物绑定注入均保留模块已有声明，避免覆盖 polyfill 函数或与解构绑定重复声明；明确指定空绑定集合时不再重新注入全部 API。
