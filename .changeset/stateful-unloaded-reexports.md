---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 JSX/TSX 页面热更新引用尚未执行的重导出模块时丢失模块工厂、触发完整重启的问题。状态保持 HMR 按需加载主包内的孤立依赖 chunk，保留当前页面和交互状态，并将客户端补丁失败原因传回开发服务日志。
