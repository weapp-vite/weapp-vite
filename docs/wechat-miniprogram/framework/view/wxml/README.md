<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/ -->

# WXML

WXML（WeiXin Markup Language）是框架设计的一套标签语言，结合 [基础组件](https://developers.weixin.qq.com/miniprogram/dev/component/) 、 [事件系统](./event.md) ，可以构建出页面的结构。

要完整了解 WXML 语法，请参考 [WXML 语法参考](https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/) 。

用以下一些简单的例子来看看 WXML 具有什么能力：

## 数据绑定

```html
<!--wxml-->
<view> {{message}} </view>
```

```js
// page.js
Page({
  data: {
    message: 'Hello MINA!'
  }
})
```

## 列表渲染

```html
<!--wxml-->
<view wx:for="{{array}}"> {{item}} </view>
```

```js
// page.js
Page({
  data: {
    array: [1, 2, 3, 4, 5]
  }
})
```

## 条件渲染

```html
<!--wxml-->
<view wx:if="{{view == 'WEBVIEW'}}"> WEBVIEW </view>
<view wx:elif="{{view == 'APP'}}"> APP </view>
<view wx:elif="{{view == 'MINA'}}"> MINA </view>
<view wx:else> UNKNOWN </view>
```

```js
// page.js
Page({
  data: {
    view: 'MINA'
  }
})
```

## 模板

```html
<!--wxml-->
<template name="staffName">
  <view>
    FirstName: {{firstName}}, LastName: {{lastName}}
  </view>
</template>

<template is="staffName" data="{{...staffA}}"></template>
<template is="staffName" data="{{...staffB}}"></template>
<template is="staffName" data="{{...staffC}}"></template>
```

```js
// page.js
Page({
  data: {
    staffA: {firstName: 'Hulk', lastName: 'Hu'},
    staffB: {firstName: 'Shang', lastName: 'You'},
    staffC: {firstName: 'Gideon', lastName: 'Lin'}
  }
})
```

具体的能力以及使用方式在以下章节查看：

[数据绑定](https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/data.html) 、 [列表渲染](https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/list.html) 、 [条件渲染](https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/conditional.html) 、 [模板](https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/template.html) 、 [引用](https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/import.html)
