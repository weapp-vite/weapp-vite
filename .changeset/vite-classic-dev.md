---
"weapp-vite": minor
"create-weapp-vite": patch
---

标准 Vite 插件新增实验性 classic 开发模式，普通 Vite 与 Vite+ 可直接启动小程序开发服务，复用独立 CLI 的增量编译调度。支持首次落盘、源码更新、页面增删、错误恢复和宿主配置重启，关闭时等待正在执行的构建；修复 classic 删除页面后旧产物残留的问题。stateful 与高级目标继续分阶段开放。
