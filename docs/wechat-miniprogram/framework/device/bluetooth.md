<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/bluetooth.html -->

# 蓝牙 (Bluetooth)

小程序将各平台的蓝牙能力通过统一的接口封装提供给开发者使用。利用小程序的蓝牙接口，开发者可以通过无线方式与其他蓝牙设备交换数据。

## 1. 蓝牙能力概述

蓝牙技术规范由蓝牙技术联盟 (Bluetooth Special Interest Group, SIG) 制定，开发者可以在其 [官方网站](https://www.bluetooth.com/) 获取到详细的技术文档。

目前蓝牙最为普遍使用的有两种规格：

- **蓝牙基础率/增强数据率 (Bluetooth Basic Rate/Enhanced Data Rate, BR/EDR)** : 也称为经典蓝牙。常用在对数据传输带宽有一定要求的场景上，比如需要传输音频数据的蓝牙音箱、蓝牙耳机等；
- **蓝牙低功耗 (Bluetooth Low Energy, BLE)** : 从蓝牙 4.0 起支持的协议，特点就是功耗极低、传输速度更快，常用在对续航要求较高且只需小数据量传输的各种智能电子产品中，比如智能穿戴设备、智能家电、传感器等，应用场景广泛。

## 2. 小程序中的蓝牙能力

在小程序中，要使用蓝牙能力（Beacon 除外）必须首先调用 [wx.openBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html) 初始化蓝牙适配器模块，其生效周期为调用 [wx.openBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.openBluetoothAdapter.html) 至调用 [wx.closeBluetoothAdapter](https://developers.weixin.qq.com/miniprogram/dev/api/device/bluetooth/wx.closeBluetoothAdapter.html) 或小程序被销毁为止。只有在小程序蓝牙适配器模块生效期间，开发者才能够正常调用蓝牙相关的小程序 API，并收到蓝牙模块相关的事件回调（绑定监听不受此限制）。

小程序对蓝牙支持情况如下：

- **经典蓝牙** ：iOS 因系统限制暂无法提供，安卓目前已在规划中。
- **[蓝牙低功耗 (BLE)](./ble.md)** ：
    - 主机模式：基础库 1.1.0（微信客户端 iOS 6.5.6，Android 6.5.7）开始支持。
    - 从机模式：基础库 2.10.3 开始支持。
    - **[蓝牙信标 (Beacon)](./beacon.md)** ：基础库 1.2.0 开始支持。

## 3. 注意事项

由于各平台对蓝牙协议栈的实现和限制有较大差异，开发者在使用小程序蓝牙能力时还需要注意以下方面：

### 3.1 设备 ID (deviceId)

每个蓝牙外围设备都有唯一的 `deviceId` 来标识。由于部分系统实现的限制，对于同一台蓝牙外围设备，在不同中心设备上扫描获取到的 `deviceId` 可能是变化的。因此 `deviceId` 不能硬编码到代码中。

- Android 设备上扫描获取到的 `deviceId` 为外围设备的 MAC 地址，相对固定；
- iOS 设备上扫描获取到的 `deviceId` 是系统根据外围设备 MAC 地址及发现设备的时间生成的 UUID。对于已连接过的设备，UUID 会在一段时间内保持不变。此外，UUID 也会在某些条件下可能会发生变化（如系统蓝牙模块重启、配对设备被忽略等），在不同的设备上获取到的 UUID 也是不同的。

### 3.2 调试

不同平台的蓝牙实现也存在较大差异。小程序会在提供统一接口的基础上，尽可能的提供完整的系统蓝牙能力，弱化不同平台的实现差异。

但由于操作系统本身的限制，部分能力无法保证完全一致，请开发者注意文档中的注意事项，并在各端的真机都进行调试。开发者工具上只能模拟部分蓝牙接口能力，完整功能请使用真机调试。

## 示例代码

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/OF4Y9Gme6rZ4)
