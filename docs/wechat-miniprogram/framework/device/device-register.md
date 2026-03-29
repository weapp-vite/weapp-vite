<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-register.html -->

# 设备认证

在使用小程序提供的部分硬件能力时，需要提前将设备在微信进行注册，以便于微信验证设备的真实可信。

例如：小程序音视频通话（for 硬件）

## 1. 设备要求

微信需要硬件能力来对设备身份进行校验。设备厂商需要保证设备满足一定条件。

### 1.1 安卓设备

设备需要满足下列条件之一：

- 设备 EMMC/UFS 存储上的 RPMB(Replay Protected Memory Block) 分区未被使用；
- 设备支持 TEE，并能按照 [《设备认证 TEE 规范》](./device-tee.md) 开发 TA 并提交验收。

此外，设备厂商需要内置一个 RPMB 分区读写及通信的 RPMBD 服务（由微信提供，参考第 3 节），并保证服务能够开机正常启动。

### 1.2 Linux 设备

设备需要满足下列条件：

- 设备 EMMC/UFS 存储上的 RPMB(Replay Protected Memory Block) 分区未被使用；

## 2. 安全策略

**对于同一个 modelId，每一台物理设备应分配唯一且不变的 SN。** 如果检测到包括但不限于下列情况，可能会导致设备能力被封禁：

- 多台设备共用同一个 SN；
- 同一台设备交替使用多个不同的 SN；
- 使用虚假设备进行设备注册；
- 其他伪造或滥用设备的行为。

## 3. 设备认证（安卓）

### 3.1 部署 RPMBD 服务

设备认证需要使用 EMMC/UFS 存储上的 RPMB 分区来保证设备的身份，需要设备厂商内置一个 RPMB 分区读写及通信的服务，并保证服务能够开机正常启动。

#### 3.1.1 下载服务

请在 [此处](https://git.weixin.qq.com/wxa_iot/voipsdk/tree/master/android) 下载对应平台、版本的 rpmbd 二进制文件。

**注意：ARM 64 位版本（TEE）需要设备商按照规范开发 TEE 对应的 TA 模块，详细规范与流程参考 [设备认证 TEE 规范](./device-tee.md) 。**

#### 3.1.2 运行服务

将下载的 rpmbd 二进制（以下假设文件名为 rpmbd，下载后可以重命名）集成至系统里并以服务的方式运行起来。

**注意**

- RPMBD 服务不仅用于注册设备过程，后续使用相关硬件能力时，都需要 **保证 RPMBD 服务一直运行** 。
- **每一颗 EMMC/UFS 存储芯片的 RPMB KEY 只能被写一次，不能修改。** 如果被写入错误的值 (非注册时的 model\_id 和 sn)，那么这颗芯片就无法继续使用。
- 高版本的 android 安全性较强，可能还需要配置 SELinux，且只支持在 system 分区启动。可参考 [SELinux 参考配置](https://git.weixin.qq.com/wxa_iot/voipsdk/tree/master/android/system/sepolicy)

运行方式为：

```sh
rpmbd /dev/mmcblk1rpmb # /dev/mmcblk1rpmb 为rpmb分区路径, 开发者需要根据自己设备的情况具体填写（高通平台不需要指定）
```

参考如下 rc 的启动方式：

- /system/etc/init，放到 system 分区启动（建议）
  ```
  service rpmbd /system/bin/rpmbd /dev/mmcblk1rpmb
    class main
    user root
    group root system
  ```
- /vendor/etc/init，放到 vendor 分区启动（仅 Android < 8 支持）
  ```
  service rpmbd /vendor/bin/rpmbd
    class main
    user root
    group root system
  ```

### 3.2 注册设备

在完成 RPMBD 服务部署后，需要 [使用 WMPF 认证设备](./device-register-wmpf.md) 。

## 4. 设备认证（Linux）

- 使用「小程序音视频通话 SDK（直连 Linux 设备）」的设备，请使用 [wx\_device\_register](./voip/voip-sdk.md) 注册设备。

## 5. 常见问题

**(1) 注册设备报错 `emmc write fail00`**

检查 rpmbd 服务启动参数里的 rpmb 分区路径是否正确。 若路径正确，确认此路径对应的 rpmb 分区在 Android OS 下能否被访问。

**(2) 报错 `cert fail`**

应用缓存被清理，或 Android 认为 APK 有变动导致 keystone 中数字证书失效导致。

需要清理 apk 数据缓存再使用相同的 appid、model\_id、SN 调用 registerDevice/registerVoipDevice 刷新密钥。

**(3) 接口报错 ticket 1 invalid rpmb\_buffer**

当前 rpmbd 与 SDK aar 的版本不兼容，应保持二者使用相同版本。例如：rpmbd 服务使用了 1.3 以下版本，而 SDK 使用了 1.3 或以上的版本。

**(4) 注册设备返回 -7，或调用接口报错 `failed to get native service` 或其他获取 rpmbd 服务失败的错误**

- 确认已部署 rpmbd 服务，且服务正常运行。（可以通过 ps 查看）
- Android >= 8 版本，请确认 rpmbd 是在 system 分区启动
- 如果启用了 SELinux，需确认 SELinux 的相关规则已正确配置

**(5) 注册设备报错 `register: null`**

高版本 android 不允许在主线程里进行网络请求，需要单独开线程里来调用 SDK 接口

**(6) 使用物联网卡时，网络请求一直失败**

物联网卡请使用 WMPF 注册设备，或设备认证 SDK >= 1.3.1 版本，并确保 `servicewechat.com` 域名能够正常访问。

**(7) 注册设备报错 9800004， `device xxx is not confirmed`**

绝大多数情况是因为注册设备时使用了 1.3 以下版本的 设备认证 SDK，且同时发起了多次 registerVoipDevice 请求，此时有概率设备端使用的密钥与后台不同步，导致设备再也无法成功注册，且该过程不可逆。

建议开发者使用 WMPF 注册设备，或升级到设备认证 SDK 1.3 及以上版本，使用低版本时请务必保证前一次 registerVoipDevice 返回前不要重复调用。

**(8) 注册设备报错 9800004， `device xxx not registered`**

绝大多数情况是当前设备之前使用不同的 modelId/sn 进行了注册。如使用 WMPF 注册设备，可以使用 [getMiniProgramDeviceInfo](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogramdevice/getMiniProgramDeviceInfo.html) 检查下当前设备内的 sn 和 modelId，和传入的是否一致。

**(9) 获取票据 `getCallerTicket/getDeviceToken` 报错 9800004**

一般是因为传入的 mode\_id 与最初注册设备时不一致。

**(10) 报错 `ticket 0 digital-sig check fail`**

多数是因为当前设备已经在这台设备的另一个 App 中注册过，目前设备验证只能用于单个应用。需要再使用相同的 appid、model\_id、SN 重新调用 registerDevice/registerVoipDevice 刷新密钥。

例如，同时混用「使用 WMPF 认证设备」和「设备认证 SDK」，可能会导致 WMPF 和 开发者应用互相抢占密钥，导致这个错误。

**(11) 注册设备报错 40234 `hmac check fail`**

可能有以下原因

- 设备已经使用其它的 model\_id/sn 注册过，此次注册传入了不同的 model\_id；
- 设备曾经注册过，且注册设备时使用了 1.3 以下版本的设备认证 SDK，且同时发起了多次 registerVoipDevice 请求，此时有概率设备端使用的密钥与后台不同步，导致设备再也无法成功注册，且该过程不可逆。

**(12) 获取 deviceToken 时报错 `register info invalid`**

当从「设备认证 SDK」切换到「使用 WMPF 认证设备」后，需要调用 WMPF `registerMiniProgramDevice` 重新进行设备注册，若未调用或调用未成功，则在需要获取 deviceToken 的场景会报这个错误。
