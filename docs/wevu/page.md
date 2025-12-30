# 定义页面（defineComponent）

`defineComponent()` 会使用原生 `Component()` 完成注册（在微信小程序中可同时用于页面/组件），并在初始化阶段同步调用 `setup()`；其返回对象会合并到实例，模板可直接使用（`ref` 在模板中自动解包）。

基础示例

```ts
import { computed, defineComponent, onHide, onShow, reactive } from 'wevu'

defineComponent({
  setup() {
    const state = reactive({ count: 0, double: computed(() => state.count * 2) })
    function increment() {
      state.count++
    }
    onShow(() => console.log('show'))
    onHide(() => console.log('hide'))
    return { state, increment }
  }
})
```

模板示例（wxml）

```xml
<button bindtap="increment">
  Count: {{ state.count }}, Double: {{ state.double }}
</button>
```

执行与顺序

- `setup()` 在页面初始化阶段同步调用（组件 `attached` / 页面 `onLoad`）。
- 若依赖“由上到下”的 `setup()` 顺序，使用“页面组件”更稳妥（见 `wevu/page-component.md`）。
- `setup(props, context)`：`props` 来自小程序 `properties`（页面通常为空对象）；`context` 暴露 `instance/runtime/watch/bindModel` 等运行时能力。

访问实例（替代 this）

- `this` 在 `setup()` 中不可用；如确需访问原生页面实例，可使用 `getCurrentInstance()` 获取当前实例引用（请仅在 `setup()` 同步阶段读取与调用）。

```ts
import { defineComponent, getCurrentInstance } from 'wevu'

defineComponent({
  setup() {
    const page = getCurrentInstance() // 等价于原生页面实例
    page?.setData?.({ ready: true }) // 示例：谨慎使用
    return {}
  }
})
```

生命周期与能力声明

- 生命周期注册需在 `setup()` 内同步调用，如 `onShow/onHide/onUnload/onReady/onPageScroll`。
- 为了避免无效监听或性能损耗，小程序部分“页面事件”只有在你**定义了对应页面方法**时才会触发（例如 `onPageScroll`、分享/朋友圈/收藏等）；wevu 也默认遵守这一点。
- 如果你希望只在 `setup()` 里使用 wevu hook（不额外写 `onXXX` 方法），可以使用 `features` 显式开启（例如 `features: { enableOnPageScroll: true }`、`features: { enableOnShareTimeline: true }`），由 wevu 注入对应页面方法以开启派发。

示例：声明滚动监听

```ts
import { defineComponent, onPageScroll } from 'wevu'

defineComponent({
  // 推荐：用 features.enableOnPageScroll 开启派发，无需额外写 onPageScroll()
  features: { enableOnPageScroll: true },
  setup() {
    onPageScroll(({ scrollTop }) => console.log('scrollTop:', scrollTop))
  },
})
```

自动注册

- `defineComponent()` 执行时会立即调用原生 `Component()` 完成注册。
- 请确保同一文件只调用一次定义，否则会触发原生“重复注册”的限制；需要多个页面时请拆分文件或按条件决定是否执行。
