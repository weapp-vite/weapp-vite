<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/scene.html -->

# 场景值

> 基础库 1.1.0 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

场景值用来描述用户进入小程序的路径。完整场景值的含义请查看 [场景值列表](https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html) 。

由于Android系统限制，目前还无法获取到按 Home 键退出到桌面，然后从桌面再次进小程序的场景值，对于这种情况，会保留上一次的场景值。

## 获取场景值

开发者可以通过下列方式获取场景值：

- 对于小程序，可以在 `App` 的 `onLaunch` 和 `onShow` ，或 [wx.getLaunchOptionsSync](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html) 中获取上述场景值。
- 对于小游戏，可以在 [wx.getLaunchOptionsSync](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/life-cycle/wx.getLaunchOptionsSync.html) 和 [wx.onShow](https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/(wx.onShow)) 中获取上述场景值

## 返回来源信息的场景

部分场景值下还可以获取来源应用、公众号或小程序的appId。获取方式请参考对应API的参考文档。

<table><thead><tr><th>场景值</th> <th>场景</th> <th>appId含义</th></tr></thead> <tbody><tr><td>1020</td> <td>公众号 profile 页相关小程序列表</td> <td>来源公众号</td></tr> <tr><td>1035</td> <td>公众号自定义菜单</td> <td>来源公众号</td></tr> <tr><td>1036</td> <td>App 分享消息卡片</td> <td>来源App</td></tr> <tr><td>1037</td> <td>小程序打开小程序</td> <td>来源小程序</td></tr> <tr><td>1038</td> <td>从另一个小程序返回</td> <td>来源小程序</td></tr> <tr><td>1043</td> <td>公众号模板消息</td> <td>来源公众号</td></tr> <tr><td>1069</td> <td>移动应用</td> <td>来源App</td></tr></tbody></table>
