---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 dev 模式下直接编辑页面模板时，增量构建可能用局部入口图重写 wevu vendor shared chunk，导致业务 chunk 继续访问 `computed` 等运行时短导出时出现缺失的问题。
