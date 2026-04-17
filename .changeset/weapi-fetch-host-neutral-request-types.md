'@wevu/api': patch
'wevu': patch
'create-weapp-vite': patch
---

继续扩展多平台小程序类型契约：`@wevu/api` 新增 `WeapiMiniProgramRequestTask`、`WeapiMiniProgramRequestSuccessResult`、`WeapiMiniProgramRequestMethod`、`WeapiMiniProgramSystemInfo`、`WeapiMiniProgramSelectorQuery` 等宿主中立别名，`wevu/fetch` 也改为直接复用这些类型。这样后续接入支付宝小程序、抖音小程序时，请求与查询相关类型不再需要直接依赖 `WechatMiniprogram.*` 命名。
