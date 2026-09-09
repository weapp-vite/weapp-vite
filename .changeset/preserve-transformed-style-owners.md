---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复已由 Vite 转换的页面样式被原生 sidecar 磁盘内容覆盖的问题。按当前模块图记录真实样式来源，保留 CSS 预转换结果，并在输出前合并尚未被消费的相邻原生样式，避免重复构建沿用过期的产物归属。
