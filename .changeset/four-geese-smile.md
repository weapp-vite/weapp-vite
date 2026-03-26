---
'@mpcore/simulator': patch
---

补齐浏览器模拟器对高频 WXML 结构指令与交互细节的支持，新增 `wx:if` / `wx:elif` / `wx:else`、`wx:for`、`catchtap` 等能力，并修正组件属性在循环场景下的同步更新与 demo 预览点击解析。
