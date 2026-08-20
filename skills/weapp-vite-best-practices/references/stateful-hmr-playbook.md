# Stateful HMR Playbook

## 前提

- 只支持微信小程序 WebView；确认 `DevTools` 服务端口、热重载和 `setting.compileHotReLoad: true`。
- 先检查实际 bundle 中的应用/页面 JSON 是否使用 Skyline；命中时工具会关闭项目私有配置中的热重载并强制降级 classic。
- 显式 `weapp.hmr.runtime` 通常优先；Skyline 兼容降级会覆盖显式 stateful，其他场景未配置时核对工作区 `compileHotReLoad` 自动选择结果。
- 排障时先用 `classic` 建立行为基线，再显式启用 `stateful-experimental`。

## 判断

- JS/Vue 安全更新：允许在现有 Page、Component 或 wevu 实例上替换并恢复状态。
- CSS、资源、JSON/配置、模块边界不兼容、补丁积压或执行失败：接受完整构建，并验证当前 route/query 恢复。

## 验收

用真实 runtime 检查状态保留、路由恢复和失败回退；不要只看 dev server 日志。
