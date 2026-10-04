---
"@mpcore/simulator": patch
---

修复模拟器 `navigateTo` 回调的完成时序，使 success/complete 在目标页面完成 ready 与渲染提交后触发，并补齐组件页面生命周期回调的双向派发与回归覆盖。
