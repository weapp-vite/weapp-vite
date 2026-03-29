<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/pop-gesture.html -->

# 页面返回手势

默认情况下，小程序页面都是右滑返回。但在使用 [自定义路由](./custom-route.md) 和 [预设路由](./preset-route.md) 时，我们常常需要不同的手势返回效果。

例如使用 `wx://cupertino-modal` 路由效果时，下个页面自底向上出现，右滑返回并不符合视觉一致性。采用纵向的滑动返回（原路返回）会更合适一些。

## 使用方法

开发者工具需升级到 `Nightly` `1.06.2403222` ，基础库选择 `3.4.0` 。

### 一行代码配置

在 [自定义路由配置](./custom-route.md#%E9%BB%98%E8%AE%A4%E8%B7%AF%E7%94%B1%E9%85%8D%E7%BD%AE) 中，开发者可通过 `fullscreenDrag` 和 `popGestureDirection` 来定义手势返回效果。

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>说明</th></tr></thead> <tbody><tr><td>popGestureDirection</td> <td>string</td> <td>horizontal</td> <td>返回手势方向</td></tr> <tr><td>fullscreenDrag</td> <td>boolean</td> <td>false</td> <td>右滑返回手势区域拓展到全屏范围</td></tr></tbody></table>

`popGestureDirection` 支持的枚举值如下

- horizontal：仅能横向拖动返回，fullscreenDrag 仅对横向拖动有效
- vertical: 仅能纵向拖动返回
- multi: 可以横向或纵向拖动返回

### 结合纵向滚动容器

当纵向拖动返回时，若页面内有纵向滚动的 `<scroll-view>` ，默认在 `scroll-view` 上滑动无法触发页面返回。

此时可声明关联容器为 `pop-gesture` ，此时滑动 [`scroll-view`](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html) 至顶端后可继续触发页面返回。

```html
<scroll-view
  type="custom"
  associative-container="pop-gesture"
>
  <!-- 页面内容 -->
</scroll-view>
```

### 结合预设路由

为增加路由配置的灵活性， `3.4.0` 版本起 [wx.navigateTo](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateTo.html) 增加 `routeConfig` 和 `routeOptions` 两个属性。

#### routeConfig

[routeConfig 可配字段](./custom-route.md#%E9%BB%98%E8%AE%A4%E8%B7%AF%E7%94%B1%E9%85%8D%E7%BD%AE) 。 `navigateTo` 传入的 `routeConfig` 将会覆盖 `routeBuilder` 返回的配置项，开发者可借此更改 [预设路由](./preset-route.md) 返回手势类型。

#### routeOptions

[routeBuilder 接口定义](./custom-route.md#%E6%8E%A5%E5%8F%A3%E5%AE%9A%E4%B9%89) 。 `routeOptions` 将作为 `routeBuilder` 的第二个参数传入，开发者可根据当前页面动态改变路由动画的内容。比如对 `BottomSheet` 更改高度、圆角等，以适应不同场景。

```js
interface INavigateToArg {
  url: string,
  routeType: string,
  routeConfig: CustomRouteConfig,
  routeOptions: Record<string, any>
}

wx.navigateTo({
  routeType: 'wx://bottom-sheet',
  routeConfig: {
    fullscreenDrag: true,
    popGestureDirection: 'multi'
  },
  routeOptions: {
    round: false,
  },
})
```

常用的 `wx://bottom-sheet` 预设路由 `routeOptions` 增加如下属性

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>说明</th></tr></thead> <tbody><tr><td>round</td> <td>boolean</td> <td>true</td> <td>是否使用圆角</td></tr> <tr><td>height</td> <td>number</td> <td>60</td> <td>弹窗页面高度，单位 vh</td></tr></tbody></table>

## 示例代码片段

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/BGoSE0mS7KQS)
