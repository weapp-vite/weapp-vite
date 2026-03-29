<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxs/ -->

# WXS

WXS（WeiXin Script）是内联在 WXML 中的脚本段。通过 WXS 可以在模版中内联少量处理脚本，丰富模板的数据预处理能力。另外， WXS 还可以用来编写简单的 [WXS 事件响应函数](../interactive-animation.md) 。

从语法上看， WXS 类似于有少量限制的 JavaScript 。要完整了解 WXS 语法，请参考 [WXS 语法参考](https://developers.weixin.qq.com/miniprogram/dev/reference/wxs/) 。

以下是一些使用 WXS 的简单示例。

## 页面渲染

```html
<!--wxml-->
<wxs module="m1">
var msg = "hello world";

module.exports.message = msg;
</wxs>

<view> {{m1.message}} </view>
```

页面输出：

```
hello world
```

## 数据处理

```js
// page.js
Page({
  data: {
    array: [1, 2, 3, 4, 5, 1, 2, 3, 4]
  }
})
```

```html
<!--wxml-->
<!-- 下面的 getMax 函数，接受一个数组，且返回数组中最大的元素的值 -->
<wxs module="m1">
var getMax = function(array) {
  var max = undefined;
  for (var i = 0; i < array.length; ++i) {
    max = max === undefined ?
      array[i] :
      (max >= array[i] ? max : array[i]);
  }
  return max;
}

module.exports.getMax = getMax;
</wxs>

<!-- 调用 wxs 里面的 getMax 函数，参数为 page.js 里面的 array -->
<view> {{m1.getMax(array)}} </view>
```

页面输出：

```
5
```
