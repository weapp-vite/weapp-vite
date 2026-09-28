---
"@wevu/json-render": minor
"@wevu/json-render-components": minor
"@mpcore/simulator": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 json-render 的 Wevu 小程序适配包，提供组件目录、状态绑定、动作调度、事务化流式更新和可通过泛型组件扩展的递归 SFC。修复 lib 模式递归引用 SFC 时的重复组件注册，以及 simulator 未继承父级泛型映射的问题，使自定义业务节点及事件转发与真实微信运行时一致。
