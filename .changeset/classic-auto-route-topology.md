---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic 开发模式新增、删除和恢复自动路由页面后，仅更新路由类型而未重建小程序产物的问题。路由目录监听器把结构变化直接交给当前构建控制器；独立 CLI 和 Vite 宿主共享同一通知链，普通文件修改仍由模块依赖图处理。
