# 页面组件

小程序支持将组件作为页面使用（本文称“页面组件”）。定义方式与普通组件一致，受小程序“页面组件”规则约束。

要点

- `setup()` 顺序：页面组件的 `setup()` 按组件层级自顶向下执行，不会晚于其子组件，可用于需要严格顺序的场景。
- 生命周期整合：wevu 提供一族 `onXXX` 注册函数，对原生 `lifetimes/pageLifetimes/methods` 做了适度整合。
- `onLoad()` 仅对“页面组件”有效；在普通页面中使用会抛错，在普通组件中无效果。
- 对于 `onPageScroll/onShareTimeline/...` 等按需派发的页面事件：若未手写原生 `onXXX`，可通过 `features.enableOnXxx` 让 wevu 在注册阶段注入对应页面方法（见 `wevu/page-hooks-mapping.md`）。

生命周期对应（节选）

- `lifetimes.attached -> setup`
- `lifetimes.ready -> onReady`
- `pageLifetimes.show -> onShow`
- `methods.onUnload -> onUnload`
- 其余钩子如 `onRouteDone/onPullDownRefresh/onReachBottom/onPageScroll/onResize/onTabItemTap/onSaveExitState` 等以同名 `onXXX` 注册。
