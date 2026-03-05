---
"weapp-vite": patch
"wevu": patch
"create-weapp-vite": patch
---

为 `weapp-vite` 新增 `weapp.wevu.preset: 'performance'` 预设，并将 `autoSetDataPick` 与预设联动（可被显式布尔配置覆盖）；同时为 `wevu` 增加 `setData.highFrequencyWarning` 开发态高频调用告警能力（默认关闭，可按阈值开启与调优）。此外同步补充 website 配置与 runtime 文档，明确预设内容、覆盖规则与 FAQ。
