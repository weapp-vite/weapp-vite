---
'create-weapp-vite': patch
---

清理 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 中 `useNativeInstance()` 的 `as any` 断言，统一使用默认推断类型调用，减少模板示例中的宽泛类型逃逸，便于后续按运行时 API 做精确类型收敛与维护。
