---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生小程序页面在默认 layout 已经生效的情况下再次调用 `setPageLayout('default')` 仍会触发额外 layout 状态更新的问题，避免页面内容区域被重复挂载并导致子组件 `attached` 生命周期执行两次。
