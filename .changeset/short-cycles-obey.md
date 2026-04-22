---
'@wevu/compiler': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复普通 `template v-slot` 在小程序模板中的包裹策略：当插槽内容只有一个可投影节点时，编译产物现在会把 `slot` 直接下推到该子节点，避免额外生成包裹用的 `<view>`；当插槽内容包含多个子节点时，则改为生成 `<block slot="...">...</block>`，在保持多子节点投影能力的同时不再引入真实布局容器。这也让 `<template #icon><img /></template>` 这类迁移自 Web Vue 的写法可以继续保留 `img -> image` 的标签映射，并减少因额外包裹节点导致的布局错乱。
