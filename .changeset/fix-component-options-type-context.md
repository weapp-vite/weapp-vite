---
"wevu": patch
"create-weapp-vite": patch
---

修复组件 Options API 与选项式 Store 中 this 的类型上下文，保留 setup 响应式绑定的解包类型，并补齐组件名称宏配置类型。
