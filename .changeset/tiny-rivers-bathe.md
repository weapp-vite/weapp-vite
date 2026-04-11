'weapp-vite': patch
'create-weapp-vite': patch
---

收敛小程序运行时预置注入代码中的内部私有命名，缩短请求全局对象与 app prelude 相关的 guard key、共享字段和 helper 标识符，减少最终构建产物中的冗长内部字段名，同时保持原有运行时行为与兼容性不变。
