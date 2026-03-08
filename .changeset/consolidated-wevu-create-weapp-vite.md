---
'create-weapp-vite': patch
'wevu': patch
---

整合 wevu 路由与运行时能力增强相关 changeset。

## 变更摘要
1. **blue-apples-jump.md**：对齐 `wevu/router` 的导航钩子调用心智：`beforeEach` / `beforeResolve` 统一支持 `(to, from, context?)`，`afterEach` 支持 `(to, from, failure?, context?)`，让默认使用方式与 Vue Router 更一致，同时保留 `context` 作为高级扩展参数。
2. **blue-halls-listen.md**：为 `wevu` 新增 `usePageScrollThrottle()` 组合式 API：可在 `setup()` 中直接注册节流版 `onPageScroll` 回调，支持 `interval`、`leading`、`trailing` 选项，并返回 `stop` 句柄用于手动停止监听。 该能力会在 `onUnload/onDetached` 自动清理挂起的 trailing 定时器，避免页面销毁后残留滚动任务；同时补齐运行时导出覆盖与类型测试，确保 API 可用性与类型推导稳定。
3. **bright-falcons-cheer.md**：为 `wevu/router` 增加 `onError()` 订阅能力，用于集中处理路由守卫抛错等异常型导航失败；同时保留 `afterEach` 对所有导航结果的统一收敛，减少 duplicated/cancel 等预期失败对异常监控的干扰。
4. **calm-pets-fry.md**：在 `wevu/router` 中新增对齐 Vue Router 心智的基础能力：`useRoute()` 当前路由快照、`resolveRouteLocation()` 路由归一化，以及 `parseQuery()` / `stringifyQuery()` 查询串工具，便于在小程序环境中统一路由解析与类型约束。
5. **chilly-wasps-enjoy.md**：`wevu/router` 新增 `RouteRecordRaw.children` 声明支持。现在可以在 `namedRoutes` 中使用树状路由配置，运行时会自动展平成可匹配记录，并支持子路由的 `resolve`、路径反查（`name/params` 推断）以及 `beforeEnter/redirect` 执行链路。同时，`children` 命中场景下 `resolve().matched` 会返回父到子的匹配链，`resolve().meta` 按父到子顺序进行浅合并，更贴近 Vue Router 心智模型。
6. **cold-apricots-impress.md**：`wevu/router` 新增 `router.install(app?)` 兼容方法（no-op），用于提升与 Vue Router 插件调用形态的一致性，便于跨端共享代码时减少条件分支。该方法在小程序运行时不执行额外注册逻辑。
7. **cool-needles-warn.md**：为 `wevu/router` 增加 `router.currentRoute` 只读引用，直接暴露当前路由状态并与 `onShow/onRouteDone` 等页面路由生命周期保持同步，进一步贴近 Vue Router 的使用心智；同步补充运行时与类型测试。
8. **dirty-bees-work.md**：为 `wevu` 新增子路径入口 `wevu/router`，导出 `useRouter` / `usePageRouter` 及路由相关类型，便于按模块按需导入并统一路由类型约束。
9. **early-olives-trade.md**：为 `wevu/router` 增加 `namedRoutes` 的运行时解析能力：支持 `{ name, params }` 在 `resolve/push/replace` 中映射到真实页面路径，并在静态路径命中时回填 `route.name`；同时对未配置路由名或缺失必填参数统一产出 `NavigationFailureType.unknown`（默认按 `rejectOnError` 拒绝），让命名导航行为更贴近 Vue Router 心智模型。
10. **fair-hats-switch.md**：移除 `wevu/router` 中未发布的兼容别名 `useRouterNavigation`（以及 `UseRouterNavigationOptions`），将高阶导航入口统一收敛为 `useRouter()`，避免命名分叉带来的使用误解。
11. **fair-spoons-visit.md**：完善 `wevu/router` 在嵌套路由场景下的 `alias` 语义：当父路由声明 `alias` 且子路由使用相对路径时，子路由会自动继承并展开父级 alias 路径，使 `resolve()`、路径匹配和守卫链在 alias 链路下保持一致。 同时补齐运行时 `addRoute(parentName, route)` 的行为一致性，确保动态注册的子路由同样继承父级 alias；并新增对应单测与对齐矩阵文档更新。
12. **fast-eggs-try.md**：进一步增强 `wevu/router` 的导航管线：新增 `afterEach` 后置钩子（统一获取成功/失败上下文），并支持守卫返回 `{ to, replace }` 形式的重定向结果，让守卫可以显式控制重定向走 `push` 还是 `replace` 语义。
13. **five-mangos-grab.md**：新增 `useIntersectionObserver()` 组合式 API：在 `setup()` 内可直接创建 `IntersectionObserver`，并在 `onUnload/onDetached` 时自动断开连接，降低手写清理逻辑与滚动轮询成本。同时增强 `setData.highFrequencyWarning`：在检测到 `onPageScroll` 回调中调用 `setData` 时输出专项告警（可配置冷却时间与开关），引导改用可见性观察或节流方案，并补充对应文档与类型定义。
14. **funny-buses-whisper.md**：增强 `usePageScrollThrottle()`：新增 `maxWait` 选项，在持续滚动期间可限制“最长不触发时间”，避免仅依赖 `interval`/`trailing` 时长时间未回调。 同时补充 `maxWait` 相关边界测试与类型覆盖，确保 `leading`、`trailing`、`maxWait` 组合行为稳定，并保持卸载时定时器清理语义不变。
15. **fuzzy-pigs-cheat.md**：为 `wevu` 新增子路径入口 `wevu/store` 与 `wevu/api`，其中 `wevu/api` 直接透传 `@wevu/api` 的能力，便于按需导入并保持与独立 API 包的一致接口。
16. **good-pianos-juggle.md**：`wevu/router` 新增 `router.isReady()`，用于对齐 Vue Router 的可等待启动语义。在当前小程序运行时中该 Promise 会立即 resolve，便于统一业务层调用模式（例如在初始化流程中统一 `await router.isReady()`）。
17. **green-bears-hear.md**：继续增强 `wevu/router`：新增 `beforeResolve` 守卫，并支持守卫返回重定向目标（字符串或路由对象）；同时为重定向链路加入 `maxRedirects` 上限控制，避免守卫循环重定向导致的无限导航。
18. **green-cups-bow.md**：`wevu/router` 新增 `router.options` 只读配置快照，用于按 Vue Router 心智读取初始化参数（如 `paramsMode/maxRedirects/namedRoutes/tabBarEntries`）。该快照在路由器创建时确定，不会随着 `addRoute/removeRoute/clearRoutes` 的运行时变更而漂移，便于调试与诊断。
19. **green-houses-smile.md**：为 `wevu` 的 `setData` 新增了两项运行时性能能力：`suspendWhenHidden` 用于页面/组件进入后台态后挂起并合并更新，在回到前台时再一次性下发；`diagnostics` 用于输出内建的 `setData` 诊断日志，便于定位高频更新、回退 diff 与 payload 体积问题，同时保持现有 `debug` 回调兼容。
20. **green-lamps-brush.md**：`wevu/router` 新增 `routes` 兼容入口，用法与 Vue Router 更一致；同时保留 `namedRoutes` 作为兼容写法。初始化时支持同时传入 `routes` 与 `namedRoutes`，并约定同名记录由 `namedRoutes` 覆盖。 另外补齐 `router.options.routes` 快照输出、相关类型测试和文档示例，帮助业务逐步从旧写法迁移到 `routes` 心智。
21. **green-zebras-think.md**：为 `wevu/router` 新增 `go(delta)` 与 `forward()` 导航方法：`go(<0)` 复用小程序 `navigateBack` 回退，`go(0)` 为无操作，`forward()` 在小程序路由能力受限场景下返回 `NavigationFailureType.aborted`。同时补充对应的运行时与类型测试，完善与 Vue Router 导航 API 的对齐体验。
22. **itchy-points-begin.md**：为 `wevu/router` 增加 `paramsMode` 选项（`loose | strict`，默认 `loose`），用于控制命名路由 `params` 的容错行为：`strict` 模式下会校验并拒绝未被路径模板消费的多余参数，减少参数误传导致的隐性导航问题。同步补充运行时与类型测试覆盖。
23. **late-poems-think.md**：`wevu/router` 调整 `removeRoute(name)` 在 `children` 场景下的行为：删除父路由时会连带删除其子路由记录，避免出现父路由已移除但子路由仍可匹配的状态偏差，更贴近 Vue Router 心智模型。
24. **lazy-lions-film.md**：收敛 `wevu/router` 的 `router.options` 语义：现在会返回运行时冻结的初始化快照，避免业务侧误改配置导致的状态歧义。快照保持“初始化值”定位，不随 `addRoute/removeRoute/clearRoutes` 动态变化；动态路由状态请通过 `getRoutes()` 获取。 同时补充对应回归测试与文档说明，明确 `routes` 为推荐入口、`namedRoutes` 为兼容入口的迁移策略。
25. **mighty-garlics-teach.md**：继续对齐 `wevu/router` 的 Vue Router 心智： - `useRouter` 新增 `parseQuery` / `stringifyQuery` 配置钩子，支持按实例自定义查询解析与序列化。 - 增加 hash-only 导航判定策略：当路径与查询等价、仅 `hash` 变化时返回 `aborted` 失败，避免在小程序原生路由层触发无效跳转。
26. **neat-lions-swim.md**：补齐 `wevu/router` 的 `RouteLocation` 最小字段模型：新增 `hash` / `name` / `params`（含 `RouteParamsRaw` 归一化），并支持从 `fullPath` 解析 `hash`。为保持小程序兼容，原生 `navigateTo/redirectTo` 发送的 URL 会自动忽略 `hash`，仅在路由语义层保留该字段。
27. **neat-pens-jam.md**：`wevu/router` 在 alias 命中场景下补充 `resolve().matched` 语义：保持 `matched.path` 为 canonical 路由路径，并在叶子记录上新增可选 `aliasPath` 字段标记实际命中的 alias 模板/路径，便于调试与埋点时区分“规范路径”与“alias 命中路径”。
28. **neat-squids-dance.md**：收紧 `wevu/router` 初始化路由配置校验：当路由记录存在空 `name/path`、重复 `alias`（含与主路径相同）或循环 `children` 引用时，会输出告警并跳过无效部分，避免潜在的匹配歧义与递归风险。 同时补充回归测试，覆盖无效记录跳过、alias 归一化告警与循环引用处理，确保 `addRoute` 与初始化场景行为稳定。
29. **odd-cups-beam.md**：`wevu/router` 新增 `addRoute(parentName, route)` 重载，支持以 Vue Router 心智将子路由动态挂载到已存在父路由下。子路由使用相对路径时会基于父路由路径自动拼接，并保持与 `removeRoute/hasRoute/getRoutes` 的一致行为。
30. **old-emus-decide.md**：为 `wevu` 新增 `wevu/fetch` 子路径导出，基于 `@wevu/api` 的 `wpi.request` 提供与标准 `fetch` 对齐的核心行为：返回 `Promise<Response>`、HTTP 非 2xx 不抛错、网络失败抛 `TypeError`、支持 `AbortSignal` 取消、并对 `GET/HEAD` 携带 `body` 进行一致性校验。
31. **olive-cameras-itch.md**：增强 `wevu/router` 的导航能力：`useRouterNavigation()` 新增 `beforeEach` 轻量守卫，并支持按 `tabBarEntries` 自动把 `push/replace` 分流到 `switchTab`，同时补充对应的失败判定与类型约束。
32. **quick-cameras-wave.md**：`wevu/router` 完善 `children` 场景下的路由记录 `redirect` 执行语义：当目标命中父子匹配链时，会按匹配链优先处理父级 `redirect`。一旦命中重定向，后续子路由守卫将不再执行，行为更贴近 Vue Router 嵌套路由心智模型。
33. **quiet-badgers-sparkle.md**：增强 `wevu/router` 的重名路由告警可读性：`routes` / `namedRoutes` 冲突时会输出来源与路径变化（例如 `routes:/old -> namedRoutes:/new`），帮助快速定位覆盖来源。 同时补齐动态路由替换的回归覆盖：`addRoute()` 同名替换后，验证 alias、beforeEnter、redirect、children 清理与静态匹配索引均按新记录生效，避免旧链路残留。
34. **quiet-planes-check.md**：增强 `wevu/router` 的解析结果与路由记录行为：`resolve()` 结果新增 `href/matched/redirectedFrom` 扩展字段（可选），并在导航重定向链路中透出来源位置信息；同时补齐 `RouteRecordRaw` 子集能力的回归测试，覆盖 `meta` 注入、`beforeEnter` 与记录级 `redirect` 行为。
35. **rare-brooms-argue.md**：为 `wevu` 新增 `onMemoryWarning()` App 生命周期能力：在 `setup()` 注册后，运行时会桥接 `wx.onMemoryWarning` 并在重复绑定时自动调用 `wx.offMemoryWarning` 清理旧监听，避免内存告警监听器累积。开发者可在回调中集中回收大缓存、临时对象与冗余订阅，同时补齐对应的类型定义、单测与 website 文档。
36. **red-lamps-talk.md**：为 `wevu/router` 增加 `RouteRecordRaw` 子集能力（`meta`、`beforeEnter`、`redirect`），并将 `namedRoutes`、`getRoutes()`、`addRoute()` 升级到记录模型；导航流程新增路由记录级重定向与 `beforeEnter` 守卫执行，`resolve()` 可从命中记录注入 `meta`，进一步对齐 Vue Router 的路由心智模型。
37. **rude-countries-yawn.md**：`wevu/router` 完善 `children` 场景下的 `beforeEnter` 执行语义：当目标命中父子链路时，`beforeEnter` 会按父到子顺序依次执行；若父级守卫返回重定向，后续子守卫将不再执行。该行为更贴近 Vue Router 的嵌套路由守卫心智模型。
38. **silly-cobras-wave.md**：`wevu/router` 新增 `router.clearRoutes()`，用于一次性清空当前路由器实例中的命名路由记录（包含初始化和运行时动态添加的记录）。该能力与 `addRoute/removeRoute/getRoutes/hasRoute` 形成完整的路由记录管理闭环，便于迁移期重置路由表与测试隔离。
39. **small-seas-knock.md**：调整 `wevu` 根入口的路由 helper 命名，移除易与 `wevu/router` 高阶导航混淆的 `useRouter()/usePageRouter()`，统一改为 `useNativeRouter()/useNativePageRouter()`；同时在注释中明确推荐优先使用 `wevu/router` 的 `useRouter()` 获取更完整的导航能力（守卫、失败分类与解析能力）。
40. **sour-houses-listen.md**：为 `wevu/router` 增加运行时路由管理能力：新增 `addRoute()` 与 `removeRoute()`，并与 `hasRoute()/getRoutes()`、命名路由解析链路联动，使 `namedRoutes` 支持在运行时动态增删并立即生效。
41. **swift-icons-fail.md**：进一步对齐 `wevu/router` 与 Vue Router 的导航 Promise 心智：默认情况下，守卫抛错等“异常型失败”会以 Promise reject 抛出；常规导航失败（如 duplicated/cancelled）仍通过返回值传递。新增 `UseRouterOptions.rejectOnError` 可关闭该行为，回退到始终返回失败对象的模式。
42. **tall-bottles-push.md**：`wevu/router` 新增 `RouteRecordRaw.alias` 支持（字符串或字符串数组）。现在通过 alias 路径进行 `resolve/push/replace` 时，可以正确命中命名路由记录并推断 `name/params/matched`，同时会触发对应记录的 `beforeEnter/redirect` 逻辑。
43. **tame-geese-taste.md**：进一步分层 `wevu/router` 的路由配置校验策略：初始化阶段对无效记录采用“告警并跳过”（空 `name/path`、重复/无效 `alias`、循环 `children` 引用）；运行时 `addRoute()` 对根记录采用“失败即抛错”（缺失 `name/path` 或循环引用直接抛错）。 同时补充对应回归测试与文档说明，明确初始化与动态注册两条链路的容错等级，减少迁移期配置歧义。
44. **tidy-bottles-joke.md**：收紧 `wevu` 路由类型：`switchTab` 现在使用仅绝对路径的独立类型约束，并支持通过 `WevuTypedRouterRouteMap.tabBarEntries` 进一步收窄为 tabBar 页面联合类型；未声明时回退到 `entries`。同时补充对应的类型测试与文档说明，明确 `switchTab` 不接受相对路径和查询参数。 同时修复一组运行时类型声明细节，消除 `wevu` 类型检查中的基线噪音：避免根导出里的重复 `ModelRef` 导出冲突，收敛 `setData` 适配器返回类型，并补齐若干严格模式下的显式类型注解。 另外补强 `createWevuComponent()` 的泛型推导，使其 `props` 写法在类型层与 `defineComponent()` 保持一致，并补充对应 `test-d` 断言。
45. **tiny-countries-listen.md**：修复 `wevu/router` 的动态路径匹配能力：当通过路径形式导航到动态命名路由（如 `/pages/post/42/index`）时，现在可以正确推断路由记录并注入 `name/params/matched`，同时会触发对应记录的 `beforeEnter/redirect` 逻辑。
46. **tough-rice-wave.md**：增强 `wevu/router` 的路由配置可观测性与重名处理语义：初始化时若 `routes` 与 `namedRoutes`（或同一来源）存在同名路由，会输出告警并明确“后者覆盖前者”。 同时调整 `addRoute()` 的重名行为：新增同名路由时会先清理旧路由及其 `children` 链，再写入新记录，避免旧路径/旧子路由残留造成匹配歧义。并补充覆盖守卫、重定向、静态路径索引和 children 清理的回归测试与文档说明。
47. **twelve-turtles-tickle.md**：在 `wevu/router` 中补充 Vue Router 风格的导航封装能力：新增 `useRouterNavigation()`（`push/replace/back/resolve`）、`NavigationFailureType`、`createNavigationFailure()` 与 `isNavigationFailure()`，用于统一处理小程序路由调用结果与失败分类。
48. **wild-peaches-smell.md**：调整 `wevu/router` 的命名心智：将高阶导航入口统一为 `useRouter()`，并新增 `useNativeRouter()` / `useNativePageRouter()` 表达原生路由桥接语义；同时保留 `useRouterNavigation()` 作为兼容别名，便于渐进迁移。
49. **wise-buses-jam.md**：为 `wevu/router` 新增 `hasRoute(name)` 与 `getRoutes()`，用于在运行时检查和读取 `namedRoutes` 映射；同时补齐命名路由在守卫重定向场景下的测试覆盖，确保 `{ name, params }` 目标可被一致解析并导航。
50. **young-pears-glow.md**：为 `wevu` 新增 `useDisposables()` 组合式清理工具：在 `setup()` 中可统一注册清理函数或带 `dispose/abort/cancel/stop/disconnect/destroy/close` 方法的对象，并在 `onUnload/onDetached` 自动批量释放，支持幂等 `dispose()` 与取消注册。 同时提供 `bag.setTimeout()` / `bag.setInterval()` 计时器辅助，自动在销毁时清理 timer，减少页面与组件长期运行下的内存泄漏风险；并补齐导出覆盖、类型测试与运行时单测。
