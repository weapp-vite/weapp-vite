# @mpcore/simulator

`@mpcore/simulator` 是 `mpcore` 生态中的 headless 小程序运行时与测试内核。

当前主要能力：

- 直接执行构建后的小程序产物
- 提供 `App/Page/Component/getApp/getCurrentPages/wx` 的最小宿主模拟
- 已支持部分常用宿主 API，如导航、request mock（含 delay / abort）、sync/async storage 与 storage info、toast、loading、showModal（含默认确认与可编程 mock 返回）、showActionSheet（含默认选择与可编程取消/选项返回）、`showShareMenu/updateShareMenu/hideShareMenu`、`showTabBar/hideTabBar/showTabBarRedDot/hideTabBarRedDot/setTabBarBadge/removeTabBarBadge`、`setBackgroundTextStyle/setBackgroundColor`、getNetworkType/onNetworkStatusChange/offNetworkStatusChange、`setNavigationBarTitle/setNavigationBarColor/showNavigationBarLoading/hideNavigationBarLoading`、launch/enter options、system info、window/app base info、menu button rect、`wx.canIUse`、`wx.nextTick`
- 提供面向 e2e/runtime 断言的页面启动、重启与 WXML 查询能力
- 支持本地 `pluginRoot` 的 `requirePlugin`、`plugin://` 公开组件与插件页面导航
- 提供测试节点句柄上的 `tap()`、`trigger()`、`input()`、`change()`、`blur()` 交互辅助方法
- 提供测试页面/会话句柄上的 `waitForSelector()`、`waitForText()`、`waitForTextGone()`、`waitForData()`、`waitForCurrentPage()` 等轮询等待方法
- 测试会话句柄提供与 `miniprogram-automator` 对齐的 `toolInfo()`，headless provider 返回稳定的 simulator 标识
- 通过共享 `RuntimeKernel` 管理 artifact、独立执行 realm、timer、diagnostics 与平台适配边界
- `close()` 会清理页面栈、组件 scope、observer、timer、事件和模块缓存，并使旧页面/节点 handle 失效

编写页面和组件单测时优先使用上层 `@mpcore/test`；直接使用本包适合实现 provider、调试桥或更低层运行时断言。
