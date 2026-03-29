<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/custom-ad.html -->

# 原生模板 广告

小程序广告流量主操作指引： [文档地址](https://ad.weixin.qq.com/pdf.html?post_id=U2FsdGVkX19ll2hBY/i9/XyTZ3U858nPUczgOnREpy0=) 开发者可以使用 [ad-custom](https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html) 组件创建 原生模板 广告组件，原生模板 广告组件在创建后会自动拉取广告数据并显示。

## 广告尺寸设置

原生模板 广告不允许直接设置样式属性，默认宽度为100%（width: 100%），高度会自动等比例计算，因此开发者可以设置广告外层组件的宽度调整广告的尺寸。 广告外层组件的宽度和具体模板相关，具体可以参考模板编辑器文档。

```css
/* 外层组件的宽度可设置成100%或具体数值 */
.adContainer {
  width: 100%;
}
```

```html
<view class="adContainer">
  <ad-custom unit-id="xxxx"></ad-custom>
</view>
```

## 广告事件监听

原生模板 广告在创建后会自动拉取广告。开发者可以通过 [ad-custom](https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html) 组件的 `onload` 和 `onerror` 事件监听广告拉取成功或失败，同时可通过 `onclose` 事件监听广告关闭。

```html
<view class="adContainer">
  <ad-custom unit-id="xxxx" bindload="adLoad" binderror="adError" bindclose="adClose"></ad-custom>
</view>
```

```js
Page({
  adLoad() {
    console.log('原生模板广告加载成功')
  },
  adError(err) {
    console.log('原生模板广告加载失败', err)
  },
  adClose() {
    console.log('原生模板广告关闭')
  },
})
```

## 广告定时刷新

开发者可以在创建 原生模板 广告时传入 `ad-intervals` 参数实现广告的定时刷新， `ad-intervals` 参数为数字类型，单位为秒。注意：自动刷新的间隔不能低于30秒，因此 `ad-intervals` 的参数值必须大于或等于30。

```html
<view class="adContainer">
  <ad-custom unit-id="xxxx" ad-intervals="30"></ad-custom>
</view>
```

## 监听广告隐藏

- 矩阵格子广告触发型特殊说明： 用户在点击右上角关闭按钮时，广告将通过控制 元素的样式 display: none 使其隐藏。 开发者可通过 [ad-custom](https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html) 组件的 `onhide` 事件监听隐藏事件，在必要时机通过改些 display 样式使广告重新展示。

```html
<ad-custom unit-id="xxxx" bindhide="adHide"></ad-custom>
```
