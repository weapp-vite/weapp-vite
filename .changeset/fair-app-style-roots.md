---
"@weapp-vite/web": patch
"@weapp-core/constants": patch
"wevu": patch
"create-weapp-vite": patch
"@mpcore/simulator": patch
---

修复 Web 应用样式在 Vue 与原生 App 入口中丢失的问题：统一应用样式状态，按页面和组件隔离选项应用样式，保持主题变量继承与局部覆盖，并支持外部和内联样式的热更新、移除及重新添加，不重置页面状态。

隔离 Web 原生事件与组件自定义事件，修复内部点击导致父组件自定义 click 重复执行的问题，并保留事件名称、载荷、冒泡、捕获及手势别名语义。legacy 模板保留节点时复用或替换所属监听器，避免样式更新后重复派发。分离 Web props 输入与 setup 方法安装，避免同名方法覆盖 Boolean 等属性；同时修复嵌套对象和数组增量更新，以及同引用整值提交后深层输入投影丢失的问题。

对齐 simulator 的组件自定义事件传播与真实微信开发者工具：Node/browser 共用声明树路径，支持普通祖先节点捕获、冒泡、组件边界和宿主 catch，并保留源宿主目标、载荷及重渲染期间的监听实例归属；已有 renderer context 冒泡绑定类型和包根公开事件解析 helper 的返回结构保持兼容。
