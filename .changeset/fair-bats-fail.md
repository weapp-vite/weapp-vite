---
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复 issue #309 的页面生命周期边界场景：页面未声明 `onPullDownRefresh` 或使用 `setupLifecycle: 'created'` 时，`onLoad` 仍会稳定触发，同时避免编译阶段重复注入 `__wevu_isPage`。补充对应单元测试与 e2e 用例，防止后续回归。
