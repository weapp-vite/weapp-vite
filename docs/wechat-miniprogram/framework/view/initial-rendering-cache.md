<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/initial-rendering-cache.html -->

# 初始渲染缓存

> 基础库 2.11.1 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

## 初始渲染缓存工作原理

小程序页面的初始化分为两个部分。

- 逻辑层初始化：载入必需的小程序代码、初始化页面 this 对象（也包括它涉及到的所有自定义组件的 this 对象）、将相关数据发送给视图层。
- 视图层初始化：载入必需的小程序代码，然后等待逻辑层初始化完毕并接收逻辑层发送的数据，最后渲染页面。

在启动页面时，尤其是小程序冷启动、进入第一个页面时，逻辑层初始化的时间较长。在页面初始化过程中，用户将看到小程序的标准载入画面（冷启动时）或可能看到轻微的白屏现象（页面跳转过程中）。

启用初始渲染缓存，可以使视图层不需要等待逻辑层初始化完毕，而直接提前将页面初始 data 的渲染结果展示给用户，这可以使得页面对用户可见的时间大大提前。它的工作原理如下：

- 在小程序页面第一次被打开后，将页面初始数据渲染结果记录下来，写入一个持久化的缓存区域（缓存可长时间保留，但可能因为小程序更新、基础库更新、储存空间回收等原因被清除）；
- 在这个页面被第二次打开时，检查缓存中是否还存有这个页面上一次初始数据的渲染结果，如果有，就直接将渲染结果展示出来；
- 如果展示了缓存中的渲染结果，这个页面暂时还不能响应用户事件，等到逻辑层初始化完毕后才能响应用户事件。

利用初始渲染缓存，可以：

- 快速展示出页面中永远不会变的部分，如导航栏；
- 预先展示一个骨架页，提升用户体验；
- 展示自定义的加载提示；
- 提前展示广告，等等。

## 支持的组件

在初始渲染缓存阶段中，复杂组件不能被展示或不能响应交互。

目前支持的内置组件：

- `<view />`
- `<text />`
- `<button />`
- `<image />`
- `<scroll-view />`
- `<rich-text />`

自定义组件本身可以被展示（但它们里面用到的内置组件也遵循上述限制）。

## 静态初始渲染缓存

若想启用初始渲染缓存，最简单的方法是在页面的 `json` 文件中添加配置项 `"initialRenderingCache": "static"` ：

```json
{
  "initialRenderingCache": "static"
}
```

如果想要对所有页面启用，可以在 `app.json` 的 `window` 配置段中添加这个配置：

```json
{
  "window": {
    "initialRenderingCache": "static"
  }
}
```

添加这个配置项之后，在手机中预览小程序首页，然后杀死小程序再次进入，就会通过初始渲染缓存来渲染首页。

注意：这种情况下，初始渲染缓存记录的是页面 data 应用在页面 WXML 上的结果，不包含任何 setData 的结果。

例如，如果想要在页面中展示出“正在加载”几个字，这几个字受到 `loading` 数据字段控制：

```html
<view wx:if="{{loading}}">正在加载</view>
```

这种情况下， `loading` 应当在 `data` 中指定为 `true` ，如：

```js
// 正确的做法
Page({
  data: {
    loading: true
  }
})
```

而不能通过 `setData` 将 `loading` 置为 `true` ：

```js
// 错误的做法！不要这么做！
Page({
  data: {},
  onLoad: function() {
    this.setData({
      loading: true
    })
  }
})
```

换而言之，这种做法只包含页面 `data` 的渲染结果，即页面的纯静态成分。

## 自定义渲染缓存时机

> 基础库 3.7.4 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

静态初始渲染缓存只在页面首次渲染完成后生成渲染缓存，在 `onLoad` 或之后的生命周期新增的页面内容无法进入缓存中。如果想要在自定义的时机生成缓存，可以配置 `"initialRenderingCache": "capture"` ：

```json
{
  "initialRenderingCache": "capture"
}
```

此时，初始渲染缓存不会被自动启用，还需要在页面中调用 `this.setInitialRenderingCache()` 才能启用。

```js
Page({
  data: {
    loading: true
  },
  onLoad: function() {
    this.setData({
      loading: false
    })
    this.setInitialRenderingCache() // 渲染缓存会在此时生成
  }
})
```

## 在初始渲染缓存中添加动态内容

有些场景中，只是页面 `data` 的渲染结果会比较局限。有时会想要额外展示一些可变的内容。

这种情况下可以使用“动态”初始渲染缓存的方式。首先，配置 `"initialRenderingCache": "dynamic"` ：

```json
{
  "initialRenderingCache": "dynamic"
}
```

此时，初始渲染缓存不会被自动启用，还需要在页面中调用 `this.setInitialRenderingCache(dynamicData)` 才能启用。其中， `dynamicData` 是一组数据，与 `data` 一起参与页面 WXML 渲染。

```js
Page({
  data: {
    loading: true
  },
  onReady: function() {
    this.setInitialRenderingCache({
      loadingHint: '正在加载' // 这一部分数据不会真的参与页面渲染，仅仅用于生成缓存。也并*不等价*于一次 setData 调用
    })
  }
})
```

```html
<view wx:if="{{loading}}">{{loadingHint}}</view>
```

从原理上说，在动态生成初始渲染缓存的方式下，页面会在后台使用动态数据重新渲染一次，因而开销相对较大。因而要尽量避免频繁调用 `this.setInitialRenderingCache` ，如果在一个页面内多次调用，仅最后一次调用生效。

注意：

- `this.setInitialRenderingCache` 调用时机不能早于 `Page` 的 `onReady` 或 `Component` 的 `ready` 生命周期，否则可能对性能有负面影响。
- 如果想禁用初始渲染缓存，调用 `this.setInitialRenderingCache(null)` 。
