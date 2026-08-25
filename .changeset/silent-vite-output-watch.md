---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复开发模式下内部 Vite 服务重复监听构建输出目录的问题，避免 Windows 中 Vant Weapp 等生成文件被占用时触发 `EBUSY` 并导致开发服务退出。
