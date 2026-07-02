---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 CSS 生成阶段，同一个 CSS 资源被多个入口引用时在单次 bundle pass 内复用预处理和小程序 CSS 转换结果，只保留各入口专属的 shared style import 注入与输出，减少 build/HMR 中重复处理同一份样式资源的成本。
