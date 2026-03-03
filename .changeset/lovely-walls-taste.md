---
'create-weapp-vite': patch
---

继续收敛 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 的类型与静态检查问题：移除模板 `src` 中的 `@ts-nocheck`，补齐 mock 工具与服务/模型函数签名，修复订单与优惠券相关类型不一致及重复字段定义，确保模板在默认配置下稳定通过 `typecheck`、`eslint` 与 `build`。
