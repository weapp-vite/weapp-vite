---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复支付宝平台原生 SCSS 样式 HMR 时，新生成的预处理样式可能被旧的 `.acss` 输出覆盖，导致样式热更新结果没有写入最终产物的问题。
