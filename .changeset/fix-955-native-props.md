---
'wevu': patch
'@weapp-vite/web': patch
'create-weapp-vite': patch
---

修复 Vue 类型优先的可选、可空和联合类型 props 在微信原生属性层提前被转换的问题。启用空值传输兼容时使用无主类型约束的原生描述符，保留默认值和显式原生属性覆盖，并正确尊重 `allowNullPropInput: false`。

Web 注册入口不再应用小程序宿主的空值传输降级，保留 DOM 布尔、数字、对象和数组属性的解码类型，避免组件交互和视觉表现回归。
