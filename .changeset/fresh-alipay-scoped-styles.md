---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复支付宝和抖音 Vue SFC scoped 样式在真实 IDE 中不生效的问题，将模板作用域标记与样式选择器同步转换为 class，保留动态 class、插槽作用域与样式热更新支持。
