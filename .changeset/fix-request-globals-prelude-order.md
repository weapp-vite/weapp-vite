---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复启用 Web runtime prelude 时初始化器及其同步依赖反向加载 prelude 的循环依赖，并在 prelude 需要外部初始化模块时保留唯一模块实例，避免 app 再次内联执行初始化器。
