<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/config.html -->

# 小程序配置

## 全局配置

小程序根目录下的 `app.json` 文件用来对微信小程序进行全局配置，决定页面文件的路径、窗口表现、设置网络超时时间、设置多 tab 等。

完整配置项说明请参考 [小程序全局配置](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html)

以下是一个包含了部分常用配置选项的 `app.json` ：

```json
{
  "pages": [
    "pages/index/index",
    "pages/logs/index"
  ],
  "window": {
    "navigationBarTitleText": "Demo"
  },
  "tabBar": {
    "list": [{
      "pagePath": "pages/index/index",
      "text": "首页"
    }, {
      "pagePath": "pages/logs/index",
      "text": "日志"
    }]
  },
  "networkTimeout": {
    "request": 10000,
    "downloadFile": 10000
  },
  "debug": true
}
```

完整配置项说明请参考 [小程序全局配置](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html)

## 页面配置

每一个小程序页面也可以使用同名 `.json` 文件来对本页面的窗口表现进行配置，页面中配置项会覆盖 `app.json` 的 `window` 中相同的配置项。

完整配置项说明请参考 [小程序页面配置](https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/page.html)

例如：

```json
{
  "navigationBarBackgroundColor": "#ffffff",
  "navigationBarTextStyle": "black",
  "navigationBarTitleText": "微信接口功能演示",
  "backgroundColor": "#eeeeee",
  "backgroundTextStyle": "light"
}
```
