---
"@mpcore/simulator": patch
---

对齐微信开发者工具的 WXML 文本插值行为：原始 null 值显示为 "null"，在首次渲染和后续更新中保持一致；保留未定义绑定的空文本和现有属性处理。
