<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/call-wechat.html -->

# 设备呼叫手机微信

在用户对设备进行 [**授权**](./auth.md) 后，设备可以向已授权用户发起音视频通话，用户在微信内打开小程序进行接听。

硬件开发者需建立小程序用户 openId、小程序 appId、硬件设备之间的关联。用户在手机端授权后设备才可拨打。

> 如果要获取通话过程的各类事件，可以使用插件的 [`onVoipEvent`](../voip-plugin/api/onVoipEvent.md) 接口。

## 1. 设备端发起通话（安卓直连）

发起通话前，一般需要用户选择拨打给的用户和通话的类型（音频/视频）。

根据业务场景不同，发起通话前的流程（如选择联系人和房间类型）可以在小程序的另一个页面中或者安卓应用中进行。

### 1.1 小程序页面进入通话页面

> 适用于用户发起通话前的页面（如联系人选择等）是小程序页面时。

发起通话时，设备端需要在之前的页面中调用插件的 [`initByCaller`](../voip-plugin/api/initByCaller.md) 接口，然后跳转到插件的发起通话页面。

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

try {
  // 2.4.0 以下版本 roomId 为 groupId
  const { roomId, isSuccess } = await wmpfVoip.initByCaller({
    caller: {
      id: 'sn', // 设备 SN
      // 不支持传 name，显示的是授权时「deviceName」+「modelId 对应设备型号」
    },
    listener: {
      // 参见 https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html 获取
      id: 'openId' // 接听方 用户 openId
      name: 'xxxxxx', // 接听方名字，仅显示用
    },
    roomType: 'video', // 房间类型。voice: 音频房间；video: 视频房间
    businessType: 1, // 1 为设备呼叫手机微信
    voipToken: 'xxxxxxxxxx', // 使用设备认证 SDK 注册的设备传入 deviceToken，使用 WMPF RegisterMiniProgramDevice 接口注册的设备无需传入（插件 2.3.0 支持）
    miniprogramState: 'formal', // 指定接听方使用的小程序版本
  })

  if (isSuccess) {
    // 如果小程序启动直接进入插件页面，则不要调用 wx.redirectTo
    wx.redirectTo({
      url: wmpfVoip.CALL_PAGE_PATH,
      // 插件 2.3.9 开始支持 CALL_PAGE_PATH, 低版本请传入 'plugin-private://wxf830863afde621eb/pages/call-page-plugin/call-page-plugin',
    })
  } else {
    wx.showToast({
      title: '呼叫失败',
      icon: 'error',
    })
  }
} catch (e) {
  // 参数错误的情况会通过异常抛出
  wx.showToast({
    title: '呼叫失败',
    icon: 'error',
  })
}
```

### 1.2 安卓应用直接进入通话页面

> 适用于用户发起通话前的页面（如联系人选择等）是安卓应用页面时。

发起通话时，需要安卓应用调用 WMPF [`launchMiniProgram`](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/launchMiniProgram.html) 接口拉起小程序，path 直接使用插件的拨打页面 `plugin-private://wxf830863afde621eb/pages/call-page-plugin/call-page-plugin` 。路径后可以带自定义参数，如 `&a=1`

这种情况下，开发者可以直接在小程序 `App.onShow` 时调用 [`initByCaller`](../voip-plugin/api/initByCaller.md) ，插件会直接进入拨打状态， **不需要也不可以再跳转到插件页面** 。

**强烈建议开发者在启动参数中增加防重放参数** ，例如 `callSeq=1703741306977` 。参数名可以自定义，取值可以是时间戳或其他唯一 ID。主要起到以下功能

- 如果用户点击重新进入小程序，避免重复发起通话。
- 小程序切后台又切前台的情况（如进入小程序设置页、进入其他原生页面、用户手动操作等）， `App.onShow` 、 `callPageOnShow` 会多次触发，避免重复发起通话。
- 标识当前启动是会发起通话，方便一些逻辑判断。

**建议开发者使用 [「小程序预热」能力](./performance.md#_2-%E5%AE%89%E5%8D%93-WMPF-%E5%B0%8F%E7%A8%8B%E5%BA%8F%E9%A2%84%E7%83%AD%EF%BC%88%E5%BB%BA%E8%AE%AE%EF%BC%89) 加快小程序的启动速度。**

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

// 假设预热启动参数为 ?isPreLaunch=1
// 假设发起呼叫时启动参数为 ?callSeq=1703741306977&..其他呼叫用的参数

function checkCallSeq(seq) {
  if (!seq) return false
  // 重新进入小程序会重启小程序，因此 seq 需要持久化存储，不能仅存变量
  const lastCallSeq = wx.getStorageSync('WMPF_CALL_SEQ')
  if (seq !== lastCallSeq) {
    // 示例仅做简单的比较，开发者可以根据业务需要增加其他判断条件，如 parstInt(seq) > parseInt(lastCallSeq)
    wx.setStorageSync('WMPF_CALL_SEQ', seq)
    return true
  } else {
    // 重复发起的通话
    return false
  }
}

function call(options) {
  try {
    wmpfVoip
      .initByCaller({
        /* 参数可从 options 中获取，此处省略 */
      })
      .catch(e => {
        wx.showToast({
          title: '呼叫失败',
          icon: 'error',
        })
      })
  } catch (e) {
    // 参数错误的情况会通过异常抛出
    wx.showToast({
      title: '呼叫失败',
      icon: 'error',
    })
  }
}

/**
 * 调用 WMPF LaunchMiniProgram 时，
 *  - 如果小程序不在前台（未启动或在后台），会触发 App.onShow
 *  - 如果小程序在前台，App.onShow 不会触发，但会触发插件的 callPageOnShow
 */

App({
  onShow() {
    const { query } = wmpfVoip.getPluginEnterOptions()
    if (query.isPreLaunch) {
      // 小程序预热场景，无需处理
      return
    }

    if (!query.callSeq) {
      // 当前启动不是发起通话，无需处理
      return
    }

    if(!checkCallSeq(query.callSeq)) {
      // 重复发起通话，直接忽略
      return
    }

    call(query)
  },
})

wmpfVoip.onVoipEvent(event => {
  if (event.eventName === 'callPageOnShow') {
    // 仅处理小程序在前台时，调用 WMPF LaunchMiniProgram 触发小程序 reLaunch 的情况
    const query = wmpfVoip.getPluginOnloadOptions()
    if (checkCallSeq(query.callSeq)) {
      // 此处可以过滤掉已被 App.onShow 处理的情况
      call(query)
    }
  }
})
```

**注意**

- 给用户推送的接听提醒会在调用 `initByCaller` 后由微信后台直接下发，不需要开发者额外调用服务端下发消息的接口。
- `roomType` 等参数可以通过拉起小程序的 path 中的 query 传递给小程序。
- 设备上，APP 拉起小程序或接听通话较慢时，请参考 [性能与体验优化指南](./performance.md) 。

## 2. 设备端发起通话（Linux 直连）

请参考 [《小程序音视频通话 SDK (Linux)》](./voip-sdk.md#_5-4-%E9%80%9A%E8%AF%9D) 5.4.1 发起通话部分

## 3. 手机微信端接听通话

用户在手机端可以收到「响铃+振动」的强提醒通知，点击接听按钮后，会启动小程序并直接进入「VOIP 通话」插件页面接听通话。

完成通话后，微信客户端内会显示本次通话的信息与「关闭」按钮，用户点击「关闭」按钮后再跳转开发者调用 [`setVoipEndPagePath`](../voip-plugin/api/setVoipEndPagePath.md) 设置的页面。开发者未设置时则直接关闭小程序。

开发者可以 **自定义接听页面按钮，以及通话结束跳转页** 。详情请参考 [插件文档](../voip-plugin/README.md)

## 4. 设备端处理通话结束（安卓直连）

设备端通话结束后，开发者需自行处理页面跳转或关闭小程序。一般有以下几种方式：

- 结束后跳转其他页面：开发者需要通过插件 [`setVoipEndPagePath`](../voip-plugin/api/setVoipEndPagePath.md) 接口设置通话结束跳转的页面。开发者未设置时则停留在通话记录页面。
- 结束后小程序切后台：开发者可以监听 [插件 endVoip 或 finishVoip 事件](../voip-plugin/api/onVoipEvent.md) ，通过 WMPF 提供的 [通信通道(Invoke Channel)](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/invoke-channel.html) 通知移动应用，使用 [closeWxaApp](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/closeWxaApp.html) (keepRunning=true) 将小程序切后台。
- 结束后关闭小程序：开发者可以监听 [插件 endVoip 或 finishVoip 事件](../voip-plugin/api/onVoipEvent.md) ，调用 [wx.exitMiniProgram](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.exitMiniProgram.html) 关闭小程序。
