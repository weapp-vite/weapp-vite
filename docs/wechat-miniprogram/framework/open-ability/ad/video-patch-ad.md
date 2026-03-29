<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/video-patch-ad.html -->

# 视频前贴广告

小程序广告流量主操作指引： [文档地址](https://wximg.qq.com/wxp/pdftool/get.html?post_id=851) 开发者可以在 [video](https://developers.weixin.qq.com/miniprogram/dev/component/video.html) 组件中添加属性配置，创建小程序视频前贴广告组件，视频广告组件在创建后会自动拉取广告数据，视频播放前展示广告。

## 广告样式

展示样式在开发者所设置的video组件中，以16：9的比例，垂直或者水平居中

## 广告创建

在 [video](https://developers.weixin.qq.com/miniprogram/dev/component/video.html) 组件中添加了以下广告相关的属性配置，设置 `ad-unit-id` 后可以展示对应广告

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>ad-unit-id</td> <td>string</td> <td></td> <td>是</td> <td>广告单元id，可在小程序管理后台的流量主模块新建</td></tr> <tr><td>bindadload</td> <td>eventhandle</td> <td></td> <td>否</td> <td>广告加载成功的回调</td></tr> <tr><td>bindaderror</td> <td>eventhandle</td> <td></td> <td>否</td> <td>广告加载失败的回调,返回码同<a href="../../../component/ad.html">ad</a>组件</td></tr> <tr><td>bindadclose</td> <td>eventhandle</td> <td></td> <td>否</td> <td>广告关闭的回调</td></tr> <tr><td>bindadplay</td> <td>eventhandle</td> <td></td> <td>否</td> <td>广告开始，结束播放的回调 event.detail = {type: 'begin/end'}</td></tr></tbody></table>

添加广告单元，绑定广告事件

```html
<video
  class="xxx"
  src="xxx"
  bindadplay="onAdplay"
  bindadload="onAdload"
  bindadclose="onAdclose"
  bindaderror="onAdError"
  ad-unit-id="xxx"
>
</video>
```

监听广告事件

```js
Page({
  onAdplay(e) {
    console.log('onAdplay', e)
  },
  onAdload(e){
    console.log('onAdload', e)
  },
  onAdclose(e) {
    console.log('onAdclose', e)
  },
  onAdError(e) {
    console.log('onAdError', e)
  },
})
```

## 广告预加载

开发者可以调用 `wx.preloadVideoAd` 的方式进行广告的预加载

```js

const adUnitId1 = 'xxx'
const adUnitId2 = 'xxx'
wx.preloadVideoAd([adUnitId1, adUnitId2])
```

## 错误码

错误码是通过bindaderror回调获取到的错误信息，前贴广告再 `普通广告组件` [ad](https://developers.weixin.qq.com/miniprogram/dev/component/ad.html) 错误码基础上新增了以下错误码。

<table><thead><tr><th>代码</th> <th>异常情况</th> <th>解决方案</th></tr></thead> <tbody><tr><td>3001</td> <td>命中频控策略</td> <td>按照没有广告处理</td></tr> <tr><td>3002</td> <td>命中频控策略</td> <td>按照没有广告处理</td></tr> <tr><td>3003</td> <td>命中频控策略</td> <td>按照没有广告处理</td></tr> <tr><td>3004</td> <td>命中频控策略</td> <td>按照没有广告处理</td></tr></tbody></table>

## 注意事项

1、支持视频预加载能力： [文档地址](https://wximg.qq.com/wxp/pdftool/get.html?post_id=1698) 。

2、仅支持同层渲染模式下的video组件。

3、开发者可监听bindadplay事件获取广告播放状态，做出相应处理。

4、ad-unit-id不支持异步设置，只支持设置在wxml或者js文件的 `data` 属性里，通过 `setData` 设置的无效。

5、全屏模式下不展示视频前贴广告。
