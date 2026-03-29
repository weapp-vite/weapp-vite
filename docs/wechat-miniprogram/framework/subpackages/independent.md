<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/independent.html -->

# 独立分包

> 微信客户端 6.7.2，基础库 [2.3.0](../compatibility.md) 及以上版本开始支持。开发者工具请使用 1.02.1808300 及以上版本，可 [点此下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 。

独立分包是小程序中一种特殊类型的分包，可以独立于主包和其他分包运行。从独立分包中页面进入小程序时，不需要下载主包。当用户进入普通分包或主包内页面时，主包才会被下载。

开发者可以按需将某些具有一定功能独立性的页面配置到独立分包中。当小程序从普通的分包页面启动时，需要首先下载主包；而独立分包不依赖主包即可运行，可以很大程度上提升分包页面的启动速度。

一个小程序中可以有多个独立分包。

> 小游戏在基础库 v2.12.2 开始支持独立分包，详见 [小游戏独立分包指南](https://developers.weixin.qq.com/minigame/dev/guide/base-ability/independent-sub-packages.html) 。

## 配置方法

假设小程序目录结构如下：

```
├── app.js
├── app.json
├── app.wxss
├── moduleA
│   └── pages
│       ├── rabbit
│       └── squirrel
├── moduleB
│   └── pages
│       ├── pear
│       └── pineapple
├── pages
│   ├── index
│   └── logs
└── utils
```

开发者通过在 `app.json` 的 `subpackages` 字段中对应的分包配置项中定义 `independent` 字段声明对应分包为独立分包。

```json
{
  "pages": [
    "pages/index",
    "pages/logs"
  ],
  "subpackages": [
    {
      "root": "moduleA",
      "pages": [
        "pages/rabbit",
        "pages/squirrel"
      ]
    }, {
      "root": "moduleB",
      "pages": [
        "pages/pear",
        "pages/pineapple"
      ],
      "independent": true
    }
  ]
}
```

## 限制

独立分包属于分包的一种。普通分包的所有限制都对独立分包有效。独立分包中插件、自定义组件的处理方式同普通分包。

此外，使用独立分包时要注意：

- **独立分包中不能依赖主包和其他分包中的内容** ，包括 js 文件、template、wxss、自定义组件、插件等（使用 [分包异步化](./async.md) 时 js 文件、自定义组件、插件不受此条限制）
- 主包中的 `app.wxss` 对独立分包无效，应避免在独立分包页面中使用 `app.wxss` 中的样式；
- `App` 只能在主包内定义，独立分包中不能定义 `App` ，会造成无法预期的行为；
- 独立分包中暂时不支持使用插件。

## 注意事项

### （1）关于 `getApp()`

与普通分包不同，独立分包运行时， `App` 并不一定被注册，因此 `getApp()` 也不一定可以获得 `App` 对象：

- 当用户从独立分包页面启动小程序时，主包不存在， `App` 也不存在，此时调用 `getApp()` 获取到的是 `undefined` 。 当用户进入普通分包或主包内页面时，主包才会被下载， `App` 才会被注册。
- 当用户是从普通分包或主包内页面跳转到独立分包页面时，主包已经存在，此时调用 `getApp()` 可以获取到真正的 `App` 。

由于这一限制，开发者无法通过 `App` 对象实现独立分包和小程序其他部分的全局变量共享。

为了在独立分包中满足这一需求，基础库 [2.2.4](../compatibility.md) 版本开始 `getApp` 支持 [ `allowDefault` ] 参数，在 `App` 未定义时返回一个默认实现。当主包加载， `App` 被注册时，默认实现中定义的属性会被覆盖合并到真正的 `App` 中。

**示例代码：**

- 独立分包中

```js
const app = getApp({allowDefault: true}) // {}
app.data = 456
app.global = {}
```

- app.js 中

```js
App({
  data: 123,
  other: 'hello'
})

console.log(getApp()) // {global: {}, data: 456, other: 'hello'}
```

### （2）关于 `App` 生命周期

当从独立分包启动小程序时，主包中 `App` 的 `onLaunch` 和首次 `onShow` 会在从独立分包页面首次进入主包或其他普通分包页面时调用。

由于独立分包中无法定义 `App` ，小程序生命周期的监听可以使用 [wx.onAppShow](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAppShow.html) ， [wx.onAppHide](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onAppHide.html) 完成。 `App` 上的其他事件可以使用 [wx.onError](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onError.html) ， [wx.onPageNotFound](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onPageNotFound.html) 监听。

## 低版本兼容

在低于 6.7.2 版本的微信中运行时，独立分包视为普通分包处理，不具备独立运行的特性。

**注意：在兼容模式下，主包中的 `app.wxss` 可能会对独立分包中的页面产生影响，因此应避免在独立分包页面中使用 `app.wxss` 中的样式。**
