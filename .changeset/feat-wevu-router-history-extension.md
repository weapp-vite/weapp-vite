---
"wevu": minor
"create-weapp-vite": patch
---

feat(wevu): 支持自定义 history 驱动，并让路由守卫读取自定义位置。

`createRouter({ history })` 现在接受业务实现的 `RouterHistory`：`readLocation` 读取自有位置，`push` / `replace` 接管导航提交，`check` 替换平台校验，`resolveGo` / `go` 接管前后退，`resetLocation` 释放页面位置，省略的钩子沿用小程序原生行为；`syncWithNative: false` 可使用独立于原生页面栈的逻辑路由状态。`wevu/router` 同步导出 `createMiniProgramHistory` 与相关类型。

守卫（含返回守卫）的 `to` / `from` 会带上自定义位置表示，登录校验、二次确认等拦截统一写进 `beforeEach` / `beforeResolve` 即可。原始位置显式带 query 时以调用方为准；改道目标未带 query 时按目标 path 读回业务存储。

守卫与驱动校验共用同一套返回契约：`undefined` / `true` 放行，`false` / `Error` / `NavigationFailure` 中止，原始位置或 `NavigationRedirect` 改道，支持返回 Promise 异步确认；`Error` 现在也是守卫的合法返回值。提供 `check` 会整体替换平台校验（重复导航、hash-only、tab-query），需要保留时由驱动自行实现。
