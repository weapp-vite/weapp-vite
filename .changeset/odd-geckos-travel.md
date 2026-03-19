---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复原生 layouts 相关文件在开发模式下的热更新链路，建立 `layout` 及其 `json/wxml/wxss/ts` sidecar 到页面入口的反向依赖追踪，确保布局脚本与配置变更能够正确触发关联页面重新发射。同时补充 `layouts` 的 HMR 用例矩阵，覆盖页面、default layout、admin layout 三组资源的 `wxml/wxss/ts/json` 场景。
