'@wevu/api': patch
'wevu': patch
'create-weapp-vite': patch
---

继续增强多平台类型面的宿主中立表达：`@wevu/api` 新增 `WeapiMiniProgramRawAdapter` 与 `WeapiMiniProgramAdapter`，`wevu/fetch` 新增 `MiniProgramRequestMethod`，同时保留原有 `WeapiWx*` / `WxRequestMethod` 兼容导出。这样上层在接入支付宝、抖音等宿主时，可以逐步改用更中立的小程序类型命名，而不必把公共类型心智继续绑定到微信前缀。
