<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/changelog.html -->

# 小程序音视频通话插件更新日志

## 2.4.6

1. 增加了 camera-device 组件
2. 优化

## 2.4.5

1. 增加了 Voip 视频通话时的微信视频编码参数

## 2.4.4

1. 优化

## 2.4.2 - 2.4.3

1. 修复：拨打后快速挂断，可能导致后续通话发起失败的问题。

## 2.4.1

1. 新增：使用 [`callDevice`](./api/callDevice.md) 和 [`callWMPF`](./api/callWMPF.md) 呼叫设备时，可以不需要用户 [授权](../voip/auth.md) 。
2. 修复：部分情况下静音和免提状态错误问题。

## 2.4.0

1. 新增：新接口 [`callDevice`](./api/callDevice.md) 支持微信呼叫 Linux 设备。
2. 新增：新接口 [`callWMPF`](./api/callWMPF.md) 优化微信呼叫安卓 WMPF 的能力，并支持使用 license 计费。
3. 优化：梳理和补充各类报错的 [错误码](./api/errCode.md) 。
4. 优化：为避免与设备组混淆，groupId 统一更名为 roomId。groupId 参数作为别名仍保留。
5. 优化：通话稳定性优化。

## 2.3.10

1. 新增：支持设置自定义按钮点击后弹出的半屏高度为 75vh（默认 90vh）。
2. 修复：调用 `onVoipEvent` 的返回值无法正常 off 事件监听的问题。
3. 修复：点击屏幕隐藏按钮后按钮仍能响应点击的问题。
4. 修复：部分 UI 布局问题。
5. 优化：通话页面屏蔽分享防止用户误操作。

## 2.3.9

1. 新增：视频通话过程中支持点击屏幕隐藏按钮。
2. 新增： [setVoipEndPagePath](./api/setVoipEndPagePath.md) 支持自定义页面跳转方式。
3. 优化：部分 UI 样式调整。
4. 优化：通话稳定性优化。

## 2.3.8

1. 新增： [initByCaller](./api/initByCaller.md) 支持使用 timeLimit 参数设置最大通话时长。
2. 新增： [initByCaller](./api/initByCaller.md) 返回 chargeType 表示当次通话使用时长还是 License 计费。
3. 新增：支持支付刷脸设备使用 License。
4. 新增： [setUIConfig](./api/setUIConfig.md) 支持设置 objectFit。
5. 优化：设备端如果设置了跳转页面，通话结束后不显示通话详情。
6. 优化：偶现通话时间显示异常问题。
7. 优化：通话稳定性优化。
