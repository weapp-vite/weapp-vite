---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 修复开发监听中空目录删除后未释放自身监听器的问题，确保目录自身读取确认不存在时及时清理旧目录和原生句柄，避免依赖后续父目录通知。
