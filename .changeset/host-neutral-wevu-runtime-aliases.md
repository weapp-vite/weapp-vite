'wevu': patch
'create-weapp-vite': patch
---

继续扩展 `wevu` 的宿主中立类型层，新增并导出 `MiniProgramSelectorQuery`、`MiniProgramIntersectionObserver`、`MiniProgramComponentPropertyOption`、`MiniProgramComponentInstance` 等类型别名，并让 `templateRefs`、`pageScroll`、`defineOptions`、setup context 与相关公共类型入口默认对齐这些 `MiniProgram*` 命名。这样可以减少运行时与业务代码对 `WechatMiniprogram.*` 命名的直接耦合，方便后续接入支付宝小程序、抖音小程序等其他宿主。
