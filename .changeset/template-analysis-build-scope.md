---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

复用单次模板组件标签分析，减少重复解析并保持标签识别与错误警告行为不变。

将 classic HMR 的强制共享 chunk 刷新状态隔离到当前构建上下文，并完善模块图的构建作用域释放、监听会话清理及入口依赖所有权管理，避免并发构建和会话重启之间相互污染。
