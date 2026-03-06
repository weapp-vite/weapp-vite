---
"weapp-vite": patch
"create-weapp-vite": patch
---

为 weapp-vite 新增 `onPageScroll` 静态性能诊断：在页面脚本编译阶段自动扫描 `onPageScroll` 回调，针对空回调、`setData` 调用以及 `wx.*Sync` 同步 API 调用输出构建期告警，帮助在开发阶段提前发现滚动卡顿风险。

诊断同时接入 wevu 页面特性注入链路与 Vue/JSX transform 链路，并补充对应单测覆盖，确保告警行为稳定且不影响既有注入逻辑。
