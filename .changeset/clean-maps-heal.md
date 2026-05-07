---
"wevu": patch
"create-weapp-vite": patch
---

修复 `useRoute()` 在 `custom-tab-bar` 等页面栈尚未就绪的 setup 场景中返回根路径的问题。现在页面栈为空时会回退到当前 setup 实例上的页面路径，确保自定义 tab bar 内也能拿到当前页面路由。
