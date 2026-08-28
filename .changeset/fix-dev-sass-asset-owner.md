---
"create-weapp-vite": patch
"weapp-vite": patch
---

修复 Sass/Less 等预处理样式资产在 Vite 占位符阶段再次处理时的 URL 解析问题，并补充 dev、HMR 与 production 回归覆盖。
