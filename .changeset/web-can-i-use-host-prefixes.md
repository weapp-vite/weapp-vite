'@weapp-vite/web': patch
---

增强 Web 运行时的小程序宿主兼容层：`canIUse` 现在不仅支持 `wx.*`，也会识别 `my.*`、`tt.*` 等宿主前缀，并从共享宿主注册表里解析当前可用 bridge。与此同时，导航栏相关 warning 文案也改成更中立的 `miniProgram.*` 语义，方便后续对齐支付宝小程序、抖音小程序等多宿主场景。
