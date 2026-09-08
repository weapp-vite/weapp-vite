---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 React 原生组件局部热更新时因页面 JSON 未重复输出而误报缺少配置的问题。bridge 校验优先使用当前构建产物，并在配置未变化时读取当前入口元数据；配置删除、注册移除和无效 JSON 仍会报错。
