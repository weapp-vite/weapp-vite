<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/generics.html -->

# 抽象节点

这个特性自小程序基础库版本 [1.9.6](../compatibility.md) 开始支持。

## 在组件中使用抽象节点

有时，自定义组件模板中的一些节点，其对应的自定义组件不是由自定义组件本身确定的，而是自定义组件的调用者确定的。这时可以把这个节点声明为“抽象节点”。

例如，我们现在来实现一个“选框组”（selectable-group）组件，它其中可以放置单选框（custom-radio）或者复选框（custom-checkbox）。这个组件的 wxml 可以这样编写：

**代码示例：**

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/ztPzoImW7E7P)

```html
<!-- selectable-group.wxml -->
<view wx:for="{{labels}}">
  <label>
    <selectable disabled="{{false}}"></selectable>
    {{item}}
  </label>
</view>
```

其中，“selectable”不是任何在 json 文件的 `usingComponents` 字段中声明的组件，而是一个抽象节点。它需要在 `componentGenerics` 字段中声明：

```json
{
  "componentGenerics": {
    "selectable": true
  }
}
```

## 使用包含抽象节点的组件

在使用 selectable-group 组件时，必须指定“selectable”具体是哪个组件：

```html
<selectable-group generic:selectable="custom-radio" />
```

这样，在生成这个 selectable-group 组件的实例时，“selectable”节点会生成“custom-radio”组件实例。类似地，如果这样使用：

```html
<selectable-group generic:selectable="custom-checkbox" />
```

“selectable”节点则会生成“custom-checkbox”组件实例。

注意：上述的 `custom-radio` 和 `custom-checkbox` 需要包含在这个 wxml 对应 json 文件的 `usingComponents` 定义段中。

```json
{
  "usingComponents": {
    "custom-radio": "path/to/custom/radio",
    "custom-checkbox": "path/to/custom/checkbox"
  }
}
```

## 抽象节点的默认组件

抽象节点可以指定一个默认组件，当具体组件未被指定时，将创建默认组件的实例。默认组件可以在 `componentGenerics` 字段中指定：

```json
{
  "componentGenerics": {
    "selectable": {
      "default": "path/to/default/component"
    }
  }
}
```

## 注意事项

- 节点的 generic 引用 `generic:xxx="yyy"` 中，值 `yyy` 只能是静态值，不能包含数据绑定。因而抽象节点特性并不适用于动态决定节点名的场景。
