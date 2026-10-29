---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(watch): 自有文件监听统一经过内部接口，生产继续使用 Chokidar；保留 WXML 初始化及释放失败时的资源回收修复。Parcel 仅供仓库开发对照，不加入直接运行依赖或公开切换配置。
