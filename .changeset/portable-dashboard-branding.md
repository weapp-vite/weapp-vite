---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Dashboard 品牌图标对官网目录和 SVG loader 的隐式依赖：使用包内可由 Node 直接加载的内联图标，保持 Hub 外观不变，使源码 CLI 启动和隔离发布打包均可正常运行。
