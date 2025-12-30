# Page hooks ↔ 原生 Page 回调对应表

wevu 的页面 hooks 对齐 `WechatMiniprogram.Page.ILifetime`（参考 `miniprogram-api-typings` 与官方 Page 文档）。

## 重要：按需派发 / 需要显式定义页面方法

小程序的部分页面事件具有“按需派发”特性：**只有你在页面 options 中定义了对应的 `onXXX` 方法，渲染层才会把事件派发到逻辑层**（例如 `onPageScroll`、分享/朋友圈/收藏等）。

因此 wevu 对“按需派发”的页面事件策略是：

- 只有当你在 `defineComponent({ ... })` 中显式定义了对应的原生页面方法时，wevu 才会桥接 `setup()` 里注册的同名 hook。
- 对于滚动/下拉/触底等高频或可选事件：若你仅想使用 wevu hook（逻辑写在 `setup()`），可以通过 `features` 显式开启注入来开启派发；当存在 wevu hook 时，wevu 会优先执行 hook，并尽量避免再执行你的原生方法。

## 对应关系（1:1）

| wevu hook           | 原生 Page 回调               | wevu 是否默认注入 | 需要的启用方式（2 选 1）                                               | 说明                                                                                         |
| ------------------- | ---------------------------- | ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `onLoad`            | `onLoad(query)`              | 是                | 无                                                                     | 页面加载（一次）。wevu 会在运行时挂载后派发 hook。                                           |
| `onShow`            | `onShow()`                   | 是                | 无                                                                     | 页面显示。                                                                                   |
| `onReady`           | `onReady()`                  | 是                | 无                                                                     | 首次渲染完成。                                                                               |
| `onHide`            | `onHide()`                   | 是                | 无                                                                     | 页面隐藏。                                                                                   |
| `onUnload`          | `onUnload()`                 | 是                | 无                                                                     | 页面卸载（wevu 会在 teardown 时派发）。                                                      |
| `onRouteDone`       | `onRouteDone()`              | 否                | 定义 `onRouteDone()` 或 `features.enableOnRouteDone: true`             | 路由动画完成（按需派发）。                                                                   |
| `onPullDownRefresh` | `onPullDownRefresh()`        | 否                | 定义 `onPullDownRefresh()` 或 `features.enableOnPullDownRefresh: true` | 下拉刷新（按需派发；且需在页面配置开启下拉刷新）。                                           |
| `onReachBottom`     | `onReachBottom()`            | 否                | 定义 `onReachBottom()` 或 `features.enableOnReachBottom: true`         | 触底（按需派发）。                                                                           |
| `onPageScroll`      | `onPageScroll(options)`      | 否                | 定义 `onPageScroll()` 或 `features.enableOnPageScroll: true`           | 滚动（高频；按需派发）。                                                                     |
| `onTabItemTap`      | `onTabItemTap(options)`      | 否                | 定义 `onTabItemTap()` 或 `features.enableOnTabItemTap: true`           | Tab 点击（按需派发）。                                                                       |
| `onResize`          | `onResize(options)`          | 否                | 定义 `onResize()` 或 `features.enableOnResize: true`                   | 窗口尺寸变化（按需派发）。                                                                   |
| `onShareAppMessage` | `onShareAppMessage(options)` | 否                | 定义 `onShareAppMessage()` 或 `features.enableOnShareAppMessage: true` | 分享给朋友（**需要定义才会显示菜单“转发”并触发**；返回值型，wevu hook 为单实例）。           |
| `onShareTimeline`   | `onShareTimeline()`          | 否                | 定义 `onShareTimeline()` 或 `features.enableOnShareTimeline: true`     | 分享到朋友圈（**需要定义才会显示菜单“分享到朋友圈”并触发**；返回值型，wevu hook 为单实例）。 |
| `onAddToFavorites`  | `onAddToFavorites(options)`  | 否                | 定义 `onAddToFavorites()` 或 `features.enableOnAddToFavorites: true`   | 收藏（按需派发；返回值型，wevu hook 为单实例）。                                             |
| `onSaveExitState`   | `onSaveExitState()`          | 否                | 定义 `onSaveExitState()` 或 `features.enableOnSaveExitState: true`     | 退出状态保存（按需派发；返回值型，wevu hook 为单实例）。                                     |

## Vue 风格别名（语义映射）

| wevu hook       | 映射到的页面回调 |
| --------------- | ---------------- |
| `onMounted`     | `onReady`        |
| `onUnmounted`   | `onUnload`       |
| `onActivated`   | `onShow`         |
| `onDeactivated` | `onHide`         |
