---
"wevu": patch
"@weapp-vite/web": patch
"create-weapp-vite": patch
---

优化 wevu 组件首屏挂载时的初始 `setData` 同步：运行时会把小程序原生实例已有的初始 `data` 与内部 owner id 作为首轮快照基线，并在注册组件时把可安全同步求值的 computed 初值合并进原生初始数据，避免已经进入原生首屏渲染的数据再次重复下发；依赖 props 的 computed 会延后到 props 初始化完成后再首轮同步，减少首屏错误值与重复 payload。
