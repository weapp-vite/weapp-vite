---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复通过符号链接或 Windows junction 使用项目时，同一页面入口被重复输出的问题，保持主包与独立分包的页面产物归属一致。
