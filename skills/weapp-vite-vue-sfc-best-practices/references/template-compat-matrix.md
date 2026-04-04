# Template Compatibility Matrix

## `v-model`

- 推荐：可赋值左值，如 `x`、`x.y`、`x[i]`
- 避免：表达式、函数调用、可选链目标
- 不要假设 Web Vue 的完整 `v-model` 参数与修饰符能力

## `v-bind`

- 当前小程序模板链路不要使用 `v-bind="object"` 展开
- 改用显式 `:prop="..."` 与 `@event="..."`

## 组件事件

- 优先小程序事件命名与语义
- 自定义组件保持 `valueProp` 与 `event` 契约显式
