---
"wevu": patch
"create-weapp-vite": patch
---

`wevu/router` 新增 `router.install(app?)` 兼容方法（no-op），用于提升与 Vue Router 插件调用形态的一致性，便于跨端共享代码时减少条件分支。该方法在小程序运行时不执行额外注册逻辑。
