---
"weapp-vite": patch
"create-weapp-vite": patch
---

统一经典开发模式 snapshot、watcher 与热更新的 Vue 源文件缓存失效流程，避免删除页面后重新发射旧 SFC 产物，并保留原子替换页面的重新编译能力。
