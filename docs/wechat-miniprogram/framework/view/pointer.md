<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/pointer.html -->

# Pointer 事件

在 PC 端小程序中，小程序组件将会触发 pointer 事件。可以使用 pointer 事件来实现划入、右键等定制能力。pointer 事件基本上是基于 web 标准的 pointer 事件做的封装。

web 标准 pointer 事件的文档：https://developer.mozilla.org/zh-CN/docs/Web/API/Pointer\_events

示例：

```
  <view
    bind:pointerdown="pointerdown"
    bind:pointerup="pointerup"
    bind:pointermove="pointermove"
    class="intro">
  测试代码
  </view>
```

测试代码片段 - 右键响应： https://developers.weixin.qq.com/s/l1pW2qmy7RZJ
