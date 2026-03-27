# @mpcore/simulator

`@mpcore/simulator` 是 `mpcore` 生态中的 headless 小程序运行时与测试内核。

当前主要能力：

- 直接执行构建后的小程序产物
- 提供 `App/Page/Component/getApp/getCurrentPages/wx` 的最小宿主模拟
- 已支持部分常用宿主 API，如导航、request mock、sync/async storage 与 storage info、toast、loading、launch/enter options、system info、window/app base info、menu button rect、`wx.canIUse`、`wx.nextTick`
- 提供面向 e2e/runtime 断言的页面启动、重启与 WXML 查询能力
- 提供测试节点句柄上的 `tap()`、`trigger()`、`input()`、`change()`、`blur()` 交互辅助方法
- 提供测试页面/会话句柄上的 `waitForSelector()`、`waitForText()`、`waitForTextGone()`、`waitForData()`、`waitForCurrentPage()` 等轮询等待方法
