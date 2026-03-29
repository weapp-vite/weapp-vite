<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/interstitialAd-ad.html -->

# 插屏广告

插屏广告组件是由客户端原生的图片、文本、视频控件组成的，层级最高，会覆盖在普通组件上。

开发者可以调用 [wx.createInterstitialAd](https://developers.weixin.qq.com/miniprogram/dev/api/ad/wx.createInterstitialAd.html) 创建插屏广告组件。每调用一次该方法，返回的都是一个全新实例， **该实例仅对当前页面有效，不允许跨页面使用。**

## 广告创建

插屏广告组件默认是隐藏的，因此可以提前创建，以提前初始化组件。开发者可以在小程序页面的 [onLoad](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#onloadobject-query) 事件回调中创建广告实例，并在该页面的生命周期内重复调用该广告实例。

```javascript
let interstitialAd = null
Page({
  onLoad() {
    if(wx.createInterstitialAd){
      interstitialAd = wx.createInterstitialAd({ adUnitId: 'xxxx' })
      interstitialAd.onLoad(() => {
        console.log('onLoad event emit')
      })
      interstitialAd.onError((err) => {
        console.log('onError event emit', err)
      })
      interstitialAd.onClose((res) => {
        console.log('onClose event emit', res)
      })
    }
  }
})
```

## 显示/隐藏

插屏广告组件默认是隐藏的，开发者需要调用 [InterstitialAd.show()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.show.html) 进行显示。如果广告拉取失败或触发频率限制， [InterstitialAd.show()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.show.html) 方法会返回一个rejected Promise，开发者可自行监听错误信息。 [常见异常错误参考文档](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.show.html)

```javascript
interstitialAd.show().catch((err) => {
  console.error(err)
})
```

用户可以主动关闭插屏广告。开发者不可控制插屏广告组件的隐藏。

## 广告拉取成功与失败

插屏广告组件是自动拉取广告并进行更新的。在组件创建后会拉取一次广告，用户关闭广告后会去拉取下一条广告。

如果拉取成功，通过 [InterstitialAd.onLoad()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onLoad.html) 注册的回调函数会执行，回调函数没有参数传递。

```javascript
interstitialAd.onLoad(() => {
  console.log('插屏 广告加载成功')
})
```

如果拉取失败，通过 [InterstitialAd.onError()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onError.html) 注册的回调函数会执行，回调函数的参数是一个包含错误信息的对象。 [常见异常错误参考文档](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onError.html)

```javascript
interstitialAd.onError(err => {
  console.log(err)
})
```

## 监听用户关闭广告

如果广告被关闭，通过 [InterstitialAd.onClose()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onClose.html) 注册的回调函数会执行，回调函数没有参数传递。

```javascript
interstitialAd.onClose(res => {
    console.log('插屏 广告关闭')
})
```

## 注意事项

多次调用 [InterstitialAd.onLoad()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onLoad.html) 、 [InterstitialAd.onError()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onError.html) 、 [InterstitialAd.onClose()](https://developers.weixin.qq.com/miniprogram/dev/api/ad/InterstitialAd.onClose.html) 等方法监听广告事件会产生多次事件回调，建议在创建广告后监听一次即可，或者先取消原有的监听事件再重新监听。

在插屏广告展示过程中如果快速切换页面，可能会出现插屏广告展示在非调用页面的情况，如有需要请在页面切换完成后进行插屏广告展示。
