<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/pure-data.html -->

# 纯数据字段

纯数据字段是一些不用于界面渲染的 data 字段，可以用于提升页面更新性能。从小程序基础库版本 [2.8.2](../compatibility.md) 开始支持。

## 组件数据中的纯数据字段

有些情况下，某些 `data` 中的字段（包括 `setData` 设置的字段）既不会展示在界面上，也不会传递给其他组件，仅仅在当前组件内部使用。

此时，可以指定这样的数据字段为“纯数据字段”，它们将仅仅被记录在 `this.data` 中，而不参与任何界面渲染过程，这样有助于提升页面更新性能。

指定“纯数据字段”的方法是在 `Component` 构造器的 `options` 定义段中指定 `pureDataPattern` 为一个正则表达式，字段名符合这个正则表达式的字段将成为纯数据字段。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/DKWiBXmb7jaB)

**代码示例：**

```js
Component({
  options: {
    pureDataPattern: /^_/ // 指定所有 _ 开头的数据字段为纯数据字段
  },
  data: {
    a: true, // 普通数据字段
    _b: true, // 纯数据字段
  },
  methods: {
    myMethod() {
      this.data._b // 纯数据字段可以在 this.data 中获取
      this.setData({
        c: true, // 普通数据字段
        _d: true, // 纯数据字段
      })
    }
  }
})
```

上述组件中的纯数据字段不会被应用到 WXML 上：

```html
<view wx:if="{{a}}"> 这行会被展示 </view>
<view wx:if="{{_b}}"> 这行不会被展示 </view>
```

## 组件属性中的纯数据字段

属性也可以被指定为纯数据字段（遵循 `pureDataPattern` 的正则表达式）。

属性中的纯数据字段可以像普通属性一样接收外部传入的属性值，但不能将它直接用于组件自身的 WXML 中。

**代码示例：**

```js
Component({
  options: {
    pureDataPattern: /^_/
  },
  properties: {
    a: Boolean,
    _b: {
      type: Boolean,
      observer() {
        // 不要这样做！这个 observer 永远不会被触发
      }
    },
  }
})
```

注意：属性中的纯数据字段的属性 observer 永远不会触发！如果想要监听属性值变化，使用 [数据监听器](./observer.md) 代替。

从小程序基础库版本 [2.10.1](../compatibility.md) 开始，也可以在页面或自定义组件的 json 文件中配置 `pureDataPattern` （这样就不需在 js 文件的 `options` 中再配置）。此时，其值应当写成字符串形式：

```json
{
  "pureDataPattern": "^_"
}
```

## 使用数据监听器监听纯数据字段

[数据监听器](./observer.md) 可以用于监听纯数据字段（与普通数据字段一样）。这样，可以通过监听、响应纯数据字段的变化来改变界面。

下面的示例是一个将 JavaScript 时间戳转换为可读时间的自定义组件。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/fcWA1Xmd7tak)

**代码示例：**

```js
Component({
  options: {
    pureDataPattern: /^timestamp$/ // 将 timestamp 属性指定为纯数据字段
  },
  properties: {
    timestamp: Number,
  },
  observers: {
    timestamp: function () {
      // timestamp 被设置时，将它展示为可读时间字符串
      var timeString = new Date(this.data.timestamp).toLocaleString()
      this.setData({
        timeString: timeString
      })
    }
  }
})
```

```html
<view>{{timeString}}</view>
```
