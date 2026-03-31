---
'@weapp-vite/miniprogram-automator': patch
'@weapp-vite/qr': minor
---

将 `@weapp-vite/miniprogram-automator` 内部的二维码编码、解码与终端渲染能力提取为新的 `@weapp-vite/qr` 包，并让原有 automator API 改为复用该独立包实现，方便在仓库外单独安装与复用。
