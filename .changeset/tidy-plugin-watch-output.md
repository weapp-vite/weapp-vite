---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发构建使用绝对输出目录时监听排除路径被重复拼接的问题，使独立插件等目标的生成文件正确排除在源文件监听范围外。
