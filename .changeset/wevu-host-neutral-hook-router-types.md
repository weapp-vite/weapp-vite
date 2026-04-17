'wevu': patch
'create-weapp-vite': patch
---

继续收敛 `wevu` 的公共类型面：新增并导出一组宿主中立的 `MiniProgram*` 生命周期与路由类型别名，例如 `MiniProgramLaunchOptions`、`MiniProgramPageScrollOption`、`MiniProgramRouter` 与 `MiniProgramRouterNavigateToOption` 等，并让 `hooks/register` 与 setup 路由类型默认对齐这些别名。原有基于 `WechatMiniprogram.*` 的能力仍保持兼容，但业务代码可以逐步改用更中立的小程序类型命名。
