---
"weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
"create-weapp-vite": patch
---

fix(wevu): 将原生插槽上下文协议改为默认关闭的显式选项

新增 `weapp.vue.template.nativeSlotContext`，默认 `false`，与保留原生插槽的 `scopedSlotsRequireProps` 独立。未开启时不再生成原生上下文标记、声明属性及插槽事件，也不向普通组件注册对应方法、observer 或清理回调，避免未使用该能力的组件承担协议开销。

需要继续使用 7.5.0 引入的微信原生插槽最近 Provider 上下文能力时，同时设置 `nativeSlotContext: true` 和 `scopedSlotsRequireProps: true`。开启后仅为可能参与上下文传递的组件保留协议，纯展示、仅使用 `ref` 的组件及其纯容器不再注入；保留 Provider、Consumer、组合函数、插槽转发及必要的中间组件链，并在相关源码变化后重新计算。普通 `provide/inject`、增强插槽及其他平台行为保持不变。
