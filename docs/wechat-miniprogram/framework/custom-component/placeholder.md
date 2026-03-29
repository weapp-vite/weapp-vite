<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/placeholder.html -->

# 占位组件

> 基础库 2.11.2 及以上版本支持，2.11.2 以下和未配置的效果相同

在使用如 [分包异步化](../subpackages/async.md) 或 [用时注入](../ability/lazyload.md#%E7%94%A8%E6%97%B6%E6%B3%A8%E5%85%A5) 等特性时，自定义组件所引用的其他自定义组件，在刚开始进行渲染时可能处于不可用的状态。此时，为了使渲染过程不被阻塞，不可用的自定义组件需要一个 **「占位组件」（Component placeholder）** 。基础库会用占位组件替代不可用组件进行渲染，在该组件可用后再将占位组件替换回该组件。

一个自定义组件的占位组件可以是另一个自定义组件、或一个内置组件。

## 配置

页面或自定义组件对应的 JSON 配置中的 `componentPlaceholder` 字段用于指定占位组件，如：

```json
{
  "usingComponents": {
    "comp-a": "../comp/compA",
    "comp-b": "../comp/compB",
    "comp-c": "../comp/compC"
  },
  "componentPlaceholder": {
    "comp-a": "view",
    "comp-b": "comp-c"
  }
}
```

该配置表示：

- 组件 `comp-a` 的占位组件为内置组件 `view`
- 组件 `comp-b` 的占位组件为自定义组件 `comp-c` （其路径在 `usingComponents` 中配置）

假设该配置对应的模板如下：

```html
<button ontap="onTap">显示组件</button>
<comp-a wx-if="{{ visible }}">
  <comp-b prop="{{ p }}">text in slot</comp-b>
</comp-a>
```

小程序启动时 `visible` 为 `false` ，那么只有 `button` 会被渲染；点击按钮后， `this.setData({ visible: true })` 被执行，此时如果 `comp-a` , `comp-b` 均不可用，则页面将被渲染为：

```html
<button>显示组件</button>
<view>
  <comp-c prop="{{ p }}">text in slot</comp-c>
</view>
```

`comp-a` 与 `comp-b` 准备完成后，页面被替换为：

```html
<button>显示组件</button>
<comp-a>
  <comp-b prop="{{ p }}">text in slot</comp-b>
</comp-a>
```

## 注意事项

1. 当一个组件被指定为占位组件时（如上例中的 `comp-c` ），为其指定占位组件是无效的。可以理解为如果一个组件需要作为其他组件的占位组件，则它必须在一开始就是可用的；
2. 目前自定义组件不可用的情况包括：
    - 使用分包异步化特性的情况下，引用了其他分包的组件，而对应分包还未下载；
    - 使用用时注入特性的情况下，该组件还未注入；
3. 如果一个组件不可用，且其占位组件不存在，则渲染时会报错并抛出；
4. 如果一个组件不存在，但为其指定了可用的占位组件，则占位组件可以被正常渲染，但后续尝试准备替换时会报错并抛出。

#### 附：有占位组件参与的渲染流程

基础库尝试渲染一个组件时，会首先递归检查 `usingComponents` ，收集其将使用到的所有组件的信息；在这个过程中，如果某个被使用到的组件不可用，基础库会先检查其是否有对应的占位组件。如果没有，基础库会中断渲染并抛出错误；如果有，则会标记并在后续渲染流程中使用占位组件替换该不可用的组件进行渲染。不可用的组件会在当前渲染流程结束后尝试准备（下载分包或注入代码等）；等到准备过程完成后，再尝试渲染该组件（实际上也是在执行这个流程），并替换掉之前渲染的占位组件。
