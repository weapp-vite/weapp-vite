---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic 开发构建中 public 资源覆盖未重写编译产物的问题，将 public 文件纳入 bundler 发布与删除归属；入口拓扑与上次完整扫描结果比较，避免局部元数据构建提前更新缓存后遗漏页面和组件移除。同时串行化初次构建与启动期间收到的增量事件，防止共享缓存和输出目录被并发构建破坏。
