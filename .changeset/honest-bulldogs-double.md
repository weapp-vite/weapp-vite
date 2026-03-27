---
'@mpcore/simulator': patch
---

完善 `@mpcore/simulator` 的选择器查询结果形状，支持从节点属性中解析 `mark`，并为 `context` 与 `node` 字段返回可辨识的占位结果，便于测试中区分未实现能力与缺失节点。
