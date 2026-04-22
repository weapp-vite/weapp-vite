---
'@wevu/compiler': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

为普通 `template v-slot` 新增 `weapp.vue.template.slotSingleRootNoWrapper` 配置开关，默认值为 `false`，保持原先的包裹行为不变；当显式开启后，只有“单个可投影根节点”会把 `slot` 直接下推到该子节点，避免额外生成包裹用的 `<view>`。多子节点场景仍会保留真实 `<view slot="...">...</view>` 容器，以避免 `<block slot="...">` 在小程序运行时里出现整组内容丢失的问题。这让 `<template #icon><img /></template>` 这类迁移自 Web Vue 的写法既可以按需保留 `img -> image` 的标签映射，又能在开启新行为时减少单节点场景的布局错乱。
