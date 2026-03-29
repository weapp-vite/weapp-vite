<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/animation.html -->

# 动画

## 界面动画的常见方式

在小程序中，通常可以使用 [CSS 渐变](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Transitions/Using_CSS_transitions) 和 [CSS 动画](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Animations/Using_CSS_animations) 来创建简易的界面动画。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/oHKxDPm47h5k)

动画过程中，可以使用 `bindtransitionend` `bindanimationstart` `bindanimationiteration` `bindanimationend` 来监听动画事件。

<table><thead><tr><th>事件名</th> <th>含义</th></tr></thead> <tbody><tr><td>transitionend</td> <td>CSS 渐变结束或 <a href="../../api/ui/animation/wx.createAnimation.html">wx.createAnimation</a> 结束一个阶段</td></tr> <tr><td>animationstart</td> <td>CSS 动画开始</td></tr> <tr><td>animationiteration</td> <td>CSS 动画结束一个阶段</td></tr> <tr><td>animationend</td> <td>CSS 动画结束</td></tr></tbody></table>

注意：这几个事件都不是冒泡事件，需要绑定在真正发生了动画的节点上才会生效。

同时，还可以使用 [wx.createAnimation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/wx.createAnimation.html) 接口来动态创建简易的动画效果。（新版小程序基础库中推荐使用下述的关键帧动画接口代替。）

## 关键帧动画

> 基础库 2.9.0 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

从小程序基础库 [2.9.0](../compatibility.md) 开始支持一种更友好的动画创建方式，用于代替旧的 [wx.createAnimation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/animation/wx.createAnimation.html) 。它具有更好的性能和更可控的接口。

在页面或自定义组件中，当需要进行关键帧动画时，可以使用 `this.animate` 接口：

```js
this.animate(selector, keyframes, duration, callback)
```

**参数说明**

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>selector</td> <td>String</td> <td></td> <td>是</td> <td>选择器（同 <a href="../../api/wxml/SelectorQuery.select.html">SelectorQuery.select</a> 的选择器格式）</td></tr> <tr><td>keyframes</td> <td>Array</td> <td></td> <td>是</td> <td>关键帧信息</td></tr> <tr><td>duration</td> <td>Number</td> <td></td> <td>是</td> <td>动画持续时长（毫秒为单位）</td></tr> <tr><td>callback</td> <td>function</td> <td></td> <td>否</td> <td>动画完成后的回调函数</td></tr></tbody></table>

**keyframes 中对象的结构**

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>offset</td> <td>Number</td> <td></td> <td>否</td> <td>关键帧的偏移，范围[0-1]</td></tr> <tr><td>ease</td> <td>String</td> <td>linear</td> <td>否</td> <td>动画缓动函数</td></tr> <tr><td>transformOrigin</td> <td>String</td> <td>否</td> <td>基点位置，即 CSS transform-origin</td> <td></td></tr> <tr><td>backgroundColor</td> <td>String</td> <td></td> <td>否</td> <td>背景颜色，即 CSS background-color</td></tr> <tr><td>opacity</td> <td>Number</td> <td></td> <td>否</td> <td>不透明度，即 CSS opacity</td></tr> <tr><td>width</td> <td>String</td> <td></td> <td>否</td> <td>宽度，即 CSS width</td></tr> <tr><td>height</td> <td>String</td> <td></td> <td>否</td> <td>高度，即 CSS height</td></tr> <tr><td>left</td> <td>String</td> <td></td> <td>否</td> <td>左边位置，即 CSS left</td></tr> <tr><td>top</td> <td>String</td> <td></td> <td>否</td> <td>顶边位置，即 CSS top</td></tr> <tr><td>right</td> <td>String</td> <td></td> <td>否</td> <td>右边位置，即 CSS right</td></tr> <tr><td>bottom</td> <td>String</td> <td></td> <td>否</td> <td>底边位置，即 CSS bottom</td></tr> <tr><td>matrix</td> <td>Array</td> <td></td> <td>否</td> <td>变换矩阵，即 CSS transform matrix</td></tr> <tr><td>matrix3d</td> <td>Array</td> <td></td> <td>否</td> <td>三维变换矩阵，即 CSS transform matrix3d</td></tr> <tr><td>rotate</td> <td>Number</td> <td></td> <td>否</td> <td>旋转，即 CSS transform rotate</td></tr> <tr><td>rotate3d</td> <td>Array</td> <td></td> <td>否</td> <td>三维旋转，即 CSS transform rotate3d</td></tr> <tr><td>rotateX</td> <td>Number</td> <td></td> <td>否</td> <td>X 方向旋转，即 CSS transform rotateX</td></tr> <tr><td>rotateY</td> <td>Number</td> <td></td> <td>否</td> <td>Y 方向旋转，即 CSS transform rotateY</td></tr> <tr><td>rotateZ</td> <td>Number</td> <td></td> <td>否</td> <td>Z 方向旋转，即 CSS transform rotateZ</td></tr> <tr><td>scale</td> <td>Array</td> <td></td> <td>否</td> <td>缩放，即 CSS transform scale</td></tr> <tr><td>scale3d</td> <td>Array</td> <td></td> <td>否</td> <td>三维缩放，即 CSS transform scale3d</td></tr> <tr><td>scaleX</td> <td>Number</td> <td></td> <td>否</td> <td>X 方向缩放，即 CSS transform scaleX</td></tr> <tr><td>scaleY</td> <td>Number</td> <td></td> <td>否</td> <td>Y 方向缩放，即 CSS transform scaleY</td></tr> <tr><td>scaleZ</td> <td>Number</td> <td></td> <td>否</td> <td>Z 方向缩放，即 CSS transform scaleZ</td></tr> <tr><td>skew</td> <td>Array</td> <td></td> <td>否</td> <td>倾斜，即 CSS transform skew</td></tr> <tr><td>skewX</td> <td>Number</td> <td></td> <td>否</td> <td>X 方向倾斜，即 CSS transform skewX</td></tr> <tr><td>skewY</td> <td>Number</td> <td></td> <td>否</td> <td>Y 方向倾斜，即 CSS transform skewY</td></tr> <tr><td>translate</td> <td>Array</td> <td></td> <td>否</td> <td>位移，即 CSS transform translate</td></tr> <tr><td>translate3d</td> <td>Array</td> <td></td> <td>否</td> <td>三维位移，即 CSS transform translate3d</td></tr> <tr><td>translateX</td> <td>Number</td> <td></td> <td>否</td> <td>X 方向位移，即 CSS transform translateX</td></tr> <tr><td>translateY</td> <td>Number</td> <td></td> <td>否</td> <td>Y 方向位移，即 CSS transform translateY</td></tr> <tr><td>translateZ</td> <td>Number</td> <td></td> <td>否</td> <td>Z 方向位移，即 CSS transform translateZ</td></tr></tbody></table>

### 示例代码

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/P73kJ7mi7UcA)

```javascript

  this.animate('#container', [
    { opacity: 1.0, rotate: 0, backgroundColor: '#FF0000' },
    { opacity: 0.5, rotate: 45, backgroundColor: '#00FF00'},
    { opacity: 0.0, rotate: 90, backgroundColor: '#FF0000' },
    ], 5000, function () {
      this.clearAnimation('#container', { opacity: true, rotate: true }, function () {
        console.log("清除了#container上的opacity和rotate属性")
      })
  }.bind(this))

  this.animate('.block', [
    { scale: [1, 1], rotate: 0, ease: 'ease-out'  },
    { scale: [1.5, 1.5], rotate: 45, ease: 'ease-in', offset: 0.9},
    { scale: [2, 2], rotate: 90 },
  ], 5000, function () {
    this.clearAnimation('.block', function () {
      console.log("清除了.block上的所有动画属性")
    })
  }.bind(this))
```

调用 animate API 后会在节点上新增一些样式属性覆盖掉原有的对应样式。如果需要清除这些样式，可在该节点上的动画全部执行完毕后使用 `this.clearAnimation` 清除这些属性。

```js
this.clearAnimation(selector, options, callback)
```

**参数说明**

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>selector</td> <td>String</td> <td></td> <td>是</td> <td>选择器（同 <a href="../../api/wxml/SelectorQuery.select.html">SelectorQuery.select</a> 的选择器格式）</td></tr> <tr><td>options</td> <td>Object</td> <td></td> <td>否</td> <td>需要清除的属性，不填写则全部清除</td></tr> <tr><td>callback</td> <td>Function</td> <td></td> <td>否</td> <td>清除完成后的回调函数</td></tr></tbody></table>

## 滚动驱动的动画

我们发现，根据滚动位置而不断改变动画的进度是一种比较常见的场景，这类动画可以让人感觉到界面交互很连贯自然，体验更好。因此，从小程序基础库 [2.9.0](../compatibility.md) 开始支持一种由滚动驱动的动画机制。

基于上述的关键帧动画接口，新增一个 `ScrollTimeline` 的参数，用来绑定滚动元素（目前只支持 scroll-view）。接口定义如下：

```javascript
this.animate(selector, keyframes, duration, ScrollTimeline)
```

**ScrollTimeline 中对象的结构**

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>scrollSource</td> <td>String</td> <td></td> <td>是</td> <td>指定滚动元素的选择器（只支持 scroll-view），该元素滚动时会驱动动画的进度</td></tr> <tr><td>orientation</td> <td>String</td> <td>vertical</td> <td>否</td> <td>指定滚动的方向。有效值为 horizontal 或 vertical</td></tr> <tr><td>startScrollOffset</td> <td>Number</td> <td></td> <td>是</td> <td>指定开始驱动动画进度的滚动偏移量，单位 px</td></tr> <tr><td>endScrollOffset</td> <td>Number</td> <td></td> <td>是</td> <td>指定停止驱动动画进度的滚动偏移量，单位 px</td></tr> <tr><td>timeRange</td> <td>Number</td> <td></td> <td>是</td> <td>起始和结束的滚动范围映射的时间长度，该时间可用于与关键帧动画里的时间 (duration) 相匹配，单位 ms</td></tr></tbody></table>

### 示例代码

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/994o8jmY7FcQ)

```javascript
  this.animate('.avatar', [{
    borderRadius: '0',
    borderColor: 'red',
    transform: 'scale(1) translateY(-20px)',
    offset: 0,
  }, {
    borderRadius: '25%',
    borderColor: 'blue',
    transform: 'scale(.65) translateY(-20px)',
    offset: .5,
  }, {
    borderRadius: '50%',
    borderColor: 'blue',
    transform: `scale(.3) translateY(-20px)`,
    offset: 1
  }], 2000, {
    scrollSource: '#scroller',
    timeRange: 2000,
    startScrollOffset: 0,
    endScrollOffset: 85,
  })

  this.animate('.search_input', [{
    opacity: '0',
    width: '0%',
  }, {
    opacity: '1',
    width: '100%',
  }], 1000, {
    scrollSource: '#scroller',
    timeRange: 1000,
    startScrollOffset: 120,
    endScrollOffset: 252
  })
```

## 高级的动画方式

在一些复杂场景下，上述的动画方法可能并不适用。

[WXS 响应事件](./interactive-animation.md) 的方式可以通过使用 WXS 来响应事件的方法来动态调整节点的 style 属性。通过不断改变 style 属性的值可以做到动画效果。同时，这种方式也可以根据用户的触摸事件来动态地生成动画。

连续使用 setData 来改变界面的方法也可以达到动画的效果。这样可以任意地改变界面，但通常会产生较大的延迟或卡顿，甚至导致小程序僵死。此时可以通过将页面的 setData 改为 [自定义组件](../custom-component/README.md) 中的 setData 来提升性能。下面的例子是使用 setData 来实现秒表动画的示例。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/cRTvdPmO7d5T)
