---
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 `weapp.wevu.autoSetDataPick` 编译期开关。开启后会从模板表达式自动提取渲染相关顶层 key，并注入到页面/组件的 `setData.pick`，用于减少非渲染字段参与快照与下发；同时兼容已有 `setData.pick` 配置并进行去重合并。
