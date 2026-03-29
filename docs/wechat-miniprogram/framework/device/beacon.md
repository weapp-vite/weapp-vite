<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/beacon.html -->

# 蓝牙信标 (Beacon)

> 基础库 1.2.0 开始支持。

蓝牙信标 (Beacon) 是建立在 [蓝牙低功耗 (BLE)](./ble.md) 协议基础上的一种广播协议。

Beacon 设备作为蓝牙低功耗协议中的外围设备，持续向周围广播包含设备标识的特定数据包，但不能和中心设备建立连接。小程序运行的设备作为中心设备，可以收到 Beacon 设备的广播包，实现数据交互。常用于室内定位、消息推送等场景。

小程序中，开发者可以通过 [wx.startBeaconDiscovery](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.startBeaconDiscovery.html) 开始搜索 Beacon 设备，并通过 [wx.onBeaconUpdate](https://developers.weixin.qq.com/miniprogram/dev/api/device/ibeacon/wx.onBeaconUpdate.html) 接收设备更新事件。

## 1. 设备标识

每个 Beacon 设备的广播包中，至少携带了以下信息，共同组成了设备的唯一标识符。

- UUID (16 字节)：128 位的 UUID，用于唯一标识小程序所识别的一系列信标设备。
- major (2 字节)：0 - 65535 的无符号整数，可以用来区分相同 UUID 的一组设备。
- minor (2 字节)：0 - 65535 的无符号整数，可以用来区分有相同 UUID 和 major 的设备。

## 2. 设备状态

当小程序接收到 Beacon 设备的信号时，还会提供下列信息

- rssi: 信号强度，单位为 dBm。
- proximity: Beacon 标识设备距离的枚举值（仅 iOS）。
- accuracy: Beacon 设备的距离，单位为米。

## 3. 注意事项

- Beacon 相关接口可以直接使用，不需要使用 [wx.openBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html) 初始化蓝牙适配器模块
- 由于 Beacon 可以被用来进行定位，因此需要微信有系统的位置权限时才能使用。
