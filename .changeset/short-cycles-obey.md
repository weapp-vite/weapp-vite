---
'@wevu/compiler': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

为普通 `template v-slot` 新增 `weapp.vue.template.slotSingleRootNoWrapper` 配置开关，默认值为 `false`，保持原先的包裹行为不变；当显式开启后，若插槽内容只有一个可投影节点，编译产物会把 `slot` 直接下推到该子节点，避免额外生成包裹用的 `<view>`，而多子节点场景则会生成 `<block slot="...">...</block>`。这让 `<template #icon><img /></template>` 这类迁移自 Web Vue 的写法既可以按需保留 `img -> image` 的标签映射，又能在开启新行为时减少因额外包裹节点导致的布局错乱。
