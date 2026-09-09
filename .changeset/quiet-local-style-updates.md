---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复页面、组件和 layout 局部样式更新被误判为全局刷新，导致微信开发者工具重载应用并丢失交互状态的问题。内置 Tailwind 样式由正常构建输出统一刷新，关闭额外全局刷新也不会停止 Tailwind 编译；显式开启时仅更新时间戳，不再补写缺失的空样式文件。
