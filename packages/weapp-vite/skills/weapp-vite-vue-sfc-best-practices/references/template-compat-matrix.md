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

## JSX / TSX 与表达式

- Vue/Wevu JSX 输出的小程序自定义组件 tag 保持 kebab-case。
- 可选链与空值合并必须转换成目标模板可执行表达式。
- 启用项目级 `weapp.react` 后，独立 `.jsx/.tsx` 归 React owner；不要按 Wevu JSX 规则处理。
- 纯模板 SFC 没有 script block 时仍应参与组件和类型扫描。
