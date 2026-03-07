# wevu/router 与 Vue Router 对齐矩阵

本文档用于说明 `wevu/router` 与 Vue Router 4 API 心智的对齐状态，帮助你快速判断“可直接迁移”与“需要平台适配”的边界。

## 1. Router 实例 API

| API               | Vue Router 4                         | wevu/router                               | 状态      | 说明                                                                                                                                   |
| ----------------- | ------------------------------------ | ----------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `currentRoute`    | `Ref<RouteLocationNormalizedLoaded>` | `Readonly<RouteLocationNormalizedLoaded>` | 部分对齐  | `wevu` 下通过页面生命周期同步更新，不暴露 `Ref` 容器。                                                                                 |
| `options`         | `RouterOptions`                      | `Readonly<UseRouterOptions>`              | 部分对齐  | 提供初始化快照，便于读取 `paramsMode/maxRedirects/namedRoutes/tabBarEntries`。                                                         |
| `resolve(to)`     | 支持                                 | 支持                                      | 已对齐    | 额外提供 `href/matched/redirectedFrom` 调试字段；`children` 场景下 `matched` 返回父子链，alias 命中时叶子 `matched` 会带 `aliasPath`。 |
| `isReady()`       | 支持                                 | 支持                                      | 已对齐    | 小程序运行时下 Promise 立即 resolve。                                                                                                  |
| `push(to)`        | 支持                                 | 支持                                      | 已对齐    | 导航失败语义通过 `NavigationFailure` 对齐。                                                                                            |
| `replace(to)`     | 支持                                 | 支持                                      | 已对齐    | 同上。                                                                                                                                 |
| `back()`          | 支持                                 | 支持                                      | 已对齐    | 对齐为 `navigateBack` 语义。                                                                                                           |
| `go(delta)`       | 支持                                 | 支持                                      | 部分对齐  | `delta > 0` 在小程序下不支持前进栈，返回 `aborted`。                                                                                   |
| `forward()`       | 支持                                 | 支持                                      | 部分对齐  | 小程序无前进栈，固定返回 `aborted` 失败对象。                                                                                          |
| `beforeEach()`    | 支持                                 | 支持                                      | 已对齐    | 返回卸载函数。                                                                                                                         |
| `beforeResolve()` | 支持                                 | 支持                                      | 已对齐    | 返回卸载函数。                                                                                                                         |
| `afterEach()`     | 支持                                 | 支持                                      | 已对齐    | 返回卸载函数。                                                                                                                         |
| `onError()`       | 支持                                 | 支持                                      | 已对齐    | 异常导航失败会上报。                                                                                                                   |
| `addRoute()`      | 支持                                 | 支持                                      | 已对齐    | 支持 `addRoute(route)` 与 `addRoute(parentName, route)`，返回移除函数。                                                                |
| `removeRoute()`   | 支持                                 | 支持                                      | 已对齐    | 按 name 删除；`children` 场景会连带删除子记录。                                                                                        |
| `hasRoute()`      | 支持                                 | 支持                                      | 已对齐    | 按 name 查询。                                                                                                                         |
| `getRoutes()`     | 支持                                 | 支持                                      | 已对齐    | 返回当前命名路由记录快照。                                                                                                             |
| `clearRoutes()`   | 无                                   | 支持                                      | wevu 扩展 | 一次性清空命名路由（迁移期/测试隔离常用）。                                                                                            |
| `install(app)`    | 支持                                 | 支持（兼容 no-op）                        | 部分对齐  | 为跨端共享代码提供调用兼容，但不参与小程序运行时注册。                                                                                 |

## 2. 路由记录与守卫

| 能力                | Vue Router 4 | wevu/router | 状态     | 说明                                                                                           |
| ------------------- | ------------ | ----------- | -------- | ---------------------------------------------------------------------------------------------- |
| 命名路由            | 支持         | 支持        | 已对齐   | 支持 `name + params + query` 导航。                                                            |
| 路径参数（`?/*/+`） | 支持         | 支持        | 已对齐   | 支持可选/重复参数解析。                                                                        |
| `meta`              | 支持         | 支持        | 已对齐   | `resolve()` 结果会带上匹配记录的 `meta`。                                                      |
| `beforeEnter`       | 支持         | 支持        | 已对齐   | 支持单个或数组守卫；`children` 场景按父到子链路依次执行，父级重定向会中断后续子守卫。          |
| `redirect`          | 支持         | 支持        | 已对齐   | 支持字符串/对象/函数，并保留 `redirectedFrom`；`children` 场景会先处理父链路 `redirect`。      |
| 嵌套路由 `children` | 支持         | 支持        | 部分对齐 | 支持在 `namedRoutes` 中声明 `children` 并展平成可匹配记录；不提供 Vue Web 的嵌套视图渲染语义。 |
| `alias`             | 支持         | 支持        | 部分对齐 | 支持记录级 `alias` 路径匹配与守卫触发；不支持 `children` 级联场景。                            |

## 3. 平台差异（必须认知）

- 小程序不支持 hash 导航，hash-only 变化会返回 `NavigationFailureType.aborted`。
- `switchTab` 不支持 query，命中 tabBar 且带 query 会返回 `aborted`。
- 前进栈语义不可用，`forward/go(>0)` 不会成功推进历史栈。

## 4. 迁移建议

1. 先使用 `useRouter({ paramsMode: 'loose' })` 平滑接管。
2. 把高频路径迁移到 `namedRoutes`，逐步替换字符串拼接。
3. 守卫逻辑优先收敛到 `beforeEach/beforeResolve/beforeEnter`。
4. 核心流程切换到 `paramsMode: 'strict'`，及时暴露历史参数问题。
