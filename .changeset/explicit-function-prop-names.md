---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

移除组件函数 prop 的名称猜测规则，普通成员绑定如 `:selected="data.userId"` 会继续直接输出为 `selected="{{data.userId}}"`。需要透传动态函数 prop 时，可通过 `vue.template.functionPropNames` 显式声明 prop 名称。
