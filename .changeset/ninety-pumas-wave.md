---
"@wevu/api": patch
---

进一步提升 `weapi` 三端语义对齐：新增 `openCustomerServiceChat`、`createVKSession`、`compressVideo`、`openVideoEditor`、`getShareInfo`、`joinVoIPChat`、`openDocument` 的显式映射与 synthetic shim；补充 `saveVideoToPhotosAlbum` 在抖音侧映射到 `saveImageToPhotosAlbum`。同步更新测试、类型文档与兼容性报告，显著降低高频 fallback 缺口。
