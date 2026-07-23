---
"create-weapp-vite": patch
"wevu": patch
---

修复小程序返回上一页后 `router.currentRoute` 未恢复的问题；通过 `router.back()`、原生返回或系统返回回到来源页后，可以再次 `router.push()` 进入同一目标页，并保持 `useRoute()` 与导航守卫来源状态一致。
