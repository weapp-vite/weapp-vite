---
'weapp-vite': patch
'create-weapp-vite': patch
---

扩展 `weapp.autoRoutes.include` 配置，支持使用多个 glob 或正则来自定义页面扫描目录与深度，并允许配合 `weapp.subPackages` 识别非 `pages/**` 结构下的分包页面。
