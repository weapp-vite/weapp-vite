---
'create-weapp-vite': patch
---

修复 `weapp-vite-wevu-tailwindcss-tdesign-retail-template` 首页相关组件在异步回调中调用 `useNativeInstance()` 导致的运行时错误。将 `useNativeInstance()` 收敛到 `setup()` 同步阶段调用，并在后续异步逻辑中复用实例，避免出现 “必须在 setup() 的同步阶段调用” 异常，提升模板初始化与页面渲染稳定性。
