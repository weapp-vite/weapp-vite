---
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'create-weapp-vite': patch
---

重构 `weapp-vite-wevu-tailwindcss-tdesign-template` 的 `useDialog()` 实现，统一 alert / confirm 在 layout 宿主与直接组件调用两种模式下的打开流程，并移除对宿主旧 `properties` 的回灌。这样可以从根本上避免旧按钮配置残留到后续弹窗，减少实现分叉并让 alert / confirm 行为更稳定。
