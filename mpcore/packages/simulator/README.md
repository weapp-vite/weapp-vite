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
- Node/browser session 的 `reloadPageDefinition(route)` 显式更新已加载页面的入口定义，返回源码字节是否变化；测试会话句柄返回 `Promise<boolean>`。它保留 App、当前页面和共享依赖缓存，不自动导航；需要新页面时再调用 `reLaunch()`。失败会恢复模块缓存及注册表，但不会撤销业务脚本已经执行的任意副作用。普通导航不自动重载脚本。
- Node/browser session 与测试 `launch()` 接受 `compiledTemplatePaths`，声明相对小程序根目录的编译 WXML 输出。创建会话时冻结这些模板及递归 `import/include` 依赖，形成全局注册图；原生模板引用同一依赖时也读取该依赖的注册版本，图外的原生 WXML 仍实时读取。普通查询、数据更新、脚本重载和导航都不会提交新模板。`reloadTemplates()` 显式提交整批新版本，返回是否变化，测试句柄返回 `Promise<boolean>`；缺失任意模板或依赖路径超出小程序根目录时保留整批旧版本和 WXS 缓存。成功提交新版本后清除本会话的 WXS 缓存，内联 WXS 随新模板重新加载。它保留当前页面、组件及 App 实例，适合由宿主注册生命周期调用；classic 重启可通过新建会话重新注册模板。
- `disconnect()` 同步开始释放独占运行时并返回可等待的 Promise；并发、重入与后续调用共享关闭结果，关闭失败会保留在该 Promise 中
- 提供原生形状的 `wx.onAppShow/offAppShow/onAppHide/offAppHide`；Node/browser session 与测试句柄通过 `triggerAppShow(options?)`、`triggerAppHide({ reason })` 显式驱动应用前后台事件，普通页面导航不会伪造应用切换
- 测试入口 `launch({ configureSession })` 会在执行 `app.js` 前等待配置完成，可安装测试宿主能力；配置失败会关闭会话，默认 request 仍受既有 mock / strict mock 策略约束，不自动开放真实网络
- 通过共享 `RuntimeKernel` 管理 artifact、独立执行 realm、timer、diagnostics 与平台适配边界
- `close()` 会清理页面栈、组件 scope、observer、timer、事件和模块缓存，并使旧页面/节点 handle 失效；Node/browser 中页面 `onUnload` 或组件 `detached` 抛错后仍继续清理其余组件、关系和调度器，最后保留并抛出首个异常，重复关闭不会重复卸载。普通导航沿用遇错即停止的卸载边界，不启用关闭专用的尽力清理策略。

编写页面和组件单测时优先使用上层 `@mpcore/test`；直接使用本包适合实现 provider、调试桥或更低层运行时断言。

应用首次启动只执行一次 `onLaunch`，并在首页加载前发送应用显示事件。后续 `triggerAppShow` 更新 enter options，不改写 launch options；隐藏原因显式限定为 `0 | 1 | 2 | 3`。关闭会话会清理应用事件监听，不合成额外的隐藏事件。这里定义的是可测试的 simulator 行为，不代表已验证真实微信 IDE 中 App hook 与 `wx` 监听器之间的相对调用顺序。

测试会话的 `send(method, params?, { timeout }?)` 提供协议子集：`Tool.getInfo`、`App.getCurrentPage`、`App.getPageStack`、`App.callFunction`、`App.callWxMethod`。页面响应沿用 `{ pageId, path, query }`，调用响应沿用 `{ result }`，复用同一运行时与页面身份；关闭会话会拒绝尚未完成的协议请求。其他协议会抛出带 `code: 'HEADLESS_PROTOCOL_UNSUPPORTED'` 与 `method` 的错误。

`CDP()` 保留 `enable`、`sendCommand`、`listProtocol`、`onEvent` 的类型形状。当前 headless 后端不提供 CDP：启用和命令调用会拒绝，`onEvent` 同步抛出不支持错误；这些错误均带 `code: 'HEADLESS_PROTOCOL_UNSUPPORTED'`。不会产生模拟的 V8 协议、堆内存、事件或调试器数据。

节点句柄的 `touchstart`、`touchmove`、`touchend` 以及 `dispatchEvent({ eventName, $?, ...event })` 经过共享事件链调用真实页面或组件处理器，保留 `touches` 和 `changedTouches`。`$` 可选择当前节点内的后代节点。旧字段 `changeTouches` 作为弃用别名接收；两者同时存在时 `changedTouches` 优先，处理器只收到正确字段。

浏览器会话的 `renderCurrentPage().styles` 提供当前页面的 `cssText`、项目相对 `dependencies` 和 `appWxssEnabled`，Web demo 将该结果挂载到页面预览的 Shadow DOM。解析器读取 `app.wxss`、页面 `.wxss` 及递归本地 `@import`，保留导入位置和全局在前、页面在后的层叠顺序；页面 `.wxss` 内联的全局样式快照也会动态加载，并保留其后页面自有样式的覆盖优先级。文件修改后重新渲染会读取最新内容，包括只更新样式的场景，不重建页面或 App 实例。

此入口只负责页面样式依赖和 CSS 兼容声明，不实现嵌套组件的完整样式隔离、类名前缀转换或 `rpx` 布局换算。Component 页面的 `page-isolated`、`page-strong-isolated`、`page-apply-shared`、`page-shared` 禁用隐式 `app.wxss`，页面仍可显式导入样式；最终页面 JSON 的 `styleIsolation` 优先于 JS 定义，JSON 未提供该值时才保留 JS 选项。普通 `Page` 注册不应用组件隔离选项，普通 `isolated` 也不等同于 `page-isolated`。缺失依赖、循环导入、非法 CSS 和不支持的导入会抛出明确错误。支持带媒体条件的本地导入；远程导入及 `layer` / `supports` 导入条件不受支持，也不会触发外部请求。

## 挂载期属性同步

Component 页面及普通组件的 `attached` 内调用 `setData` 时，Node/browser 宿主在调用返回前同步后代属性，包括未投影插槽声明和本次 `wx:if` 新建的子组件。同步绑定阶段不提前派发 `attached`、`detached` 或 `ready`；生命周期回到外层挂载事务处理，避免卸载回调中的写入重复触发卸载。

同一父级写入对每个实例只消费一次，属性 observer 对自身值的修正不会被重入渲染反复覆盖；修正产生的后代属性更新先于本组件对应的 observer。以上边界已用微信开发者工具 `2.02.2608060`、基础库 `3.17.2` 对照直接子组件、关闭插槽、条件插入、数值修正和卸载写入场景，不扩展为真机或其他基础库的完整兼容承诺。

Node/browser 的挂载期绑定遍历共享页面级写入修订号。子组件 observer 再次更新 owner 时，旧遍历停止消费已复制的兄弟、循环与插槽声明作用域，并按最新数据恢复；构造期间暂缓的同步也会使旧遍历失效。恢复时复用已创建实例，不重复派发挂载生命周期。

构造期 `created` 写入不会跳过初始属性交付。私有模板独立捕获当前修订并完成稳定遍历，保证默认子树先于宿主 `created`、后代属性先于宿主属性 observer；外层过期遍历仍停止消费旧作用域。

挂载、就绪和关系刷新引起的遍历重启使用迭代，有限兄弟批次不会按组件数量累加调用栈。

这里只同步逻辑绑定，不在每次写入时序列化 WXML、收集样式或提交宿主视图。既有异步视图提交与 `setData` 回调完成边界保持不变。

## 路由完成与滚动状态

Node/browser 宿主提供 `BeforeAppRoute`、`BeforePageUnload`、`AppRoute`、`AppRouteDone` 四组 `wx.on/off` 事件；同一次导航共享字符串 `routeEventId`。前置事件发生在隐藏/卸载之前，完成事件等待目标页 ready 和该次宿主提交。模拟器通过显式事件能力标记接入，`SDKVersion` 仍为 `0.0.0`，不代表真实微信基础库或 Skyline 渲染器。

业务代码中的 `wx.navigateTo/redirectTo/reLaunch/navigateBack/switchTab` 在调用时捕获选项与回调，在当前调用栈退出后的宿主任务中提交，不会重入当前 HMR 事务或页面挂载。提交后修改或复用原选项对象，不会改变已提交的导航。

底层 `session` 同名方法仍用于同步驱动；测试会话句柄的导航方法必须 `await`，以真实成功或失败回调完成，而不是立即返回旧页面。Node session 在实际清理完成后通过既有事件接口发送一次 `close` 通知，拒绝所有关联测试句柄中尚未完成的导航等待；直接关闭 `configureSession` 保留的底层 session 同样有效。`tap()` 触发导航后应使用 `waitForCurrentPage()` 等可观察条件等待目标页；同路由重启还须等待新页面身份或业务完成信号，不能仅匹配路径。工作台的选中 scope 跟随实际当前页切换，不把导航请求返回当作切换完成。

浏览器自定义 renderer 的 `onRender` 可以返回 Promise；必须在实际 DOM 提交后 resolve，路由完成和 `setData` 回调才会继续。同步 renderer 可保持原来的返回值，非 Promise 返回值被忽略。Web demo 在更新响应式 revision 后返回 Vue `nextTick()`，等待预览 Shadow DOM 的 watcher 完成。关闭会话或被更新导航取代后，不发布旧的路由完成事件。工作台先初始化候选项目，成功后关闭旧会话再替换预览，防止旧提交确认新项目的 DOM；初始化或目录导入失败时保留当前可用会话。

`scroll-view` 的请求属性与实际位置分开保存。模型按启用的轴裁剪实际位置，内容缩短/移除时重新裁剪；未改变的绑定不会覆盖用户滚动，也不会在内容增长后自动重试。当前可求值的范围限定为 **inline `px` 视口尺寸及一个 `view` 内容盒的显式尺寸**，各轴独立；逻辑分组 `block`、注释和空白不生成内容盒。仅通过 WXSS 指定的尺寸、`rpx/%`、自动布局及多个内容盒等未知几何保守使用零范围，不能作为真实布局位置的证明。浏览器预览能显示 CSS，不等于这个原生状态模型实现了完整浏览器布局；复杂布局仍须在实际浏览器或微信 IDE 中验证。

测试节点与真实预览点击共用原生 tap 分发：保留原始 `target`，逐层更新 `currentTarget`，遵守 `catchtap/catch:tap`，仅在事件到达 `navigator` 时执行其默认导航。一次交互先确定原始页面/组件归属，业务回调中的销毁、重新渲染或同路由重建不将剩余冒泡发送给新实例。测试节点 `tap()` 仍等待异步业务处理并传递结果或错误；导航的原生默认动作不等待异步业务 Promise。

组件 `triggerEvent` 在 Node/browser 中共用声明树分发：默认只触发宿主直接绑定；`capturePhase: true` 按外到内执行捕获，`bubbles: true` 再按内到外冒泡，`composed: true` 才允许越过声明组件边界。普通视图与组件宿主均参与；`catch` 停止后续冒泡，`capture-catch` 同时阻止后续冒泡阶段。宿主与模板根即使合并渲染，仍保留各自的绑定和声明所有者。

事件保留原始 `detail` 与源组件宿主的 `target.id/dataset`，各监听节点提供自己的 `currentTarget`。一次分发先固定路径和实例所有者，回调中的重渲染或移除不把剩余事件发送给新实例。公开 renderer context 的 `eventBindings` 仍保存原有 `{ method, stopAfter }` 冒泡绑定，捕获绑定独立存放于可选的 `captureEventBindings`。

包根公开的 `collectMiniProgramEventBindings` 与 `resolveMiniProgramEventBinding` 继续返回 `{ method, stopAfter }` 冒泡绑定；只有捕获绑定时，公开 resolver 仍返回 `null`。内部的分阶段解析不会改变这些既有调用者的返回类型或优先级规则。

上述默认、仅捕获、局部冒泡、跨组件冒泡与宿主两种 catch 边界已对照微信开发者工具稳定版 `2.02.2608080`，并覆盖同一 issue runtime suite 的 headless provider 和实际浏览器预览。此对照不扩展为原生 tap、scroll、video 的捕获支持，也不表示已验证同节点 Vue 内联捕获/冒泡处理函数的编译语义。

## 原生表单提交与富文本

Node/browser 的原生 tap 到达未禁用的 `button form-type="submit"` 时，在 tap 回调之后提交最近的参与表单。提交目标、字段值与方法所有者在回调前固定；组件销毁、重渲染或同路由重建不会把提交转交给新实例。`tap()` 等待 tap 与 submit 的异步处理，继续传递结果或错误。普通插槽按声明归属参与；跨私有组件边界的按钮需要 `wx://form-field-button`，原生字段分组需要 `wx://form-field-group`。WXML 按 XML 节点结构解析，不应用 HTML 对嵌套 `form` 的隐式修复。

后续监听器同步抛错时，测试句柄仍观察并等待此前已启动的异步处理。只有该同步错误时原样抛出；异步处理也失败时，抛出包含全部已收集失败的 `AggregateError`，并以原同步错误作为 `cause`，避免遗留未处理的 Promise 拒绝。

`submit.detail.value` 来自参与表单的具名原生控件当前渲染绑定，包含 input/textarea、switch、slider、picker、radio-group 与 checkbox-group；picker 数组保留原始绑定类型，不从逗号字符串猜测值。此能力不补齐未绑定输入的宿主状态、`wx://form-field` 自定义值导出、reset 或真实 `formId` 上报，也不把任意页面数据当作原生字段值。

`rich-text` 的结构化 `nodes` 与 HTML 字符串通过 `@weapp-core/shared/rich-text` 的共同安全规则生成实际渲染子树，支持更新和清空。内容不会再次解释为 WXML 表达式、事件或自定义组件；外部内容不能伪造 `data-sim-*` 元数据。通用 `text()`、快照和序列化观察同一份渲染内容，`attr('nodes')` 仍是既有字符串属性，不是结构化属性 API。富文本内部不获得 WXML 声明作用域；需要检查内部渲染节点时使用 XPath，而不是放宽声明作用域内的 CSS 查询。

浏览器预览取消富文本链接的普通/辅助点击导航和 HTML 表单默认提交；业务 tap 与原生表单动作仍由模拟器分发，不能让浏览器额外导航或再次提交。

上述能力属于模拟器模型，不代表真实微信 IDE 或设备验收。

## 登录与账号信息

Node 和浏览器 simulator 提供 `wx.login`、`wx.getAccountInfoSync`、`wx.arrayBufferToBase64` 与 `wx.base64ToArrayBuffer`。两项 Base64 API 同步转换二进制数据，支持空缓冲区。

`wx.login()` 同步返回 `undefined`，随后异步派发 `success → complete` 或 `fail → complete`，不提供 Promise 调用方式。默认生成会话内递增的 `mpcore-login-1` 等模拟 code，不请求微信登录服务；模拟 code 不能用于真实的 `code2Session`。

Node/browser session 共用以下配置方法，可在导航前调用；使用测试入口时可放在 `launch({ configureSession })` 中：

```ts
session.setAccountInfo({
  miniProgram: { appId: 'wx-local-app', envVersion: 'trial', version: '' },
})
session.mockLogin({ code: 'local-login-code', delay: 10 })
session.mockLogin({ error: 'denied' })
```

`mockLogin()` 按调用顺序各消费一次，即使不同调用的 delay 使回调顺序不同。省略 code 时生成默认模拟 code，error 表示失败原因；`wx.login({ timeout })` 的正数 timeout 小于 mock delay 时触发 `login:fail timeout`。启用 `strictHostMocks` 后，每次登录都需要显式 mock，否则异步触发 `login:fail no mock matched in headless runtime`。关闭会话会取消待派发结果。

账号信息默认读取项目配置中的 appid，`project.private.config.json` 的非空值优先于 `project.config.json`；浏览器读取同名虚拟文件。缺少 appid 时返回空字符串，默认 envVersion 为 `develop`、version 为空字符串，不生成插件账号信息。`setAccountInfo()` 整体替换账号信息，传入与返回的对象均复制，修改对象不会影响会话内状态。

## 分块请求 mock

`session.mockRequest()` 支持为 `enableChunked: true` 的请求声明分块，默认仍不访问网络：

```ts
session.mockRequest({
  url: 'https://example.test/data',
  response: '',
  delay: 10,
  chunks: [
    { data: new Uint8Array([65]).buffer, delay: 10 },
    { data: new Uint8Array([66]).buffer, delay: 10 },
  ],
})
```

顶层 `delay` 控制响应头阶段，每个分块的 `delay` 相对于前一个阶段。请求提供 `onHeadersReceived` / `offHeadersReceived`、`onChunkReceived` / `offChunkReceived`；不传回调的 off 方法移除全部对应监听。取消会停止后续分块并仅触发一次 `fail → complete`。可设置 `error` 模拟已发送分块后的连接失败。

分块请求的 `success.data` 按已验证的微信 DevTools 行为返回空字符串；数据只通过 chunk 交付。未设置 `chunks` 时不会将普通 `response` 自动拆分。自定义 driver 仍可只实现 abort，公开监听方法类型为可选，使用前需检测能力。此模型不提供 Streams 或传输反压保证。

## worker

Node 与浏览器 simulator 支持从编译产物创建 worker、CommonJS 依赖、双向消息复制、终止及会话关闭清理；每个 worker 拥有独立模块缓存、全局对象与计时器。配置沿用 `app.json.workers`，worker 分包支持 `preDownloadSubpackage({ packageType: 'workers' })`。

当前对照场景覆盖首条消息、双向通信、页面重入与关闭后不再投递。simulator 使用确定性任务调度，不模拟真实并行线程性能、系统进程回收或实验性 worker 后端。
