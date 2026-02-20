---
'@wevu/compiler': patch
wevu: patch
---

修复 issue #300 场景下 `String(props.bool)` 在组件交互后不响应变更的问题，避免生成 `__wevuProps.props` 访问路径，并完善 props 同步与同名 setup 绑定的运行时处理及 e2e 回归测试。
