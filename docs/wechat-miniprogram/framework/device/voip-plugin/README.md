<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/ -->

# VoIP 通话插件

[本插件](https://mp.weixin.qq.com/wxopen/pluginbasicprofile?action=intro&appid=wxf830863afde621eb&token=&lang=zh_CN) 主要用于提供「小程序音视频通话（for 硬件）」的部分基础能力和统一的通话界面。完整的接入流程和开发指南请参考 [相关文档](../device-voip.md) 。

插件接入可参考： [小程序示例代码](https://git.weixin.qq.com/wxa_iot/voip-wxapp-demo)

## 1. 小程序引入插件

> 关于小程序插件详细说明请参考 [小程序使用插件文档](../../plugin/using.md)

在「小程序管理后台」添加插件后，使用者还需要要在小程序的 `app.json` 中声明本插件。可以在主包引入，也可以在分包引入。

```json
// 主包引入
{
  "plugins": {
    "wmpf-voip": {
      "version": "latest", // latest 表示自动使用最新版本。也可使用具体版本，如 2.3.8
      "provider": "wxf830863afde621eb"
    }
  }
}
```

```json
// 分包引入
{
  "subpackages": [
    {
      "root": "xxxx",
      "pages": [],
      "plugins": {
        "wmpf-voip": {
          "version": "latest", // latest 表示自动使用最新版本。也可使用具体版本，如 2.3.8
          "provider": "wxf830863afde621eb"
        }
      }
    }
  ]
}
```

完成声明后，可以在小程序中来确认是否引入成功

```js
const wmpfVoip = requirePlugin('wmpf-voip').default
console.log(wmpfVoip) // 有结果即表示引入插件成功
```

## 2. 插件接口

从功能上，插件提供的接口可以分为以下几类

### 2.1 发起通话

发起通话的过程中，插件主要负责通话房间创建、发送接听提醒和通话页面的展示。可以在小程序页面或插件页面调用 [`initByCaller`](./api/initByCaller.md) 发起通话。

### 2.2 结束通话

通常情况下，通话结束需要用户点击操作。某些场景下，小程序也可以调用 [`forceHangUpVoip`](./api/forceHangUpVoip.md) 主动结束当前通话。

非用户点击结束通话可能有以下场景：

- 用户操作硬件设备的某些按钮结束通话。例如，设备有单独的话机听筒时，用户挂断听筒。
- 用户通话时长超过限制。建议使用 `initByCaller` 的 `timeLimit` 参数。插件低版本也可以根据 `calling` 事件的 `keepTime` 字段计算通话时长。

### 2.3 通话事件

开发者可以通过 [`onVoipEvent`](./api/onVoipEvent.md) 绑定通话事件的监听，以便更好的分析通话过程。

### 2.4 自定义设置

插件提供下列接口对通话过程和界面进行设置

- [`setCustomBtnText`](./api/setCustomBtnText.md) ：自定义接听页面按钮。
- [`setVoipEndPagePath`](./api/setVoipEndPagePath.md) ：设置插件功能执行完成后的跳转页面路径。
- [`setUIConfig`](./api/setUIConfig.md) ：设置插件通话界面。

### 2.5 授权查询

在微信客户端内，可以使用 [`wx.getDeviceVoIPList`](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.getDeviceVoIPList.html) 查询当前登录的用户同意/拒绝授权了哪些设备。

在硬件端，可以通过插件 [`getIotBindContactList`](./api/getIotBindContactList.md) 接口查询用户是否授权某台设备。

推荐开发者在微信用户授权设备时，即 `wx.requestDeviceVoIP` 回调 success 后，在后台存储 SN 与 openId。在设备端联系人页面中，配合 `getIotBindContactList` 接口进行授权验证。

### 2.6 页面参数

小程序可以通过插件 [`getPluginEnterOptions`](./api/getPluginEnterOptions.md) 获取 **从插件页面进入小程序时** 的启动参数。

如果小程序在前台时进入插件页面，则需要使用 [`getPluginOnloadOptions`](./api/getPluginOnloadOptions.md) 获取插件 **通话页面 onLoad 时** 页面路径中的参数。

## 3. 更新日志

请参考 [《小程序音视频通话插件更新日志》](./changelog.md)
