---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(watch): 修复文件监听初始化与关闭错误的归属，保留 UNC 路径身份，并限制逻辑模块实现 chunk 的文件名长度。
