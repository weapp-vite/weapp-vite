# wevu/router 与 Vue Router 对齐矩阵

本文档用于说明 `wevu/router` 与 Vue Router 4 API 心智的对齐状态，帮助你快速判断“可直接迁移”与“需要平台适配”的边界。

## 1. Router 实例 API

| API               | Vue Router 4                         | wevu/router                               | 状态      | 说明                                                                                                                                                                           |
| ----------------- | ------------------------------------ | ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `currentRoute`    | `Ref<RouteLocationNormalizedLoaded>` | `Readonly<RouteLocationNormalizedLoaded>` | 部分对齐  | `wevu` 下通过页面生命周期同步更新，不暴露 `Ref` 容器。                                                                                                                         |
| `options`         | `RouterOptions`                      | `Readonly<UseRouterOptions>`              | 部分对齐  | 提供运行时冻结的初始化快照，便于读取 `paramsMode/maxRedirects/initialNavigationMode/initialNavigationTimeout/routes/namedRoutes/tabBarEntries`；动态变更请使用 `getRoutes()`。 |
| `resolve(to)`     | 支持                                 | 支持                                      | 已对齐    | 额外提供 `href/matched/redirectedFrom` 调试字段；`children` 场景下 `matched` 返回父子链，alias 命中时叶子 `matched` 会带 `aliasPath`。                                         |
| `isReady()`       | 支持                                 | 支持                                      | 已对齐    | 小程序运行时下 Promise 立即 resolve。                                                                                                                                          |
| `push(to)`        | 支持                                 | 支持                                      | 已对齐    | 导航失败语义通过 `NavigationFailure` 对齐。                                                                                                                                    |
| `replace(to)`     | 支持                                 | 支持                                      | 已对齐    | 同上。                                                                                                                                                                         |
| `back()`          | 支持                                 | 支持                                      | 已对齐    | 对齐为 `navigateBack` 语义。                                                                                                                                                   |
| `go(delta)`       | 支持                                 | 支持                                      | 部分对齐  | `delta > 0` 在小程序下不支持前进栈，返回 `aborted`。                                                                                                                           |
| `forward()`       | 支持                                 | 支持                                      | 部分对齐  | 小程序无前进栈，固定返回 `aborted` 失败对象。                                                                                                                                  |
| `beforeEach()`    | 支持                                 | 支持                                      | 已对齐    | 返回卸载函数。                                                                                                                                                                 |
| `beforeResolve()` | 支持                                 | 支持                                      | 已对齐    | 返回卸载函数。                                                                                                                                                                 |
| `afterEach()`     | 支持                                 | 支持                                      | 已对齐    | 返回卸载函数。                                                                                                                                                                 |
| `onError()`       | 支持                                 | 支持                                      | 已对齐    | 异常导航失败会上报。                                                                                                                                                           |
| `addRoute()`      | 支持                                 | 支持                                      | 已对齐    | 支持 `addRoute(route)` 与 `addRoute(parentName, route)`，返回移除函数；同名时覆盖旧记录并清理其 `children` 链。                                                                |
| `removeRoute()`   | 支持                                 | 支持                                      | 已对齐    | 按 name 删除；`children` 场景会连带删除子记录。                                                                                                                                |
| `hasRoute()`      | 支持                                 | 支持                                      | 已对齐    | 按 name 查询。                                                                                                                                                                 |
| `getRoutes()`     | 支持                                 | 支持                                      | 已对齐    | 返回当前命名路由记录快照。                                                                                                                                                     |
| `clearRoutes()`   | 无                                   | 支持                                      | wevu 扩展 | 一次性清空命名路由（迁移期/测试隔离常用）。                                                                                                                                    |
| `install(app)`    | 支持                                 | 支持（兼容 no-op）                        | 部分对齐  | 为跨端共享代码提供调用兼容，但不参与小程序运行时注册。                                                                                                                         |

## 2. 路由记录与守卫

Wevu 首屏导航默认采用 `initialNavigationMode: 'eager'`，生命周期和首屏渲染不会等待异步守卫；需要 Vue Router 式的首屏门控时显式使用 `'blocking'`。这是小程序性能保护：网络预加载应使用页面 loading/skeleton，而不是默认阻塞页面挂载。

| 能力                | Vue Router 4 | wevu/router | 状态     | 说明                                                                                                  |
| ------------------- | ------------ | ----------- | -------- | ----------------------------------------------------------------------------------------------------- |
| 命名路由            | 支持         | 支持        | 已对齐   | 支持 `name + params + query` 导航。                                                                   |
| 路径参数（`?/*/+`） | 支持         | 支持        | 已对齐   | 支持可选/重复参数解析。                                                                               |
| `meta`              | 支持         | 支持        | 已对齐   | `resolve()` 结果会带上匹配记录的 `meta`。                                                             |
| `beforeEnter`       | 支持         | 支持        | 已对齐   | 支持单个或数组守卫；`children` 场景按父到子链路依次执行，父级重定向会中断后续子守卫。                 |
| `redirect`          | 支持         | 支持        | 已对齐   | 支持字符串/对象/函数，并保留 `redirectedFrom`；`children` 场景会先处理父链路 `redirect`。             |
| 嵌套路由 `children` | 支持         | 支持        | 部分对齐 | 支持在 `routes/namedRoutes` 中声明 `children` 并展平成可匹配记录；不提供 Vue Web 的嵌套视图渲染语义。 |
| `alias`             | 支持         | 支持        | 已对齐   | 支持记录级 `alias`，并在 `children` 场景下自动级联父级 alias，匹配与守卫链路均可用。                  |

## 3. 平台差异（必须认知）

- 小程序不支持 hash 导航，hash-only 变化会返回 `NavigationFailureType.aborted`。
- `switchTab` 不支持 query，命中 tabBar 且带 query 会返回 `aborted`。
- 前进栈语义不可用，`forward/go(>0)` 不会成功推进历史栈。
- 滚动恢复是 `wevu/router` 的显式扩展，不复刻浏览器 viewport、DOM/history、`scrollBehavior` 或 `savedPosition`。

### 滚动恢复的适配边界

| 需求 | Vue Router 4 | wevu/router |
| --- | --- | --- |
| 启用滚动策略 | Router 配置 `scrollBehavior` | App 初始化时创建一次 `createScrollRestoration({ router })`，页面/组件同步 setup 注册适配器 |
| 页面级滚动 | 浏览器文档滚动 | `usePageScrollRestoration()` 只面向 WebView，缓存 `onPageScroll` 并调用 `pageScrollTo` |
| 独立滚动区 | DOM 元素或业务逻辑 | `useScrollViewRestoration()` 显式绑定 `scrollTop/scrollLeft/onScroll`，支持 WebView/Skyline `scroll-view` |
| 自定义位置/异步内容 | 返回滚动位置或 Promise | `useScrollRestoration<T>()` 同步捕获独立快照；异步 `restore` 每次 await 后检查 `context.isActive()` |
| 延迟恢复 | 由浏览器滚动策略处理 | `manual: true`，业务内容稳定后调用 `handle.scroll()`；仍等待 ready、首屏守卫结算及实际宿主提交 |
| 返回到保留页面 | 可使用历史项的 `savedPosition` | 自动恢复只面向新建实例；返回保留页、切回保留 tab、前台唤醒不回放快照，位置归原生宿主管理 |

默认按包含 query 的 `fullPath` 和 `id`（默认 `'default'`）保存快照；同一路径不同 query 隔离。同一原生页面内重复 `key/id` 会报错，跨实例相同索引则共享快照，必须使用相同格式。缓存只存在 controller 会话内存中，可跨原生页面销毁和同会话 `reLaunch`，不跨冷启动、应用重载或 `dispose()`。

微信原生自动关联要求基础库 3.5.5+、`BeforeAppRoute/AppRoute/AppRouteDone/BeforePageUnload` 四组完整 `on/off` API 和字符串 `routeEventId`。自动恢复还会等待路由完成、页面/组件 ready、首屏守卫结算和实际宿主提交；`onShow` 不等于路由完成。低基础库或缺少能力时 `automatic` 为 `false`，仍可使用手动恢复。仓库 Web/headless 宿主通过显式事件契约接入，不伪造微信 SDK 版本。

原生同路径 `reLaunch` 的 `AppRouteDone` 可能返回空 `routeEventId`；只在目标是已确认的新页面、且 `webviewId`、路径、导航类型全部匹配时关联，保留前置路由 ID 作为恢复上下文。旧页面、保留页和不同非空 ID 不走此兼容路径。

`scroll-view` 必须有明确容器和内容尺寸，不能同时由优先级更高的 `scroll-into-view` 控制。内置适配器只在恢复时提交位置，滚动事件仅更新普通缓存；位置超出当前内容时由宿主裁剪，不会重试等待内容增长。

清理分三个层次：`handle.clear()` 清除当前 `key/id`，`controller.clear(key?)` 清除指定 key 的全部 id 或整个会话，两者不注销且后续生命周期仍可捕获；`handle.stop()` 注销而不额外捕获，保留已有快照，`clear(); stop()` 不会重新填回；`controller.dispose()` 移除监听、注销全部注册并清空内存。以上操作会使相关待完成恢复失效，正常生命周期销毁则在停止前捕获。

完整接入、手动恢复和快照所有权示例见 [滚动恢复指南](https://vite.weapp.dev/wevu/router#scroll-restoration) 与 [API 参考](https://vite.weapp.dev/wevu/api/router#scroll-restoration)。

## 4. 迁移建议

1. 先使用 `createRouter({ paramsMode: 'loose' })` 创建实例，再通过 `useRouter()` 平滑接管。
2. 把高频路径迁移到 `routes`（或兼容入口 `namedRoutes`），逐步替换字符串拼接。
3. 守卫逻辑优先收敛到 `beforeEach/beforeResolve/beforeEnter`。
4. 核心流程切换到 `paramsMode: 'strict'`，及时暴露历史参数问题。

## 5. 配置校验等级

| 场景                    | 问题类型                  | 策略         | 结果                                                         |
| ----------------------- | ------------------------- | ------------ | ------------------------------------------------------------ |
| 初始化（`routes`）      | 空 `name/path`            | 告警并跳过   | 不阻塞启动，保留合法记录                                     |
| 初始化（`namedRoutes`） | 空 `name/path`            | 告警并跳过   | 同上                                                         |
| 初始化（含 `children`） | 循环 `children` 引用      | 告警并跳过   | 跳过循环分支，避免递归风险                                   |
| 初始化（含 `alias`）    | 重复 alias / alias=主路径 | 告警并归一化 | 无效 alias 不写入，保留首个有效 alias                        |
| 运行时 `addRoute()`     | 根记录缺失 `name/path`    | 直接抛错     | 阻止写入不完整路由，调用方需修正参数                         |
| 运行时 `addRoute()`     | 根记录循环 `children`     | 直接抛错     | 同上                                                         |
| 运行时 `addRoute()`     | 同名覆盖                  | 告警并替换   | 清理旧记录及其 `children` 链，再写入新记录，匹配索引同步刷新 |
