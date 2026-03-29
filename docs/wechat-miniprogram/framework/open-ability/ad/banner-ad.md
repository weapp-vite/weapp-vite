<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/banner-ad.html -->

# Banner 广告

小程序广告流量主操作指引： [文档地址](https://wximg.qq.com/wxp/pdftool/get.html?post_id=851) 开发者可以使用 [ad](https://developers.weixin.qq.com/miniprogram/dev/component/ad.html) 组件创建 Banner 广告组件，Banner 广告组件在创建后会自动拉取广告数据并显示。

## 广告尺寸设置

Banner 广告不允许直接设置样式属性，默认宽度为100%（width: 100%），高度会自动等比例计算，因此开发者可以设置广告外层组件的宽度调整广告的尺寸。 广告外层组件的宽度不允许小于300px，当宽度小于300px时，Banner 广告的宽度会强制调整为300px。

```css
/* 外层组件的宽度可设置成100%或具体数值 */
.adContainer {
  width: 100%;
}
```

```html
<view class="adContainer">
  <ad unit-id="xxxx"></ad>
</view>
```

## 广告事件监听

Banner 广告在创建后会自动拉取广告。开发者可以通过 [ad](https://developers.weixin.qq.com/miniprogram/dev/component/ad.html) 组件的 `onload` 和 `onerror` 事件监听广告拉取成功或失败，可以通过 `onclose` 事件监听广告被关闭。

```html
<view class="adContainer">
  <ad unit-id="xxxx" bindload="adLoad" binderror="adError" bindclose="adClose"></ad>
</view>
```

```js
Page({
  adLoad() {
    console.log('Banner 广告加载成功')
  },
  adError(err) {
    console.log('Banner 广告加载失败', err)
  },
  adClose() {
    console.log('Banner 广告关闭')
  }
})
```

## 广告定时刷新

开发者可以在创建 Banner 广告时传入 `ad-intervals` 参数实现广告的定时刷新， `ad-intervals` 参数为数字类型，单位为秒。注意：自动刷新的间隔不能低于30秒，因此 `ad-intervals` 的参数值必须大于或等于30。

```html
<view class="adContainer">
  <ad unit-id="xxxx" ad-intervals="30"></ad>
</view>
```
