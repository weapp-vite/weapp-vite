# SFC Troubleshooting Playbook

## 组件不渲染

- 检查 `usingComponents` 路径与大小写
- 检查组件目标是否声明 `component: true`

## 状态不更新

- 确认 runtime API 来自 `wevu`
- 确认模板真正消费了变化的响应式状态

## Hook 不触发

- 确认在同步 `setup()` 中注册
- 确认 hook 属于当前 page / component 上下文

## 模板输出异常

- 先查 `v-model`、`v-bind` 等兼容限制
- 用显式绑定把编译变换问题最小化
