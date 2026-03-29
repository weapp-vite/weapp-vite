<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-register-wmpf.html -->

# 使用 WMPF 认证设备（安卓）

在系统集成 rpmbd 后，如果设备上安装了 [小程序硬件框架(WMPF)](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/) ，可以直接使用 WMPF 认证设备。

相比使用设备认证 SDK，使用 WMPF 注册设备有以下优势：

- 接入成本低：不需要额外引入设备认证 SDK，不占用包大小，接入成本更低。
- 免维护设备凭证： `deviceToken` 的获取由框架按需进行，开发者只需要进行设备注册，不需要维护 `deviceToken` ，也不需要手动传递给小程序，维护成本更低。

**注意**

- **注1：使用 WMPF 时，需先保证 rmpbd 服务正常运行。**
- **注2：使用设备认证 SDK 注册的设备，需要重新使用 WMPF 注册，才能免维护设备凭证。**

具体使用可以参考 [示例代码](https://github.com/wmpf/wmpf_demo_external)

## 1. 版本要求

- WMPF：本能力需安卓 WMPF >= 1.2.0 版本支持（如果是 2023/08/19 之前下载的 wmpf-cli，需要重新下载更新下）。
- [VOIP 通话](./voip-plugin/README.md) 插件：需插件 >= 2.3.0 支持。

## 2. 注册设备

使用 [registerMiniProgramDevice](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogramdevice/registerMiniProgramDevice.html) 进行设备注册。使用 [getMiniProgramDeviceInfo](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogramdevice/getMiniProgramDeviceInfo.html) 进行注册信息查询。

## 3. 设备凭证预拉取

当使用 WMPF 注册设备后，框架会按需自行获取设备凭证，无需开发者介入。为了优化设备凭证的获取耗时，开发者可以在可能用到设备凭证前，调用 [prefetchDeviceToken](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogramdevice/prefetchDeviceToken.html) 接口提前进行预拉取，在有效期内（目前 1 小时）框架可以直接从缓存获得。

例如，在发起音视频通话时，框架会获取 `deviceToken` 。建议开发者在用户发起通话的前置页面（例如：联系人页面等）进行设备凭证预拉取。

## 4. 框架获取设备凭证的场景

目前框架会在下列时机获取设备凭证，建议提前进行预拉取：

- 小程序音视频通话，使用 VOIP 通话插件，调用 initByCaller 发起通话时。

## 5. 从设备认证 SDK 切换到使用 WMPF 注册设备

如果之前使用设备认证 SDK，想要切换成 WMPF 方式注册，可以注意以下事项：

1. **同一台设备不要混用设备认证 SDK 和 WMPF 注册设备**
2. APP 中可以删除 voipsdk-1.x-release.aar 和 safeguard-release.aar。
3. 对于之前注册过的设备，需要重新调用一次 `registerMiniProgramDevice` 接口以刷新设备密钥。
4. 开发者不再需要获取和传入 deviceToken/callerTicket，使用插件时不能传 voipToken 参数。
5. 如果之前开发者做了提前获取 deviceToken/callerTicket 的逻辑，可以替换为提前调用 `prefetchDeviceToken` 。
