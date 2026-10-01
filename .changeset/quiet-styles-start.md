---
"wevu": patch
"create-weapp-vite": patch
---

为编译器绑定清单中的样式与类名补齐原生首次挂载占位值，避免仅使用 setup 的组件向原生 String 属性传入空值，同时保留显式数据及 setData 过滤规则。
