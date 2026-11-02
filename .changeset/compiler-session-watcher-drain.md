---
"weapp-vite": patch
---

fix(compiler): 关闭编译会话时先排空其上下文中的开发控制器与监听器，再释放共享资源，避免 classic HMR 交接后的监听器继续访问已删除的项目目录；保留并去重清理错误。
