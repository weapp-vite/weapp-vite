'@mpcore/simulator': patch
---

为 `@mpcore/simulator` 增加 `wx.startPullDownRefresh` 能力，直接复用现有下拉刷新事件流与停止状态跟踪，让页面可以主动触发 `onPullDownRefresh` 并维持稳定的 `active/stopCalls` 快照结果。同步补齐 headless runtime、browser runtime、demo fixture、单元测试、browser e2e 与类型测试覆盖，保证主动下拉刷新链路可以稳定验证。
