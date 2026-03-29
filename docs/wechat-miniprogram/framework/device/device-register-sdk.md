<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-register-sdk.html -->

# 设备认证 SDK（安卓）

**注意：License 计费不再支持使用设备认证 SDK 认证的设备，请尽快切换到 [使用 WMPF 认证设备](./device-register-wmpf.md) ，无需维护 deviceToken，接入更便捷。**

在系统集成 rpmbd 后，开发者需要在 Launcher 应用中接入设备认证 SDK，SDK 主要提供以下能力：

- 注册设备 `registerDevice` ：将 model\_id 和 SN 与设备绑定。一旦成功后 **model\_id 和 SN 不可修改** 。
- 获取设备凭证 `getDeviceToken` ：进行设备认证并从微信后台获取凭证，设备端发起通话时传给 VOIP 通话插件的 [initByCaller](./voip-plugin/api/initByCaller.md) 接口的 voipToken 参数。

## 1. 下载 SDK

请在 [此处](https://git.weixin.qq.com/wxa_iot/voipsdk/) 下载 SDK 的 aar 文件。

**建议使用 1.3 及以上版本（物联网卡应使用 1.3.1 及以上版本）。低版本不支持并发调用 `registerVoipDevice` ，请务必注意在前一次调用返回前不要重复调用。**

- v1.5.0 及以上版本需集成 `voipsdk-x.x-release.aar` 和 `safeguard-release.aar` 两个 aar 文件
- v1.3.1 及以下版本只需集成 `voipsdk-x.x-release.aar`

**注意：使用设备认证 SDK 前，需先保证 rmpbd 服务正常运行。**

## 2. 接口文档（v1.5.0及以上版本）

### 2.1 注册设备 `registerDevice`

将 model\_id 和 SN 与设备绑定，一旦成功后 appid、model\_id、SN 均不能更换。

```java
int registerDevice(String appid, String model_id, String sn, String sn_ticket) throws Exception
```

#### 注意事项（ **调用前必读** ）

- 注册设备成功后，会将 SN 固化至 EMMC/RPMB 分区中，标定此设备的唯一身份。 **SN 和 model\_id 一经写入后续即不可更改 。**
- **此处使用的 SN，必须经过 WMPF 的 [addDevice](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/backend/addDevice.html) 接口作为 deviceId 注册，并与 WMPF [设备激活](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/boot/init.html) 使用的 deviceId 一致。** 否则后续无法正常发起通话。
- 注册成功后会在本 APK 的存储里存放数字证书，如果 APK 有变动（Android 系统认为应用变更了），则证书失效（会报错 `cert fail` ），可以清理 APK 的数据再以 **相同的 appid、model\_id、SN** 调用接口重新申请即可。
- 注册过程会有网络请求，时长根据网络情况会有所不同。高版本 android 不允许在主线程里进行网络请求，可以加处理或在线程里来调用 sdk。

#### 参数说明

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>appid</td> <td>String</td> <td>小程序的 appid</td></tr> <tr><td>model_id</td> <td>String</td> <td><a href="device-access.html">设备接入</a>时从「小程序管理后台」申请获得的 model_id</td></tr> <tr><td>sn</td> <td>String</td> <td>设备序列号。厂商自己生成，长度不能超过 128 字节。字符只接受数字，大小写字母，下划线（*）和连字符（-）。<br> <strong>此处使用的 sn 必须与 WMPF 激活设备使用的 deviceId 一致</strong></td></tr> <tr><td>sn_ticket</td> <td>String</td> <td>通过<a href="(hardware-device/getSnTicket)">获取设备票据</a>接口获得</td></tr></tbody></table>

#### 返回值

其他异常说明请参考 [设备验证常见问题](./device-register.md)

<table><thead><tr><th>名称</th> <th>值</th> <th>描述</th></tr></thead> <tbody><tr><td>OK</td> <td>0</td> <td>成功</td></tr> <tr><td>ERR_ARGS</td> <td>-1</td> <td>参数错误</td></tr> <tr><td>ERR_IO</td> <td>-2</td> <td>通用 IO 错误</td></tr> <tr><td>ERR_KEY_IO</td> <td>-3</td> <td>KEY 不匹配</td></tr> <tr><td>ERR_RESPONSE</td> <td>-4</td> <td>网络请求无回复</td></tr> <tr><td>ERR_PEM</td> <td>-5</td> <td>权限错误</td></tr> <tr><td>ERR_INVALID_KEY</td> <td>-6</td> <td>KEY 不可用</td></tr> <tr><td>ERR_SERVICE</td> <td>-7</td> <td>rpmbd 服务没运行</td></tr> <tr><td>ERR_EMMC_UFS_CONFUSED</td> <td>-8</td> <td>EMMC/UFS 不匹配。里面已经存在 SN</td></tr> <tr><td>ERR_EMMC_UFS_IO</td> <td>-9</td> <td>EMMC/UFS IO 错误</td></tr> <tr><td>ERR_REG_NOPEM</td> <td>-10</td> <td>密钥不存在</td></tr></tbody></table>

### 2.2 获取设备凭证 `getDeviceToken`

进行设备认证，并从微信后台获取设备凭证。设备发起通话时需要将这一凭证传给 VOIP 通话插件的 [initByCaller](./voip-plugin/api/initByCaller.md) 接口的 voipToken 参数。

```java
String getDeviceToken(String appid, String model_id) throws Exception
```

如果设备是使用 v1.5 及以上版本 SDK 进行注册设备的，可以使用无参数的版本。

```java
String getDeviceToken() throws Exception
```

#### 参数说明

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>appid</td> <td>String</td> <td>小程序的 appid</td></tr> <tr><td>model_id</td> <td>String</td> <td><a href="device-access.html">设备接入</a>时从「小程序管理后台」申请获得的 model_id</td></tr></tbody></table>

#### 注意事项

- 接口耗时与网络有关，正常会在 1 秒左右。高版本 android 不允许在主线程里做，可以加处理或在线程里来调用 sdk。
- ticket 有一个小时的有效期，一个小时内可被多次通话复用。建议开发者在用户发起通话前，提前调用 getCallerTicket 并缓存，避免在发起通话时再进行获取，以缩短发起通话时的用户等待时长。

### 2.3 获取设备 SN `getDeviceSn` （仅调试用）

获取 `registerDevice` 接口写入的 SN。

```java
String getDeviceSn()
```

### 2.4 获取设备 modelId `getDeviceModelid` （仅调试用）

获取使用 `registerDevice` 接口写入的 modelId。仅在设备是使用 v1.5 及以上版本 SDK 进行注册设备时有效。

```java
String getDeviceModelid()
```

## 3. 接口文档（v1.3.1 及以下版本）

### 3.1 初始化 `init`

SDK 初始化，其它接口在调用之前需要保证 init 成功。

```java
boolean init()
```

### 3.2 注册设备 `registerVoipDevice`

参考 2.1 `registerDevice` 。

- **1.3 以下版本 SDK，此接口严禁并发执行** ，务必在逻辑中保证一次 registerVoipDevice 返回后才能再次调用。

### 3.3 获取拨打方票据 `getCallerTicket`

参考 2.2 `getDeviceToken`

### 3.4 获取设备 SN `GetDeviceSn` （仅调试用）

同 2.3 `getDeviceSn`
