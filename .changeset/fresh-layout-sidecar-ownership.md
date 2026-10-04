---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复多个页面共享原生布局或组件时，构建依赖与 sourcemap 可能混入父页面 JSON、模板和组件声明的问题。逻辑入口现在确认元数据所属源码，并在子入口尚未加载时读取自身配置，使构建结果不再受父页面登记顺序影响。
