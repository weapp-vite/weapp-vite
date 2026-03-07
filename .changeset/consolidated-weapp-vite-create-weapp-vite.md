---
'create-weapp-vite': patch
'weapp-vite': patch
---

整合仅影响 weapp-vite 与 create-weapp-vite 的 changeset。

## 合并来源
- late-clocks-promise.md
- six-rivers-cheer.md

## 变更摘要
1. **late-clocks-promise.md**：新增 `weapp.wevu.autoSetDataPick` 编译期开关。开启后会从模板表达式自动提取渲染相关顶层 key，并注入到页面/组件的 `setData.pick`，用于减少非渲染字段参与快照与下发；同时兼容已有 `setData.pick` 配置并进行去重合并。
2. **six-rivers-cheer.md**：为 weapp-vite 新增 `onPageScroll` 静态性能诊断：在页面脚本编译阶段自动扫描 `onPageScroll` 回调，针对空回调、`setData` 调用以及 `wx.*Sync` 同步 API 调用输出构建期告警，帮助在开发阶段提前发现滚动卡顿风险。 诊断同时接入 wevu 页面特性注入链路与 Vue/JSX transform 链路，并补充对应单测覆盖，确保告警行为稳定且不影响既有注入逻辑。
