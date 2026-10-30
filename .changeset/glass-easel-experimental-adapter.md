---
"@weapp-vite/glass-easel-web-adapter": minor
---

feat(glass-easel): 扩展官方组件树实验适配器。

支持隔离的组件空间、`usingComponents` 父子组件树、默认与命名 slot、属性和 observer，以及官方 `setData` 路径更新。该入口需显式使用，不改变默认 Web runtime。

slot 内容由官方组件树投影，多实例挂载时避免重复派发事件；卸载递归释放子组件并保留容器内其他内容，快照反映组件实际数据。

升级注意：`updateComponent`、`triggerEvent`、`unmountComponent` 和 `getSnapshot` 须传入所属 adapter 的 `mountComponent` 返回的只读 `GlassEaselWebInstance` 句柄，不再接受普通对象或其他 adapter 的实例。字符串渲染降级已移除，所有模式都需要官方 DOM backend。
