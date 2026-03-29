<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/worklet.html -->

# worklet 动画

小程序采用双线程架构，渲染线程（UI 线程）和逻辑线程（JS 线程）分离。 `JS` 线程不会影响 `UI` 线程的动画表现，如滚动效果。但引入的问题是， `UI` 线程的事件发生后，需跨线程传递到 `JS` 线程，进而触发开发者回调，当做交互动画（如拖动元素）时，这种异步性会带来较大的延迟和不稳定。

`worklet` 动画正是为解决这类问题而诞生的，使得小程序可以做到类原生动画般的体验。

## 立即体验

使用 `worklet` 动画能力时确保以下两项：

- 确保开发者工具右上角 > 详情 > 本地设置里的 `将 JS 编译成 ES5` 选项被勾选上 (代码包体积会少量增加)
- worklet 动画相关接口仅在 `Skyline` 渲染模式下才能使用

![](../../_assets/worklet-demo-bc25905c-a45de565a491.png)

首先，我们需要了解一些相关概念。

## 概念一： `worklet` 函数

一种声明在开发者代码中，可运行在 `JS` 线程或 `UI` 线程的函数，函数体顶部有 `'worklet'` 指令声明。

### worklet 函数定义

```js
function someWorklet(greeting) {
  'worklet';
  console.log(greeting);
}

// 运行在 JS 线程
someWorklet('hello') // print: hello

// 运行在 UI 线程
wx.worklet.runOnUI(someWorklet)('hello') // print: [ui] hello
```

### worklet 函数间相互调用

```js
const name = 'skyline'

function anotherWorklet() {
  'worklet';
  return 'hello ' + name;
}

// worklet 函数间可互相调用
function someWorklet() {
  'worklet';
  const greeting = anotherWorklet();
  console.log('another worklet says ', greeting);
}

wx.worklet.runOnUI(someWorklet)() // print: [ui] another worklet says hello skyline
```

### 从 UI 线程调回到 JS 线程

```js
function someFunc(greeting) {
  console.log('hello', greeting);
}

function someWorklet() {
  'worklet'
  // 访问非 worklet 函数时，需使用 runOnJS
  // someFunc 运行在 JS 线程
  runOnJS(someFunc)('skyline')
}

wx.worklet.runOnUI(someWorklet)() // print: hello skyline
```

## 概念二：共享变量

在 `JS` 线程创建，可在两个线程间同步的变量。

```js
const { shared, runOnUI } = wx.worklet

const offset = shared(0)
function someWorklet() {
  'worklet'
  console.log(offset.value) // print: 1
  // 在 UI 线程修改
  offset.value = 2
  console.log(offset.value) // print: 2
}
// 在 JS 线程修改
offset.value = 1

runOnUI(someWorklet)()
```

由 `shared` 函数创建的变量，我们称为 `sharedValue` 共享变量。用法上可类比 `vue3` 中的 `ref` ，对它的读写都需要通过 `.value` 属性，但需注意的是它们并不是一个概念。 `sharedValue` 的用途主要如下。

### 跨线程共享数据

由 `worklet` 函数捕获的外部变量，实际上会被序列化后生成在 `UI` 线程的拷贝，如下代码中， `someWorklet` 捕获了 `obj` 变量，尽管我们修改了 `obj` 的 `name` 属性，但在 `someWorklet` 声明的位置， `obj` 已经被序列化发送到了 `UI` 线程，因此后续的修改是无法同步的。

```js
const obj = { name: 'skyline'}
function someWorklet() {
  'worklet'
  console.log(obj.name) // 输出的仍旧是 skyline
}
obj.name = 'change name'

wx.worklet.runOnUI(someWorklet)()
```

`sharedValue` 就是用来在线程间同步状态变化的变量。

```js
const { shared, runOnUI } = wx.worklet

const offset = shared(0)
function someWorklet() {
  'worklet'
  console.log(offset.value) // 输出的是新值 1
}
offset.value = 1

runOnUI(someWorklet)()
```

### 驱动动画

`worklet` 函数和共享变量就是用来解决交互动画问题的。相关接口 `applyAnimatedStyle` 可通过页面/组件实例访问， [接口文档参考](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html#applyAnimatedStyle-%E5%8F%82%E6%95%B0%E5%AE%9A%E4%B9%89) 。

```html
<view id="moved-box"></view>
<view id="btn" bind:tap="tap">点击驱动小球移动</view>
```

```js
Page({
  onLoad() {
    const offset = wx.worklet.shared(0)
    this.applyAnimatedStyle('#moved-box', () => {
      'worklet';
      return {
        transform: `translateX(${offset.value}px)`
      }
    })
    this._offset = offset
  },
  tap() {
    // 点击时修改 sharedValue 值，驱动小球移动
    this._offset.value = Math.random()
  }
})
```

当点击按钮 `#btn` 时，我们用随机数给 `offset` 进行赋值，小球会随之移动。

`applyAnimatedStyle` 接口的第二个参数 `updater` 为一个 `worklet` 函数，其捕获了共享变量 `offset` ，当 `offset` 的值变化时， `updater` 会重新执行，并将返回的新 `styleObject` 应用到选中节点上。

当然，光看这个例子，跟用 `setData` 看好像没有什么区别。但当 `worklet` 动画和 [手势](./gesture.md) 结合时，就产生了质变。

## 示例用法

### 手势处理

```html
<pan-gesture-handler onGestureEvent="handlepan">
  <view class="circle"></view>
</pan-gesture-handler>
```

```js
Page({
  onLoad() {
    const offset = wx.worklet.shared(0);
    this.applyAnimatedStyle('.circle', () => {
      'worklet';
      return {
        transform: `translateX(${offset.value}px)`
      };
    });
    this._offset = offset;
  },
  handlepan(evt) {
    'worklet';
    if (evt.state === GestureState.ACTIVE) {
      this._offset.value += evt.deltaX;
    }
  }
});
```

当手指在 `circle` 节点上移动时，会产生平滑的拖动效果。 `handlepan` 回调触发在 `UI` 线程，同时我们修改了 `offset` 的值，会在 `UI` 线程产生动画，不必再绕回到 `JS` 线程。

[查看更多手势处理的示例代码](./gesture.md#%E4%BD%BF%E7%94%A8%E6%96%B9%E6%B3%95)

### 自定义动画曲线

```html
<view id="moved-box"></view>
<view id="btn" bind:tap="tap">点击驱动小球移动</view>
```

```js
const { shared, Easing, timing } = wx.worklet
Page({
  onLoad() {
    const offset = shared(0)
    this.applyAnimatedStyle('#moved-box', () => {
      'worklet';
      return {
        transform: `translateX(${offset.value}px)`
      }
    })
    this._offset = offset
  },
  tap() {
    /**
     * 目标值 300
     * 动画时长 200ms
     * 动画曲线 Easing.ease
     */
    this._offset.value = timing(300, {
      duration: 200,
      easing: Easing.ease
    })
  }
})
```

内置如 `timing` 、 `spring` 等常见动画方式的封装方法，开发者可自定义动画曲线，同时可对不同的动画类型进行组合、重复，形成交织动画。

[查看更多不同动画类型用法](https://developers.weixin.qq.com/s/rw97Xymm72MN)

[查看更多缓动函数的示例代码](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.Easing.html)

### 相关接口

- 基础类型 [shared](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/base/worklet.shared.html) 、 [derived](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/base/worklet.derived.html) 、 [cancelAnimation](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/base/worklet.cancelAnimation.html)
- 工具函数 [runOnUI](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/tool-function/worklet.runOnUI.html) 、 [runOnJS](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/tool-function/worklet.runOnJS.html)
- 动画类型 [timing](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.timing.html) 、 [spring](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.spring.html) 、 [decay](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.decay.html)
- 组合动画 [sequence](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/combine-animation/worklet.sequence.html) 、 [repeat](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/combine-animation/worklet.repeat.html) 、 [delay](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/combine-animation/worklet.delay.html)
- 缓动函数 [Easing](https://developers.weixin.qq.com/miniprogram/dev/api/ui/worklet/animation/worklet.Easing.html)
- 页面实例方法 [applyAnimatedStyle](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html#applyAnimatedStyle-%E5%8F%82%E6%95%B0%E5%AE%9A%E4%B9%89) 、 [clearAniamtedStyle](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Component.html#clearAnimatedStyle-%E5%8F%82%E6%95%B0%E5%AE%9A%E4%B9%89)

### 注意事项

`worklet` 函数内部有一些调用上的限制需要留意

1. 页面/组件实例中定义的 `worklet` 类型回调函数，内部访问 `wx` 上的接口，可按如下方式，通过 `runOnJS` 调回到 `JS` 线程。
2. `worklet` 函数引用的外部变量，对象类型将被 `Object.freeze` 冻结，使用时需直接访问对象上具体的属性。

```html
<tap-gesture-handler onGestureEvent="handleTap">
  <view class="circle" >showModal</view>
</tap-gesture-handler>
```

```js
const { runOnJS, timing } = wx.worklet
Page({
  data: {
    msg: 'Skyline'
  },
  onLoad() {
    const toValue = 100
    const showModal = this.showModal.bind(this)
    timing(toValue, { duration: 300 }, () => {
      'worklet'
      runOnJS(showModal)(msg)
    })
  },
  handleTap() {
    'worklet'

    // 非常重要！！！
    // const { msg } = this.data
    // 通过解构 this.data 访问 msg，此时 this.data 将被 Object.freeze 冻结，会导致 setData 无法生效
    // 而通过 this.data.msg 则不会冻结 this.data
    const msg = `hello ${this.data.msg}`

    // 非常重要！！！
    // Page method 必须通过 this.methodName.bind(this) 访问
    const showModal = this.showModal.bind(this)

    // 场景一：返回 JS 线程
    runOnJS(showModal)(msg)

    // 场景二：动画完成回调里返回 JS 线程
    const toValue = 100
    timing(toValue, { duration: 300 }, () => {
      'worklet'
      runOnJS(showModal)(msg)
    })

    // 场景三：调用其它 worklet 函数
    this.doSomething()
  },
  doSomething() {
    'worklet'
  },
  showModal(msg) {
    wx.showModal({
      title: msg // title: hello skyline
    })
  },
})
```
