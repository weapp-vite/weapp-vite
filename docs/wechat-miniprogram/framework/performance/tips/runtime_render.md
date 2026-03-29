<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/runtime_render.html -->

# 渲染性能优化

## 1. 适当监听页面或组件的 scroll 事件

只要用户在 Page 构造时传入了 [onPageScroll](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/(api/Page.html#onPageScroll-Object-object)) 监听，基础库就会认为开发者需要监听页面 scoll 事件。此时，当用户滑动页面时，事件会以很高的频率从视图层发送到逻辑层，存在一定的通信开销。

类似的，对于 [`<scroll-view>`](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html) 、 [`<page-meta>`](https://developers.weixin.qq.com/miniprogram/dev/component/page-meta.html) 等可以通过 bindscroll 监听滑动事件的组件，也会存在这一情况。

正是由于 scroll 事件触发的频率很高，因此开发者很容易误用，在使用时需要注意：

- ✅ 非必要不监听 scroll 事件；
- ✅ 在实现与滚动相关的动画时，优先考虑 [滚动驱动动画](../../view/animation.md#%E6%BB%9A%E5%8A%A8%E9%A9%B1%E5%8A%A8%E7%9A%84%E5%8A%A8%E7%94%BB) （仅 [`<scroll-view>`](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view.html) ）或 [WXS 响应事件](../../view/interactive-animation.md)
- ❌ 不需要监听事件时，Page 构造时应不传入 onPageScroll 函数，而不是留空函数；
- ❌ 避免在 scroll 事件监听函数中执行复杂逻辑；
- ❌ 避免在 scroll 事件监听中频繁调用 setData 或同步 API。

```js
Page({
  onPageScroll () {} // ❌不要保留空函数
})

Page({
  // ✅ 应直接不传入
})
```

## 2. 选择高性能的动画实现方式

开发者在开发界面动画时，应该选择高性能的动画实现方式。

- ✅ 优先使用 CSS 渐变、CSS 动画、或小程序框架提供的其他 [动画实现方式](../../view/animation.md) 完成动画；
- ✅ 在一些复杂场景下，如果上述方式不能满足，可以使用 [WXS 响应事件](../../view/interactive-animation.md) 动态调整节点的 style 属性做到动画效果。同时，这种方式也可以根据用户的触摸事件来动态地生成动画；
- ❌ 避免通过连续 setData 改变界面的形式来实现动画。虽然实现起来简单灵活，但是极易出现较大的延迟或卡顿，甚至导致小程序僵死；
- ✅ 如果不得不采用 setData 方式，应尽可能将页面的 setData 改为自定义组件中的 setData 来提升性能。

## 3. 使用 IntersectionObserver 监听元素曝光

部分业务场景会需要监控元素曝光情况，用于进行一些页面状态的变更或上报分析。

- ✅ 建议使用 [节点布局相交状态监听 IntersectionObserver](../../view/selector.md) 推断某些节点是否可见、有多大比例可见；
- ❌ 避免通过监听 onPageScroll 事件，并在回调中通过持续 [查询节点信息 SelectQuery](../../view/selector.md) 来判断元素是否可见。

## 4. 控制 WXML 节点数量和层级

一个太大的 WXML 节点树会增加内存的使用，样式重排时间也会更长，影响体验。

- ✅ 建议一个页面 WXML 节点数量应少于 1000 个，节点树深度少于 30 层，子节点数不大于 60 个。

## 5. 控制在 Page 构造时传入的自定义数据量

为了便于开发，开发者可以添加任意的函数或数据到 Page 构造传入的 Object 参数中，并在页面的函数内用 this 访问。例如：

```js
Page({
  data: {}
  userInfo: {} // 自定义数据
  currentUser: 'Wechat' // 自定义数据
  onTap() { }
  onLoad() {
    console.log(this.currentUser)
  }
})
```

为了保证自定义数据在不同的页面实例中也是不同的实例，小程序框架会在页面创建时对这部分数据（函数类型字段除外）做一次 **深拷贝** ，如果自定义数据过多或过于复杂，可能带来很大的开销。

- ✅ 对于比较复杂的数据对象，建议在 `Page onLoad` 或 `Component created` 时手动赋值到 this 上，而不是通过 Page 构造时的参数传入。

```js
// ❌ 使用复杂对象作为自定义数据
Page({
  onLoad() { }
  bigData: { /* A complex object */ },
  longList: [ /* A long complex array*/ ]
})

// ✅ 运行时手动赋值到 this。开发者可以根据需要选择进行深拷贝、浅拷贝或不拷贝。
Page({
  onLoad() {
    this.bigData = { /* A complex object */ },
    this.longList = [ /* A long complex array*/ ]
  }
})
```
