---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 wevu runtime import 重写，在 chunk 明显不包含 wevu runtime 引用时提前跳过正则扫描，减少普通页面和组件 chunk 的生成阶段遍历成本。
