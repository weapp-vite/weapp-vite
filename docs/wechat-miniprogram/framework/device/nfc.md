<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/nfc.html -->

# NFC

> 支持平台：Android

支持 HCE（基于主机的卡模拟）模式，即将安卓手机模拟成实体智能卡。 支持 NFC 读写，即手机作为读卡器使用。

- 适用机型：支持 NFC 功能，且系统版本为 Android 5.0 及以上的手机
- 适用卡范围：符合 ISO 14443-4 标准的 CPU 卡
- 支持 Reader / Writer（读取器 / 写入器）模式，即支持 NFC 设备读取或写入被动 NFC 标签和贴纸
- 适用机型：支持 NFC 功能，且系统版本为 Android 5.0 及以上的手机
- 适用范围：
    - 支持 NFC-A (ISO 14443-3A) / NFC-B (ISO 14443-3B) / NFC-F (JIS 6319-4) / NFC-V (ISO 15693) / ISO-DEP (ISO 14443-4) 标准的读写
    - （部分 Android 手机）支持 MIFARE Classic / MIFARE Ultralight 标签的读写
    - 支持对 NDEF 格式的 NFC 标签上的 NDEF 数据的读写

## 基本流程

以往 NFC-A 卡片写入 apdu 指令为例

- 调用 wx.getNFCAdapter() 获取 NFC 适配器实例
- 调用 NFCAdapter.onDiscovered(function callback) 注册贴卡监听回调
- 调用 NFCAdapter.startDiscovery(Object object) 开始监听贴卡
- 贴卡，onDiscovered 回调
    - 根据 onDiscovered 回调 res 对象的 techs 字段匹配到卡片支持 NFC-A 标准
    - 通过 NFCAdapter.getNfcA() 获取 NfcA 实例
- 使用 NfcA 实例进行读写
    - 调用 NfcA.connect() 和 NFC 卡片建立连接
    - 调用 NfcA.transceive(Object object) 往 NFC 卡片写入 apdu 指令并接收卡片返回数据
    - 读写完毕，调用 NfcA.close() 断开连接
- 调用 NFCAdapter.stopDiscovery(Object object) 结束监听贴卡

## NFC 标签打开小程序

除了上述的小程序基础 NFC 能力，微信还支持通过 NFC 卡片快捷拉起小程序页面的能力。可用于智能设备的快速配网、快捷控制等场景。

详细文档请参考： [NFC 标签打开小程序](../open-ability/NFC.md) 。
