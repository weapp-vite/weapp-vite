<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/lifetimes.html -->

# 组件生命周期

组件的生命周期，指的是组件自身的一些函数，这些函数在特殊的时间点或遇到一些特殊的框架事件时被自动触发。

其中，最重要的生命周期是 `created` `attached` `detached` ，包含一个组件实例生命流程的最主要时间点。

- 组件实例刚刚被创建好时， `created` 生命周期被触发。此时，组件数据 `this.data` 就是在 `Component` 构造器中定义的数据 `data` 。 **此时还不能调用 `setData` 。** 通常情况下，这个生命周期只应该用于给组件 `this` 添加一些自定义属性字段。
- 在组件完全初始化完毕、进入页面节点树后， `attached` 生命周期被触发。此时， `this.data` 已被初始化为组件的当前值。这个生命周期很有用，绝大多数初始化工作可以在这个时机进行。
- 在组件离开页面节点树后， `detached` 生命周期被触发。退出一个页面时，如果组件还在页面节点树中，则 `detached` 会被触发。

## 定义生命周期方法

生命周期方法可以直接定义在 `Component` 构造器的第一级参数中。

自小程序基础库版本 [2.2.3](../compatibility.md) 起，组件的的生命周期也可以在 `lifetimes` 字段内进行声明（这是推荐的方式，其优先级最高）。

### 代码示例

```js
Component({
  lifetimes: {
    attached: function() {
      // 在组件实例进入页面节点树时执行
    },
    detached: function() {
      // 在组件实例被从页面节点树移除时执行
    },
  },
  // 以下是旧式的定义方式，可以保持对 <2.2.3 版本基础库的兼容
  attached: function() {
    // 在组件实例进入页面节点树时执行
  },
  detached: function() {
    // 在组件实例被从页面节点树移除时执行
  },
  // ...
})
```

在 behaviors 中也可以编写生命周期方法，同时不会与其他 behaviors 中的同名生命周期相互覆盖。但要注意，如果一个组件多次直接或间接引用同一个 behavior ，这个 behavior 中的生命周期函数在一个执行时机内只会执行一次。

可用的全部生命周期如下表所示。

<table><thead><tr><th>生命周期</th> <th>参数</th> <th>描述</th> <th>最低版本</th></tr></thead> <tbody><tr><td>created</td> <td>无</td> <td>在组件实例刚刚被创建时执行</td> <td><a href="../compatibility.html">1.6.3</a></td></tr> <tr><td>attached</td> <td>无</td> <td>在组件实例进入页面节点树时执行</td> <td><a href="../compatibility.html">1.6.3</a></td></tr> <tr><td>ready</td> <td>无</td> <td>在渲染线程被初始化已经完成</td> <td><a href="../compatibility.html">1.6.3</a></td></tr> <tr><td>moved</td> <td>无</td> <td>在组件实例被移动到节点树另一个位置时执行</td> <td><a href="../compatibility.html">1.6.3</a></td></tr> <tr><td>detached</td> <td>无</td> <td>在组件实例被从页面节点树移除时执行</td> <td><a href="../compatibility.html">1.6.3</a></td></tr> <tr><td>error</td> <td><code>Object Error</code></td> <td>每当组件方法抛出错误时执行</td> <td><a href="../compatibility.html">2.4.1</a></td></tr></tbody></table>

**注意**

取决于渲染线程的繁忙情况， `ready` 回调可能会非常晚，并可能在组件被移除后才回调。绝大多数情况下，应使用 `attached` 代替。

使用 `ready` 生命周期时，需要处理以下可能的情况：

1. `attached` 触发后， `ready` 被触发
2. `attached` 未触发，仅 `ready` 被触发
3. `attached` 和 `detached` 依次触发后， `ready` 被触发

## 组件所在页面的生命周期

还有一些特殊的生命周期，它们并非与组件有很强的关联，但有时组件需要获知，以便组件内部处理。这样的生命周期称为“组件所在页面的生命周期”，在 `pageLifetimes` 定义段中定义。其中可用的生命周期包括：

<table><thead><tr><th>生命周期</th> <th>参数</th> <th>描述</th> <th>最低版本</th></tr></thead> <tbody><tr><td>show</td> <td>无</td> <td>组件所在的页面被展示时执行</td> <td><a href="../compatibility.html">2.2.3</a></td></tr> <tr><td>hide</td> <td>无</td> <td>组件所在的页面被隐藏时执行</td> <td><a href="../compatibility.html">2.2.3</a></td></tr> <tr><td>resize</td> <td><code>Object Size</code></td> <td>组件所在的页面尺寸变化时执行</td> <td><a href="../compatibility.html">2.4.0</a></td></tr> <tr><td>routeDone</td> <td>无</td> <td>组件所在页面路由动画完成时执行</td> <td><a href="../compatibility.html">2.31.2</a></td></tr></tbody></table>

注意：自定义 tabBar 的 pageLifetime 不会触发。

### 代码示例

```js
Component({
  pageLifetimes: {
    show: function() {
      // 页面被展示
    },
    hide: function() {
      // 页面被隐藏
    },
    resize: function(size) {
      // 页面尺寸变化
    }
  }
})
```
