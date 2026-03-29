<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/ad/preload-ad.html -->

# 广告预加载接口

> 基础库 2.14.1 开始支持，低版本需做 [兼容处理](../../compatibility.md)

在小程序环境下，支持通过调用 [wx.preloadAd](#) 接口，提前加载广告数据，再后续创建对应广告标签 [ad](https://developers.weixin.qq.com/miniprogram/dev/component/ad.html) , [ad-custom](https://developers.weixin.qq.com/miniprogram/dev/component/ad-custom.html) 时，会自动使用预加载的广告数据，省去创建广告标签时再次拉取广告的耗时。

## 预加载示例

```js
  wx.preloadAd([{
      unitId: 'adunit-XXX', // 原生模板广告广告单元
      type: 'custom' // 原生模板广告
    },
    {
      unitId: 'adunit-XXX', // banner广告广告单元
      type: 'banner' // banner广告
    },
    {
      unitId: 'adunit-XXX', // 前贴广告广告单元
      type: 'videoPatch' // 视频前贴广告
    },
    {
      unitId: 'adunit-XXX', // 视频广告广告单元
      type: 'video' // 视频广告
    }
  ])
```

## wx.preloadAd(Array object)

### object 参数

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>unitId</td> <td>string</td> <td>无</td> <td>是</td> <td>广告单元id，可在小程序管理后台的流量主模块新建</td></tr> <tr><td>type</td> <td>string</td> <td>无</td> <td>是</td> <td>广告单元所属广告位类型 <br> <code>custom</code> 原生模板广告 <br><code>banner</code> banner广告<br> <code>videoPatch</code> 视频前贴广告 <br><code>video</code> 视频广告</td></tr></tbody></table>

## 注意事项

1、预加载是否成功对开发者无感知，广告使用方式同无预加载一致即可。

2、广告单元id和广告单元所属广告位类型需要匹配成功，否则会导致无法正常使用预加载数据。

3、在合适的场景使用预加载接口（如pageA调用预加载，pageB调用广告展示，pageA跳转pageB），留充足的时间间隔给到接口调用和广告标签创建才能体现预加载的优势。

4、如果在进入首页就有需要展示广告，且后续广告无新增，刷新等逻辑，无需调用预加载。

5、如果在进入首页就有需要展示广告，后续有新增，刷新逻辑，可在app.js中调用预加载接口。

6、广告单元预加载后，会带来MP后台广告数据的拉取量增长，可能出现曝光率下降现象。建议开发者关注曝光量绝对值变化规律。
