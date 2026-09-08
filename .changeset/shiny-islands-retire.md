---
"@mpcore/simulator": patch
---

修复模拟器未挂载原生自定义 tabBar 的问题，为每个 tab 页面提供真实 getTabBar 实例、渲染和独立生命周期，并保留缓存页面的组件状态。
