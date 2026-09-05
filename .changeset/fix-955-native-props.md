---
'wevu': patch
'create-weapp-vite': patch
---

修复 Vue 类型优先的可选、可空和联合类型 props 在微信原生属性层提前被转换的问题。启用空值传输兼容时使用无主类型约束的原生描述符，保留默认值和显式原生属性覆盖，并正确尊重 `allowNullPropInput: false`。
