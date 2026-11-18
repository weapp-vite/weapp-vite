---
"weapp-vite": minor
---

feat(weapp-vite): 支持按引用裁剪小程序 npm 产物

支持通过 `weapp.npm.pruneUnusedFiles` 按最终产物引用闭包裁剪小程序 npm 包内未使用的文件，并覆盖主包、分包、独立分包和插件输出。
