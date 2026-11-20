---
"create-weapp-vite": patch
"weapp-vite": patch
---

fix(weapp-vite): 处理 WXML 扫描中的文件删除竞争

修复开发监听中 WXML 文件在检查后、读取前被删除时导致构建进程退出的问题。清理该文件的扫描缓存和依赖，恢复文件后继续编译。
