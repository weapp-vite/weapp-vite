---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复根外 WXML 依赖后登记同目录现存文件时首次保存可能漏报的问题。浅层监听提前覆盖直接子文件，重建仍只接收引用账本中有效的精确依赖，并保留增量登记前已有的监听归属。
