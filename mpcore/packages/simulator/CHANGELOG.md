# @mpcore/simulator

## 0.0.2

### Patch Changes

- 🐛 **为宿主 `wx` 对象补充异步 storage API，包括 `setStorage/getStorage/removeStorage/clearStorage`。** [`6e0b129`](https://github.com/weapp-vite/weapp-vite/commit/6e0b12939ec90d52a9bcefa01f0c1eb1834a945b) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `setBackgroundTextStyle` 宿主能力，支持页面默认背景文本样式继承、运行时更新以及非法参数失败分支，并暴露 session 级背景样式断言。** [`dcaf280`](https://github.com/weapp-vite/weapp-vite/commit/dcaf280dc1dccb7fd6b2063c91656314e38aff68) by @sonofmagic

- 🐛 **为 headless testing 页面句柄补充 `waitForTextGone()`，方便对异步消失内容做断言与等待。** [`6d98869`](https://github.com/weapp-vite/weapp-vite/commit/6d988699a3342ccca30dc3b2c3ae7fb8603036de) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `showLoading/hideLoading`，并增加 loading 状态快照能力。** [`eda3ae8`](https://github.com/weapp-vite/weapp-vite/commit/eda3ae80f895aa0a63847580664783c4b03cc2cb) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `setBackgroundColor` 宿主能力，支持页面默认背景颜色继承、运行时更新，并将背景颜色与文本样式统一暴露为 session 级页面背景快照。** [`006c677`](https://github.com/weapp-vite/weapp-vite/commit/006c6774bbec118d562af58932fc8207a727d1cf) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 tabBar item 状态宿主能力，支持 red dot 与 badge 的显示、隐藏、更新，并暴露 session 级 tabBar snapshot 用于 runtime/browser 断言。** [`3c71135`](https://github.com/weapp-vite/weapp-vite/commit/3c711351d759ca6d3eba51d0c6984c8316a3cedf) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.setNavigationBarTitle` 宿主能力，支持页面默认导航栏标题初始化、运行时更新以及 session 级标题断言。** [`8ea2f56`](https://github.com/weapp-vite/weapp-vite/commit/8ea2f5619be60c119b9ca5679d670971309dd018) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getStorageInfoSync/getStorageInfo`，支持读取 storage keys 与容量信息。** [`df99cf6`](https://github.com/weapp-vite/weapp-vite/commit/df99cf633daf33bd8e1be39237a77638ed0e08d4) by @sonofmagic

- 🐛 **为 headless 与 browser runtime 补充 `wx.nextTick` 宿主能力，并增加对应时序回归测试。** [`d94f3e4`](https://github.com/weapp-vite/weapp-vite/commit/d94f3e44c0cf2c4538e49afea592d0eb15f110de) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getSystemInfoSync/getSystemInfo`，并让结果跟随 `triggerResize()` 更新。** [`ff5b79c`](https://github.com/weapp-vite/weapp-vite/commit/ff5b79cfa3bf5c746db569aab9d6710c0e44e39c) by @sonofmagic

- 🐛 **为 headless testing 节点句柄补充 `tap()` 交互能力，并修复相关类型定义，使测试桥可以直接从渲染节点触发事件并稳定读取 `dataset`。** [`052914b`](https://github.com/weapp-vite/weapp-vite/commit/052914bc3fb6cd7fdf3eccd4befb156690ad42f6) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getWindowInfo/getAppBaseInfo/canIUse`，并让窗口信息跟随 `triggerResize()` 更新。** [`7f9c289`](https://github.com/weapp-vite/weapp-vite/commit/7f9c289dcf5e322d57a9dfe0367af802659ce2fc) by @sonofmagic

- 🐛 **为 headless testing 页面句柄补充 `waitForData()`，支持对异步 `setData` 结果进行值匹配与谓词等待。** [`f1827dd`](https://github.com/weapp-vite/weapp-vite/commit/f1827dde8691339632db90f852cb792bdefd3748) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getLaunchOptionsSync/getEnterOptionsSync`，并与现有冷启动入口信息保持一致。** [`b08c1f4`](https://github.com/weapp-vite/weapp-vite/commit/b08c1f42abab22f202bb8f2d15a25083a16349a2) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `getNetworkType` 与 `on/offNetworkStatusChange` 宿主能力，并允许通过 session 在 headless/browser 测试里切换网络状态。** [`84997c1`](https://github.com/weapp-vite/weapp-vite/commit/84997c1a90fc4225d33c2a0abd8dd3d0046d2658) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加分享菜单宿主能力，支持 `showShareMenu/updateShareMenu/hideShareMenu` 状态切换，并暴露 session 级分享菜单快照用于 runtime/browser 断言。** [`7175e14`](https://github.com/weapp-vite/weapp-vite/commit/7175e147897655a8e35af71295ae34cdcb5b7889) by @sonofmagic

- 🐛 **为 headless testing 节点句柄补充 `input()`、`change()`、`blur()` 等表单交互辅助方法，简化对输入类事件的测试驱动。** [`ef888b4`](https://github.com/weapp-vite/weapp-vite/commit/ef888b44d8bc57ec2e61b21e5433cd4d12ab9d53) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加导航栏颜色与 loading 宿主能力，支持页面默认导航栏配置继承、运行时更新，以及 session 级导航栏状态断言。** [`717d067`](https://github.com/weapp-vite/weapp-vite/commit/717d067dc1575524c4fbd3bbbfb50e117be722e2) by @sonofmagic

- 🐛 **为 headless testing 节点句柄补充通用 `trigger(eventName)` 事件触发能力，支持在渲染节点上直接驱动 `input` 等绑定事件。** [`ce60645`](https://github.com/weapp-vite/weapp-vite/commit/ce6064557d3cbe30d21b61cc8fb8de5c78e587fd) by @sonofmagic

- 🐛 **为 headless testing 会话句柄补充 `waitForCurrentPage()`，支持对异步导航结果进行轮询等待。** [`d903ba3`](https://github.com/weapp-vite/weapp-vite/commit/d903ba30ae93f457604b78a12bfbd6d141df5b4f) by @sonofmagic

- 🐛 **增强 `wx.request` mock，支持延迟响应与 `RequestTask.abort()` 语义。** [`0438161`](https://github.com/weapp-vite/weapp-vite/commit/0438161f3d83c1384a5b475eaf93910a44796065) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.showActionSheet` 宿主能力，支持默认选中第一项、按次 mock 取消或指定选项，并暴露 action sheet 调用日志用于 runtime/browser 断言。** [`531a2c7`](https://github.com/weapp-vite/weapp-vite/commit/531a2c725b79326946c267273779af3144840a2d) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `wx.showModal` 宿主能力，支持默认确认返回、按次 mock 弹窗结果，并暴露 modal 调用日志用于 runtime/browser 断言。** [`7fc105c`](https://github.com/weapp-vite/weapp-vite/commit/7fc105c2bba77c2ed3817468a8bf53f91416183e) by @sonofmagic

- 🐛 **为宿主 `wx` 对象补充 `getMenuButtonBoundingClientRect()`，并让结果基于当前窗口尺寸派生。** [`f4e396b`](https://github.com/weapp-vite/weapp-vite/commit/f4e396b5df5cbee66f6d08b3abed80526dd7ded4) by @sonofmagic

- 🐛 **为 `@mpcore/simulator` 增加 `showTabBar/hideTabBar` 宿主能力，并暴露 session 级 tabBar 可见状态用于 runtime/browser 断言。** [`c83a184`](https://github.com/weapp-vite/weapp-vite/commit/c83a184d6e161b915212aa62fd47ed83676e47be) by @sonofmagic

- 🐛 **为 headless testing 页面句柄补充 `waitForSelector()` 与 `waitForText()`，简化对异步渲染内容的轮询等待。** [`d2d6aa7`](https://github.com/weapp-vite/weapp-vite/commit/d2d6aa7bb25a7c788a2db89c51f43c90b8ca4fb4) by @sonofmagic

## 0.0.1

### Patch Changes

- 🐛 **补齐 simulator 与微信开发者工具在页面导航、生命周期、页面事件与应用启动参数上的关键行为对齐，并为这些运行时语义补充稳定的测试覆盖。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic

- 🐛 **增强 `@mpcore/simulator` 的宿主能力与浏览器控制台体验：补齐 `triggerEvent` 在组件宿主链上的冒泡/截断行为，新增 `showToast`、`setStorageSync/getStorageSync` 与基于内存路由表的 `wx.request` mock 通道，并让 web demo 的代码面板统一使用 Shiki 高亮展示。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic

- 🐛 **补齐浏览器模拟器对高频 WXML 结构指令与交互细节的支持，新增 `wx:if` / `wx:elif` / `wx:else`、`wx:for`、`catchtap` 等能力，并修正组件属性在循环场景下的同步更新与 demo 预览点击解析。** [#355](https://github.com/weapp-vite/weapp-vite/pull/355) by @sonofmagic
