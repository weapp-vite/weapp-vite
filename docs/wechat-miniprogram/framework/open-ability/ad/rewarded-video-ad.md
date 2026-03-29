<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/rewarded-video-ad.html -->

# 激励视频广告

小程序广告流量主操作指引： [文档地址](https://wximg.qq.com/wxp/pdftool/get.html?post_id=851) 激励视频广告组件是由客户端原生的图片、文本、视频控件组成的，层级最高，会覆盖在普通组件上。

开发者可以调用 [wx.createRewardedVideoAd](https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createRewardedVideoAd.html) 创建激励视频广告组件。该方法返回的是一个单例， **该实例仅对当前页面有效，不允许跨页面使用。**

## 广告创建

激励视频广告组件默认是隐藏的，因此可以提前创建，以提前初始化组件。开发者可以在小程序页面的 [onLoad](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#onloadobject-query) 事件回调中创建广告实例，并在该页面的生命周期内重复调用该广告实例。

```javascript
let rewardedVideoAd = null
Page({
  onLoad() {
    if(wx.createRewardedVideoAd){
      rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: 'xxxx' })
      rewardedVideoAd.onLoad(() => {
        console.log('onLoad event emit')
      })
      rewardedVideoAd.onError((err) => {
        console.log('onError event emit', err)
      })
      rewardedVideoAd.onClose((res) => {
        console.log('onClose event emit', res)
      })
    }
  }
})
```

为避免滥用广告资源，目前每个用户每天可观看激励式视频广告的次数有限，建议展示广告按钮前先判断广告是否拉取成功。

## 显示/隐藏

激励视频广告组件默认是隐藏的，在用户主动触发广告后，开发者需要调用 [RewardedVideoAd.show()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.show.html) 进行显示。

```javascript
rewardedVideoAd.show()
```

只有在用户点击激励视频广告组件上的 `关闭广告` 按钮时，广告才会关闭。开发者不可控制激励视频广告组件的隐藏。

## 广告拉取成功与失败

激励视频广告组件是自动拉取广告并进行更新的。在组件创建后会拉取一次广告，用户点击 `关闭广告` 后会去拉取下一条广告。

如果拉取成功，通过 [RewardedVideoAd.onLoad()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onLoad.html) 注册的回调函数会执行， [RewardedVideoAd.show()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.show.html) 返回的 Promise 也会是一个 resolved Promise。两者的回调函数中都没有参数传递。

```javascript
rewardedVideoAd.onLoad(() => {
  console.log('激励视频 广告加载成功')
})

rewardedVideoAd.show()
.then(() => console.log('激励视频 广告显示'))
```

如果拉取失败，通过 [RewardedVideoAd.onError()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onError.html) 注册的回调函数会执行，回调函数的参数是一个包含错误信息的对象。 [常见异常错误参考文档](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onError.html)

```javascript
rewardedVideoAd.onError(err => {
  console.log(err)
})
```

[RewardedVideoAd.show()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.show.html) 返回的 Promise 也会是一个 rejected Promise。

```javascript
rewardedVideoAd.show()
.catch(err => console.log(err))
```

## 拉取失败，重新拉取

如果组件的某次自动拉取失败，那么之后调用的 show() 将会被 reject。此时可以调用 [RewardedVideoAd.load()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.load.html) 手动重新拉取广告。

```javascript
rewardedVideoAd.show()
.catch(() => {
    rewardedVideoAd.load()
    .then(() => rewardedVideoAd.show())
    .catch(err => {
      console.log('激励视频 广告显示失败')
    })
})
```

如果组件的自动拉取是成功的，那么调用 load() 方法会直接返回一个 resolved Promise，而不会去拉取广告。

```javascript
rewardedVideoAd.load()
.then(() => rewardedVideoAd.show())
```

## 监听用户关闭广告

只有在用户点击激励视频广告组件上的 `关闭广告` 按钮时，广告才会关闭。这个事件可以通过 [RewardedVideoAd.onClose()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onClose.html) 监听。

![](../../_assets/rewarded-video-ad-landscape-d89e35b6-cc6539722c66.png)

[RewardedVideoAd.onClose()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onClose.html) 的回调函数会传入一个参数 res， `res.isEnded` 描述广告被关闭时的状态。

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>isEnded</td> <td>boolean</td> <td>视频是否是在用户完整观看的情况下被关闭的，true 表示用户是在视频播放完以后关闭的视频，false 表示用户在视频播放过程中关闭了视频</td></tr></tbody></table>

开发者需要根据 `res.isEnded` 判断是否视频是否播放结束、可以向用户下发奖励。

```javascript
rewardedVideoAd.onClose(res => {
    // 用户点击了【关闭广告】按钮
    if (res && res.isEnded) {
      // 正常播放结束，可以下发游戏奖励
    } else {
      // 播放中途退出，不下发游戏奖励
    }
})
```

## 注意事项

多次调用 [RewardedVideoAd.onLoad()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onLoad.html) 、 [RewardedVideoAd.onError()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onError.html) 、 [RewardedVideoAd.onClose()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/RewardedVideoAd.onClose.html) 等方法监听广告事件会产生多次事件回调，建议在创建广告后监听一次即可，或者先取消原有的监听事件再重新监听。
