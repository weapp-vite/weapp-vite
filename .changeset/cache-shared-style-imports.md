---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 shared style import 注入阶段，在单次 CSS bundle pass 内缓存入口样式输出需要注入的 shared style import 语句，避免同一入口在样式资源处理和 HMR 补发阶段重复遍历分包 shared style 规则。
