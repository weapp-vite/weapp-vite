# wevu Troubleshooting Checks

## State 不更新

- 确认 API 来自 `wevu`
- 确认模板依赖了变化的响应式值

## Hook 不触发

- 确认在同步 `setup()` 中注册
- 确认 hook 属于当前 page / component 上下文

## 组件渲染异常

- 确认 `usingComponents` 路径
- 确认事件名与小程序语义一致

## Store 响应性丢失

- 确认解构 state/getters 时使用 `storeToRefs`
