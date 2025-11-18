# 定义页面（definePage）

`definePage()` 是原生 `Page()` 的超集：在 `onLoad` 阶段调用同步 `setup()`，其返回对象会合并到页面实例，模板可直接使用（`ref` 在模板中自动解包）。

基础示例

```ts
import { computed, definePage, onHide, onShow, reactive } from 'wevu'

definePage({
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

- `setup()` 在 `onLoad` 时机调用；初始首帧可能出现 `undefined`，小程序模板已做兼容。
- 页面 `setup()` 晚于所有子组件的 `attached` 执行；若依赖“由上到下”的 `setup()` 序，使用“页面组件”更稳妥。
- `setup(query, context)`：`query` 为页面参数；`context` 暴露 `is/route/exitState/getOpenerEventChannel` 等必要属性。

访问实例（替代 this）

- `this` 在 `setup()` 中不可用；如确需访问原生页面实例，可使用 `getCurrentInstance()` 获取当前实例引用（请仅在 `setup()` 同步阶段读取与调用）。

```ts
import { definePage, getCurrentInstance } from 'wevu'

definePage({
  setup() {
    const page = getCurrentInstance() // 等价于原生页面实例
    page?.setData?.({ ready: true }) // 示例：谨慎使用
    return {}
  }
})
```

生命周期与能力声明

- 生命周期注册需在 `setup()` 内同步调用，如 `onShow/onHide/onUnload/onReady/onPageScroll`。
- 为避免无效监听或性能损耗，部分能力需要通过 `definePage` 的第二个参数提前声明：
  - 滚动监听：`{ listenPageScroll: true }` 才能在 `setup()` 中注册 `onPageScroll()`。
  - 分享相关：转发/朋友圈/收藏/离开保存等能力需显式声明后，才能在 `setup()` 中注册对应的 `onShare*`/`onSaveExitState()` 钩子（且通常仅允许单一监听）。

示例：声明滚动监听

```ts
import { definePage, onPageScroll } from 'wevu'

definePage(
  {
    setup() {
      onPageScroll(({ scrollTop }) => console.log('scrollTop:', scrollTop))
    }
  },
  { listenPageScroll: true }
)
```

自动注册与 `.mount()`

- `definePage()` 执行时会立即调用原生 `Page()` 完成注册；返回对象仅保留 `.mount()` 以兼容旧代码，现在它是空操作，可忽略。
- 请确保同一文件只调用一次 `definePage()`，否则仍会触发原生“重复 Page()`”的限制。需要多个页面时请拆分文件或按条件决定是否执行。
