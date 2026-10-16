---
"@mpcore/test": minor
"@mpcore/vitest": minor
"@mpcore/simulator": patch
---

feat(test): 完善组件测试与稳定语义快照

支持递归子组件替身、保留实例状态的属性和数据更新、独立卸载与显式事件订阅；修复 `within()` 查询快照过期，并提供稳定语义树快照及 Vitest 自动注册。修复渲染或卸载异常导致更新完成回调丢失、测试操作一直等待的问题，并确保异常清理仍释放测试订阅。
