---
"wevu": patch
"create-weapp-vite": patch
---

fix(alipay): 避免运行时直接访问 `globalThis` 导致支付宝端报错。

- wevu 运行时在自动注册 App、页面生命周期补丁与 scoped-slot 全局注入场景，改为优先使用小程序全局对象（`wx`/`my`），避免在关键路径直接访问 `globalThis`。
- 修复支付宝模拟器中 `ReferenceError: globalThis is not defined`，兼容不提供 `globalThis` 的运行环境。
