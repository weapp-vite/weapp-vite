<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/dynamic-slots.html -->

# 动态 slot

> 由于目前 glass-easel 组件框架仅可用于 [Skyline 渲染引擎](../../runtime/skyline/introduction.md) ，因此这些特性也同样受此限制。

## 静态 slot 与动态 slot

简单的自定义组件 slot 类型有两种：单一 slot 和多 slot ，取决于自定义组件的 `multipleSlots` 选项。它们都属于静态 slot 。

它们都要求（相同 name 的） slot 节点只有一个，重复的 `<slot />` 中只有第一个会生效。

之所以称其为“静态”，是因为无论组件的实现如何， slot 的内容（由组件使用者提供）只会出现一次，不会因 `<slot />` 的重复而重复。这样组件的使用者更容易控制它自身的节点。

从性能上看，单一 slot 也具有相对最优的性能表现。

但有时需要在列表中使用 slot 使得 slot 的内容被重复多次。此时可以使用动态 slot 。

```js
Component({
  options: {
    dynamicSlots: true, // 启用动态 slot
  },
  data: {
    list: ['A', 'B', 'C'],
  },
})
```

然后，在模板中可以使 `<slot />` 重复多次：

```xml
<block wx:for="{{ list }}">
  <slot />
</block>
```

## 通过动态 slot 传递数据

在动态 slot 中，被重复的 `<slot />` 可以分别携带不同的数据。例如：

```xml
<block wx:for="{{ list }}">
  <slot list-index="{{ index }}" item="{{ item }}" />
</block>
```

上述的 slot 中携带有 `list-index` 和 `item` 两个数据项。

组件的使用者可以通过 `slot:` 来接收 slot 传递的任何数据项。例如：

```xml
<view>
  <child>
    <view slot:item>{{ item }}</view>
    <view slot:listIndex>{{ listIndex }}</view>
  </child>
</view>
```

组件的使用者在接收 slot 传递的数据项时，可以更改数据项的字段名。例如：

```xml
<view>
  <child>
    <view slot:listIndex="index">{{ index }}</view>
  </child>
</view>
```
