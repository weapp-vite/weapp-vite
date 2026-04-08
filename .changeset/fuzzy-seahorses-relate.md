---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite dev` 里按 `s` 默认截图仍写入 `.tmp` 的路径约定不一致问题；现在会统一保存到项目根目录的 `.weapp-vite/dev-screenshots`，与仓库已有的本地支持文件和内部缓存目录保持一致。
