---
"weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

fix(wevu): 将原生插槽上下文协议改为默认关闭的显式选项

新增 `weapp.vue.template.nativeSlotContext`，默认 `false`，与保留原生插槽的 `scopedSlotsRequireProps` 独立。未开启时不再生成原生上下文标记、声明属性及插槽事件，也不向普通组件注册对应方法、observer 或清理回调，避免未使用该能力的组件承担协议开销。

需要继续使用 7.5.0 引入的微信原生插槽最近 Provider 上下文能力时，同时设置 `nativeSlotContext: true` 和 `scopedSlotsRequireProps: true`。开启后仅为可能参与上下文传递的组件保留协议，纯展示、仅使用 `ref` 的组件及其纯容器不再注入；保留 Provider、Consumer、组合函数、插槽转发及必要的中间组件链，并在相关源码变化后重新计算。普通 `provide/inject`、增强插槽及其他平台行为保持不变。

完善开启后的静态分析：保留可能通过 getter、属性解构或不透明调用读取上下文的组件；正确识别 Options API、双脚本作用域、普通响应式辅助函数和 HTML 标签映射中的纯用法。符号链接目标删除、重建以及 barrel 重导出改指后，重新计算引用方，编译冻结快照与实时解析不会混用。

对跨模块共享可变值及间接导出保持保守，避免其他模块安装 getter 后丢失最近 Provider；复用同轮已完成的数据证明，避免共享数据图导致重复展开。

组件的协议参与状态在开发期间变化时，stateful HMR 会请求完整重建，避免新 `setup` 沿用缺少协议方法和属性的旧原生实例。

修复 Options API `provide()` 过早执行导致 computed 链读取未安装的 setup 状态、方法或 inject 绑定而报 `undefined` 的问题。现在先安装 setup 与 inject 绑定，再执行 `provide()`；setup 与 Options API 提供同名 key 时以后者为准。该修复同时覆盖开关关闭、显式开启和增强插槽路径。
