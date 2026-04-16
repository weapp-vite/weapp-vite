---
'@weapp-core/shared': patch
'create-weapp-vite': patch
'weapp-vite': patch
'wevu': patch
---

继续收敛多小程序平台的 runtime 宿主能力模型：在 `@weapp-core/shared` 中补充统一的页面栈、SelectorQuery、IntersectionObserver、分享菜单、页面滚动与下拉刷新等 capability 描述，并让 `wevu` 与 `weapp-vite` 的相关运行时入口统一通过 capability 判断宿主行为，而不是继续散落直接平台假设。这样后续扩展 `swan`、`jd`、`xhs` 等平台时，核心包只需要消费共享能力模型，新增平台主要补 descriptor / adapter / matrix 即可。
