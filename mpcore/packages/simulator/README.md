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
- 提供原生形状的 `wx.onAppShow/offAppShow/onAppHide/offAppHide`；Node/browser session 与测试句柄通过 `triggerAppShow(options?)`、`triggerAppHide({ reason })` 显式驱动应用前后台事件，普通页面导航不会伪造应用切换
- 测试入口 `launch({ configureSession })` 会在执行 `app.js` 前等待配置完成，可安装测试宿主能力；配置失败会关闭会话，默认 request 仍受既有 mock / strict mock 策略约束，不自动开放真实网络
- 通过共享 `RuntimeKernel` 管理 artifact、独立执行 realm、timer、diagnostics 与平台适配边界
- `close()` 会清理页面栈、组件 scope、observer、timer、事件和模块缓存，并使旧页面/节点 handle 失效

编写页面和组件单测时优先使用上层 `@mpcore/test`；直接使用本包适合实现 provider、调试桥或更低层运行时断言。

应用首次启动只执行一次 `onLaunch`，并在首页加载前发送应用显示事件。后续 `triggerAppShow` 更新 enter options，不改写 launch options；隐藏原因显式限定为 `0 | 1 | 2 | 3`。关闭会话会清理应用事件监听，不合成额外的隐藏事件。这里定义的是可测试的 simulator 行为，不代表已验证真实微信 IDE 中 App hook 与 `wx` 监听器之间的相对调用顺序。

浏览器会话的 `renderCurrentPage().styles` 提供当前页面的 `cssText`、项目相对 `dependencies` 和 `appWxssEnabled`，Web demo 将该结果挂载到页面预览的 Shadow DOM。解析器读取 `app.wxss`、页面 `.wxss` 及递归本地 `@import`，保留导入位置和全局在前、页面在后的层叠顺序；页面 `.wxss` 内联的全局样式快照也会动态加载，并保留其后页面自有样式的覆盖优先级。文件修改后重新渲染会读取最新内容，包括只更新样式的场景，不重建页面或 App 实例。

此入口只负责页面样式依赖和 CSS 兼容声明，不实现嵌套组件的完整样式隔离、类名前缀转换或 `rpx` 布局换算。Component 页面的 `page-isolated`、`page-strong-isolated`、`page-apply-shared`、`page-shared` 禁用隐式 `app.wxss`，页面仍可显式导入样式；最终页面 JSON 的 `styleIsolation` 优先于 JS 定义，JSON 未提供该值时才保留 JS 选项。普通 `Page` 注册不应用组件隔离选项，普通 `isolated` 也不等同于 `page-isolated`。缺失依赖、循环导入、非法 CSS 和不支持的导入会抛出明确错误。支持带媒体条件的本地导入；远程导入及 `layer` / `supports` 导入条件不受支持，也不会触发外部请求。
