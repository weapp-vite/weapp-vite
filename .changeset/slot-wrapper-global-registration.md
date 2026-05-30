---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 具名插槽 fallback wrapper 的产物稳定性：微信平台内部 `virtualHost` wrapper 改为固定输出到根级内部组件路径，并优先通过 `app.json` 全局注册，减少页面和组件 JSON 的重复变更；同时允许显式配置 `slot-wrapper="block"`，默认策略仍保持更稳妥的内部 wrapper。
