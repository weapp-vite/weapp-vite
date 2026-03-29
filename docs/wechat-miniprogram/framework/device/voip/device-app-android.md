<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/device-app-android.html -->

# 开发安卓设备端应用

在安卓设备端，开发者需要运行一个安卓应用（文档中也称为小程序 Launcher），用来进行设备注册、运行小程序进行 VOIP 通话等操作。

## 1. 接入 WMPF 并运行小程序

在安卓平台上，小程序视频通话能力是在小程序中实现的。需要由设备端运行的安卓应用拉起开发者开发的小程序来发起和接听音视频通话。

在完成开发前准备「3.1 接入微信硬件平台」，并进行设备注册后，可以获得 WMPF 运行所需的 `productId` 、 `keyVersion` 、 `deviceId` 、 `signature` 等硬件信息。

请参考 [WMPF 文档](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/quick-start.html) 中的说明，完成下列操作：

- 部署 WMPF Service APK；
- 参考 WMPF 提供的示例代码在应用中集成 WMPF Client；
- 调用 [activateDevice](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/device/activateDevice.html) 完成设备激活；

## 2. 设备注册

在发起通话前，需要先完成设备注册。请参考 [设备认证文档](../device-register.md) 完成 RPMBD 服务的部署、SDK 接入和设备注册的步骤。

完成设备注册后，可以在发起通话前通过 SDK 的 `getDeviceToken` 接口获取设备票据，传递到小程序内做为调用 VOIP 插件发起通话的 voipToken 使用。

**注意：**

- **此处使用的 SN，必须经过 WMPF 的 [addDevice](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/backend/addDevice.html) 接口作为 deviceId 注册，并与 WMPF [设备激活](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/boot/init.html) 使用的 deviceId 一致。** 否则后续无法正常发起通话。
- 使用设备认证 SDK 时需要保证 rpmbd 服务已经成功运行。

## 3. 运行小程序

完成 WMPF 安装和设备激活后，便可以调用 [launchMiniProgram](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/launchMiniProgram.html) 启动指定的小程序。

### 3.1 安卓应用与小程序通信

小程序启动后，应用可以通过下列方式和小程序内进行通信

- 简单的「安卓应用 -> 小程序」单向单此传递参数的场景，可以直接在启动小程序的 path 中拼接 query。
- 如果安卓应用要接收小程序发来的事件、需要双向通信或者数据量大时可以通过 WMPF 提供的 [通信通道(Invoke Channel)](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/invoke-channel.html)

### 3.2 运行开发版/体验版小程序

在使用开发版/体验版小程序进行调试时，请参照下列步骤。

**注意：必须扫码登录后才能正常下载开发版/体验版。开发版/体验版更新后，建议重启 WMPF 以更新到最新。**

1. 开发者在开发者工具点击「预览」，将开发版小程序代码包上传到后台。也可提交成体验版；
2. 在 WMPF 上调用 [login](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/account/login.html) 弹出扫码登录界面，由在开发者工具上登录的同个微信号扫码登录；
3. WMPF [launchMiniProgram](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/launchMiniProgram.html) 时指定 appType 为开发版或体验版；
4. 开发版有有效期，过期后需要重新进行上述步骤
