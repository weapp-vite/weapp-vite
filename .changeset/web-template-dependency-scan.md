---
"@weapp-vite/web": patch
---

递归收集 WXML 模板依赖时跳过不会使用的渲染代码生成，减少包含多层 import/include 模板的重复编译工作，保留依赖解析、顺序及业务告警。
