---
'weapp-vite-wevu-tailwindcss-tdesign-template': patch
'create-weapp-vite': patch
---

调整 `weapp-vite-wevu-tailwindcss-tdesign-template` 中 Store 调用 Layout 演示页的交互职责。现在页面本身不再直接调用 `useToast()` / `useDialog()`，而是由 `wevu/store` 内的 action 直接触发 toast、alert 与 confirm，并通过当前页面的 layout 宿主完成展示，使示例更符合“store 统一调度交互反馈”的目标。
