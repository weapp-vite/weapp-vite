---
'wevu': patch
'create-weapp-vite': patch
---

修复 `defineComponent` 在未提供 `setup` 时仍然注册内部 `setupWrapper` 的问题，避免与首屏同步快照逻辑叠加后，在组件 `attached` 阶段同步多触发一次 `setData`。这样可以恢复无 `setup` 组件的挂载时序稳定性，消除合并 `main` 后在 CI 中出现的 `__wvOwnerId` 额外同步回归。
