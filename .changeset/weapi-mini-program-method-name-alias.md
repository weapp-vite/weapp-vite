'@wevu/api': patch
'create-weapp-vite': patch
---

为 `@wevu/api` 的方法目录新增宿主中立别名 `WeapiMiniProgramMethodName`，并继续保留 `WeapiWxMethodName` 兼容导出。这样消费侧可以逐步从微信命名迁移到更通用的小程序命名，后续接入支付宝小程序、抖音小程序时也更容易对齐公共类型面。
