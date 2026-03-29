<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/two-way-bindings.html -->

# 简易双向绑定

> 基础库 2.9.3 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

## 双向绑定语法

在 WXML 中，普通的属性的绑定是单向的。例如：

```html
<input value="{{value}}" />
```

如果使用 `this.setData({ value: 'leaf' })` 来更新 `value` ， `this.data.value` 和输入框的中显示的值都会被更新为 `leaf` ；但如果用户修改了输入框里的值，却不会同时改变 `this.data.value` 。

如果需要在用户输入的同时改变 `this.data.value` ，需要借助简易双向绑定机制。此时，可以在对应项目之前加入 `model:` 前缀：

```html
<input model:value="{{value}}" />
```

这样，如果输入框的值被改变了， `this.data.value` 也会同时改变。同时， WXML 中所有绑定了 `value` 的位置也会被一同更新， [数据监听器](../custom-component/observer.md) 也会被正常触发。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/8jXvobmV7vcj)

用于双向绑定的表达式有如下限制：

1. 只能是一个单一字段的绑定，如

```js
<input model:value="值为 {{value}}" />
<input model:value="{{ a + b }}" />
```

都是非法的；

1. 目前，尚不能 data 路径，如

```js
<input model:value="{{ a.b }}" />
```

这样的表达式目前暂不支持。

## 在自定义组件中传递双向绑定

双向绑定同样可以使用在自定义组件上。如下的自定义组件：

```js
// custom-component.js
Component({
  properties: {
    myValue: String
  }
})
```

```html
<!-- custom-component.wxml -->
<input model:value="{{myValue}}" />
```

这个自定义组件将自身的 `myValue` 属性双向绑定到了组件内输入框的 `value` 属性上。这样，如果页面这样使用这个组件：

```html
<custom-component model:my-value="{{pageValue}}" />
```

当输入框的值变更时，自定义组件的 `myValue` 属性会同时变更，这样，页面的 `this.data.pageValue` 也会同时变更，页面 WXML 中所有绑定了 `pageValue` 的位置也会被一同更新。

## 在自定义组件中触发双向绑定更新

自定义组件还可以自己触发双向绑定更新，做法就是：使用 setData 设置自身的属性。例如：

```js
// custom-component.js
Component({
  properties: {
    myValue: String
  },
  methods: {
    update: function() {
      // 更新 myValue
      this.setData({
        myValue: 'leaf'
      })
    }
  }
})
```

如果页面这样使用这个组件：

```html
<custom-component model:my-value="{{pageValue}}" />
```

当组件使用 `setData` 更新 `myValue` 时，页面的 `this.data.pageValue` 也会同时变更，页面 WXML 中所有绑定了 `pageValue` 的位置也会被一同更新。
