---
'@weapp-vite/glass-easel-web-adapter': minor
---

feat(glass-easel): 推进独立的官方组件树实验，支持隔离的组件空间、`usingComponents` 父子组件树、默认与命名 slot、属性和 observer，以及官方 `setData` 路径更新。旧 slot 参数改由官方组件树投影，多个挂载实例共享文档事件桥，避免重复派发；卸载递归释放子组件并保留容器内其他内容。

更新、触发事件、卸载与快照 API 现在要求所属 adapter 返回的只读实例句柄，拒绝普通对象和其他 adapter 的实例。快照反映组件实际数据；移除字符串渲染降级，所有模式都要求官方 DOM backend。该包仍为显式使用的实验入口，不改变默认 Web runtime。
