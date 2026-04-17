'@wevu/api': patch
'create-weapp-vite': patch
---

继续扩展 `@wevu/api` 的宿主中立公共类型：新增 `WeapiMiniProgramUpdateManager`、`WeapiMiniProgramLogManager`、`WeapiMiniProgramVideoContext`、`WeapiMiniProgramBluetoothError`、`WeapiMiniProgramClipboardDataResult` 等别名，并把相关定义拆分到独立类型文件，减少核心类型文件体积。这样后续在支付宝小程序、抖音小程序等多宿主适配时，可以继续用统一的 `MiniProgram*` 命名消费这些高频运行时类型。
