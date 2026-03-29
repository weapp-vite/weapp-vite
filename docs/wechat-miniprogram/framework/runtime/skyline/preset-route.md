<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/preset-route.html -->

# 预设路由

为降低开发成本，基础库预设了一批常见的路由动画效果。

<table><thead><tr><th>routeType</th> <th>最低基础库版本</th></tr></thead> <tbody><tr><td><code>wx://bottom-sheet</code></td> <td>3.1.0</td></tr> <tr><td><code>wx://upwards</code></td> <td>3.1.0</td></tr> <tr><td><code>wx://zoom</code></td> <td>3.1.0</td></tr> <tr><td><code>wx://cupertino-modal</code></td> <td>3.1.0</td></tr> <tr><td><code>wx://cupertino-modal-inside</code></td> <td>3.1.0</td></tr> <tr><td><code>wx://modal-navigation</code></td> <td>3.1.0</td></tr> <tr><td><code>wx://modal</code></td> <td>3.1.0</td></tr></tbody></table>

## 使用方法

仅需在路由跳转时，指定对应的 `routeType` 。

注: 以上路由效果均可通过 [自定义路由](./custom-route.md) 实现，可参考示例代码中的源码文件，自定义所需效果。

```js
wx.navigateTo({
  url: 'xxx',
  routeType: 'wx://modal'
})
```

## 示例代码

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/XC8BGymC7QMo)

## 效果演示

wx://bottom-sheet

半屏弹窗

wx://upwards

向上进入

wx://zoom

放大进入

wx://cupertino-modal-inside

wx-cupertino-modal 跳转到 wx-cupertino-modal-inside

wx://modal-navigation

wx-cupertino-modal 跳转到 wx-modal-navigation

wx://modal

wx-modal 跳转到 wx-modal-navigation
