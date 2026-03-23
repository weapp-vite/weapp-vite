---
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'create-weapp-vite': patch
---

为 `weapp-vite-wevu-tailwindcss-tdesign-template` 增加一个 `wevu/store` 驱动 layout 交互的演示页。新示例展示了 store 如何保存布局状态与交互意图，再由页面上下文消费这些命令并调用 `setPageLayout()`、`useToast()`、`useDialog()`，从而命中 `default` 与 `admin` layout 中承载的反馈宿主。
