<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/grid-ad.html -->

# Grid 广告

小程序广告流量主操作指引： [文档地址](https://wximg.qq.com/wxp/pdftool/get.html?post_id=851) 开发者可以使用 [ad](https://developers.weixin.qq.com/miniprogram/dev/component/ad.html) 组件创建 Grid 广告组件，Grid 广告组件在创建后会自动拉取广告数据并显示。

## 广告尺寸设置

Grid 广告不允许直接设置样式属性，默认宽度为100%（width: 100%），高度会自动等比例计算，因此开发者可以设置广告外层组件的宽度调整广告的尺寸。格子广告有最小尺寸限制，5个的形态为331px，8个的形态为294px。

```css
/* 外层组件的宽度可设置成100%或具体数值 */
.adContainer {
  width: 100%;
}
```

```html
<view class="adContainer">
  <ad unit-id="xxxx" ad-type="grid" ad-theme="white" grid-count="5"></ad>
</view>
```

## 广告事件监听

Grid 广告在创建后会自动拉取广告。开发者可以通过 [ad](https://developers.weixin.qq.com/miniprogram/dev/component/ad.html) 组件的 `onload` 和 `onerror` 事件监听广告拉取成功或失败，可以通过 `onclose` 事件监听广告被关闭。

```html
<view class="adContainer">
  <ad unit-id="xxxx" ad-type="grid" ad-theme="white" grid-count="5" bindload="adLoad" binderror="adError" bindclose="adClose"></ad>
</view>
```

```js
Page({
  adLoad() {
    console.log('Grid 广告加载成功')
  },
  adError(err) {
    console.log('Grid 广告加载失败', err)
  },
  adClose() {
    console.log('Grid 广告关闭')
  }
})
```

## 广告主题样式设置

小程序视频广告组件提供黑、白两种主题样式，开发者可以在创建视频广告时传入 `ad-theme` 参数实现主题样式选择， `ad-theme` 参数为字符串类型，参数值可选 `white` , `black`

```html
<view class="adContainer">
  <ad unit-id="xxxx" ad-type="grid" ad-theme="white"></ad>
</view>
```

```html
<view class="adContainer">
  <ad unit-id="xxxx" ad-type="grid" ad-theme="black"></ad>
</view>
```

## 广告格子个数设置

小程序视频广告组件提供黑、白两种主题样式，开发者可以在创建视频广告时传入 `grid-count` 参数实现主题样式选择， `grid-count` 参数为数字类型，参数值可选 `5` , `8`

```html
<view class="adContainer">
  <ad unit-id="xxxx" ad-type="grid" grid-count="5"></ad>
</view>
```

```html
<view class="adContainer">
  <ad unit-id="xxxx" ad-type="grid" grid-count="8"></ad>
</view>
```
