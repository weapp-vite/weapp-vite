---
'@mpcore/simulator': patch
'@weapp-vite/ast': patch
'@weapp-vite/mcp': patch
'@weapp-vite/web': patch
'@wevu/compiler': patch
'@wevu/web-apis': patch
'create-weapp-vite': patch
'wevu': patch
---

修复多个发布包在严格 TypeScript 校验下的类型问题，补齐 `tsd` 类型回归测试，并同步收敛 `wevu`、`@weapp-vite/mcp`、`@wevu/web-apis` 与 `create-weapp-vite` 的类型契约，减少后续重构时的类型回退风险。
